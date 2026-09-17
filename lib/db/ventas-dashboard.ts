import { createVanessaClient } from "@/lib/supabase/vanessa"
import type { EstadoVenta, FormaPago, RazonSocial } from "@/lib/db/venta"

// Datos agregados para el dashboard de ventas. Las ventas anuladas no
// cuentan en ningun total: no son ventas, son documentos revertidos.

export interface PuntoMes {
  mes: string // YYYY-MM
  etiqueta: string // "Ene 26"
  valor: number
  unidades: number
  facturas: number
}

export interface FilaCliente {
  cliente: string
  ciudad: string | null
  valor: number
  unidades: number
  facturas: number
}

export interface FilaReferencia {
  referencia: string
  descripcion: string | null
  valor: number
  unidades: number
  facturas: number
}

export interface ResumenVentas {
  total_valor: number
  total_unidades: number
  total_facturas: number
  ticket_promedio: number
  // Cartera: lo que queda por cobrar de las ventas a credito
  por_cobrar: number
  facturas_vencidas: number
  clientes_activos: number
}

export interface DashboardVentas {
  resumen: ResumenVentas
  meses: PuntoMes[]
  clientes: FilaCliente[]
  referencias: FilaReferencia[]
  // Rango real de los datos, para mostrarlo en la interfaz
  desde: string | null
  hasta: string | null
}

const MESES_CORTOS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
]

function etiquetaMes(mes: string): string {
  const [y, m] = mes.split("-")
  const i = parseInt(m, 10) - 1
  return `${MESES_CORTOS[i] ?? m} ${y.slice(2)}`
}

export async function getDashboardVentas(input?: {
  desde?: string | null
  hasta?: string | null
  razon_social?: RazonSocial | null
}): Promise<DashboardVentas> {
  const db = createVanessaClient()

  let q = db
    .from("venta")
    .select(
      "id, fecha, cliente_nombre, ciudad, estado, forma_pago, total_valor, total_unidades, total_abonado, fecha_vencimiento, razon_social"
    )
    .neq("estado", "anulada")
    .limit(20000)
  if (input?.desde) q = q.gte("fecha", input.desde)
  if (input?.hasta) q = q.lte("fecha", input.hasta)
  if (input?.razon_social) q = q.eq("razon_social", input.razon_social)

  const { data, error } = await q
  if (error) throw new Error(error.message)

  const ventas = (data ?? []) as Array<{
    id: number
    fecha: string
    cliente_nombre: string
    ciudad: string | null
    estado: EstadoVenta
    forma_pago: FormaPago
    total_valor: number
    total_unidades: number
    total_abonado: number
    fecha_vencimiento: string | null
    razon_social: RazonSocial
  }>

  if (ventas.length === 0) {
    return {
      resumen: {
        total_valor: 0,
        total_unidades: 0,
        total_facturas: 0,
        ticket_promedio: 0,
        por_cobrar: 0,
        facturas_vencidas: 0,
        clientes_activos: 0,
      },
      meses: [],
      clientes: [],
      referencias: [],
      desde: null,
      hasta: null,
    }
  }

  // ── Resumen ──
  const totalValor = ventas.reduce((s, v) => s + Number(v.total_valor), 0)
  const totalUnidades = ventas.reduce((s, v) => s + v.total_unidades, 0)
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })

  const credito = ventas.filter((v) => v.forma_pago === "credito")
  const porCobrar = credito.reduce(
    (s, v) => s + Math.max(0, Number(v.total_valor) - Number(v.total_abonado)),
    0
  )
  const vencidas = credito.filter(
    (v) =>
      Number(v.total_valor) - Number(v.total_abonado) > 0 &&
      v.fecha_vencimiento &&
      v.fecha_vencimiento < hoy
  ).length

  // ── Por mes ──
  const porMes = new Map<string, PuntoMes>()
  for (const v of ventas) {
    const mes = v.fecha.slice(0, 7)
    const p = porMes.get(mes) ?? {
      mes,
      etiqueta: etiquetaMes(mes),
      valor: 0,
      unidades: 0,
      facturas: 0,
    }
    p.valor += Number(v.total_valor)
    p.unidades += v.total_unidades
    p.facturas += 1
    porMes.set(mes, p)
  }
  const meses = [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes))

  // ── Por cliente ──
  const porCliente = new Map<string, FilaCliente>()
  for (const v of ventas) {
    const key = v.cliente_nombre.trim().toUpperCase()
    const c = porCliente.get(key) ?? {
      cliente: v.cliente_nombre.trim(),
      ciudad: v.ciudad,
      valor: 0,
      unidades: 0,
      facturas: 0,
    }
    c.valor += Number(v.total_valor)
    c.unidades += v.total_unidades
    c.facturas += 1
    porCliente.set(key, c)
  }
  const clientes = [...porCliente.values()].sort((a, b) => b.valor - a.valor)

  // ── Por referencia: sale del detalle de esas mismas ventas ──
  const ventaIds = ventas.map((v) => v.id)
  const referencias: FilaReferencia[] = []

  // Se consulta por bloques: la lista de ids puede ser muy larga para la URL
  const porRef = new Map<string, FilaReferencia & { _docs: Set<number> }>()
  for (let i = 0; i < ventaIds.length; i += 300) {
    const bloque = ventaIds.slice(i, i + 300)
    const { data: det } = await db
      .from("venta_detalle")
      .select("venta_id, referencia, descripcion, cantidad, valor_total")
      .in("venta_id", bloque)
      .limit(20000)

    for (const d of (det ?? []) as Array<{
      venta_id: number
      referencia: string
      descripcion: string | null
      cantidad: number
      valor_total: number
    }>) {
      const key = d.referencia.trim().toUpperCase()
      const r = porRef.get(key) ?? {
        referencia: d.referencia.trim(),
        descripcion: d.descripcion,
        valor: 0,
        unidades: 0,
        facturas: 0,
        _docs: new Set<number>(),
      }
      r.valor += Number(d.valor_total)
      r.unidades += d.cantidad
      r._docs.add(d.venta_id)
      if (!r.descripcion && d.descripcion) r.descripcion = d.descripcion
      porRef.set(key, r)
    }
  }
  for (const r of porRef.values()) {
    referencias.push({
      referencia: r.referencia,
      descripcion: r.descripcion,
      valor: r.valor,
      unidades: r.unidades,
      facturas: r._docs.size,
    })
  }
  referencias.sort((a, b) => b.valor - a.valor)

  const fechas = ventas.map((v) => v.fecha).sort()

  return {
    resumen: {
      total_valor: totalValor,
      total_unidades: totalUnidades,
      total_facturas: ventas.length,
      ticket_promedio: ventas.length > 0 ? totalValor / ventas.length : 0,
      por_cobrar: porCobrar,
      facturas_vencidas: vencidas,
      clientes_activos: porCliente.size,
    },
    meses,
    clientes,
    referencias,
    desde: fechas[0] ?? null,
    hasta: fechas[fechas.length - 1] ?? null,
  }
}
