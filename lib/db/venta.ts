import { createVanessaClient } from "@/lib/supabase/vanessa"
import { getSaldosInventario } from "@/lib/db/inventario-producto"

// Ventas (cartera). Cada venta es un documento de un cliente con una o más
// líneas de referencia. Al confirmarla, cada línea descuenta del inventario
// de producto terminado mediante una salida en inventrans.

export type EstadoVenta = "borrador" | "confirmada" | "anulada"

// Contado: se paga al momento. Credito: pasa a cartera con su saldo.
export type FormaPago = "contado" | "credito"

// Razon social que emite la factura
export type RazonSocial = "ACOA" | "GOODFATHER"

export const RAZONES_SOCIALES: RazonSocial[] = ["ACOA", "GOODFATHER"]

export const RAZON_SOCIAL_COLOR: Record<RazonSocial, string> = {
  ACOA: "bg-[#344966]/10 text-[#344966]",
  GOODFATHER: "bg-violet-100 text-violet-800",
}

export interface VentaAbonoRow {
  id: number
  venta_id: number
  fecha: string
  valor: number
  medio_pago: string | null
  referencia: string | null
  observacion: string | null
  creado_en: string
}

export interface VentaHistorialRow {
  id: number
  venta_id: number
  nivel: "factura" | "detalle"
  accion: string
  descripcion: string | null
  total_valor: number | null
  total_unidades: number | null
  referencia: string | null
  talla: string | null
  cantidad: number | null
  valor_unidad: number | null
  usuario_id: number | null
  usuario_nombre: string | null
  razon_social: RazonSocial | null
  creado_en: string
}

// Historial con el documento al que pertenece, para la vista global
export type HistorialConVenta = VentaHistorialRow & {
  numero_documento: string
  cliente_nombre: string
  fecha_venta: string
}

export interface ClienteRow {
  id: number
  nombre: string
  ciudad: string | null
  nit: string | null
  telefono: string | null
  direccion: string | null
  contacto: string | null
  activo: boolean
}

export interface ReferenciaVentaRow {
  id: number
  referencia: string
  descripcion: string | null
  linea: string | null
  categoria: string | null
  valor_unidad: number
  activo: boolean
}

export interface VentaDetalleRow {
  id: number
  venta_id: number
  referencia: string
  descripcion: string | null
  linea: string | null
  categoria: string | null
  talla: string | null
  cantidad: number
  valor_unidad: number
  valor_total: number
  inventrans_id: number | null
}

export interface VentaRow {
  id: number
  numero_documento: string
  fecha: string
  cliente_id: number | null
  cliente_nombre: string
  ciudad: string | null
  estado: EstadoVenta
  total_unidades: number
  total_valor: number
  observacion: string | null
  creado_en: string
  confirmada_en: string | null
  forma_pago: FormaPago
  dias_credito: number
  fecha_vencimiento: string | null
  total_abonado: number
  razon_social: RazonSocial
}

export type VentaConDetalle = VentaRow & { detalle: VentaDetalleRow[] }

export const ESTADO_VENTA_LABEL: Record<EstadoVenta, string> = {
  borrador: "Borrador",
  confirmada: "Confirmada",
  anulada: "Anulada",
}

export const FORMA_PAGO_LABEL: Record<FormaPago, string> = {
  contado: "Pago inmediato",
  credito: "Credito",
}

export const FORMA_PAGO_COLOR: Record<FormaPago, string> = {
  contado: "bg-sky-100 text-sky-800",
  credito: "bg-amber-100 text-amber-800",
}

export const ESTADO_VENTA_COLOR: Record<EstadoVenta, string> = {
  borrador: "bg-stone-100 text-stone-700",
  confirmada: "bg-emerald-100 text-emerald-800",
  anulada: "bg-red-100 text-red-800",
}

const VENTA_COLS =
  "id, numero_documento, fecha, cliente_id, cliente_nombre, ciudad, estado, total_unidades, total_valor, observacion, creado_en, confirmada_en, forma_pago, dias_credito, fecha_vencimiento, total_abonado, razon_social"
const DETALLE_COLS =
  "id, venta_id, referencia, descripcion, linea, categoria, talla, cantidad, valor_unidad, valor_total, inventrans_id"

// ── Clientes ────────────────────────────────────────────────────

export async function listClientes(soloActivos = false): Promise<ClienteRow[]> {
  const db = createVanessaClient()
  let q = db
    .from("cliente")
    .select("id, nombre, ciudad, nit, telefono, direccion, contacto, activo")
    .order("nombre")
  if (soloActivos) q = q.eq("activo", true)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as ClienteRow[]
}

export async function createCliente(
  input: {
    nombre: string
    ciudad?: string | null
    nit?: string | null
    telefono?: string | null
    direccion?: string | null
    contacto?: string | null
  },
  creadoPor: number
): Promise<number> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("cliente")
    .insert({
      nombre: input.nombre.trim().toUpperCase(),
      ciudad: input.ciudad?.trim().toUpperCase() || null,
      nit: input.nit?.trim() || null,
      telefono: input.telefono?.trim() || null,
      direccion: input.direccion?.trim() || null,
      contacto: input.contacto?.trim() || null,
      creado_por: creadoPor,
    })
    .select("id")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Error creando el cliente")
  return data.id
}

export async function updateCliente(
  id: number,
  campos: Partial<Omit<ClienteRow, "id">>
): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("cliente").update(campos).eq("id", id)
  if (error) throw new Error(error.message)
}

export async function deleteCliente(id: number): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("cliente").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

// ── Referencias de venta (precio y clasificación) ───────────────

export async function listReferenciasVenta(): Promise<ReferenciaVentaRow[]> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("referencia_venta")
    .select("id, referencia, descripcion, linea, categoria, valor_unidad, activo")
    .eq("activo", true)
    .order("referencia")
  if (error) throw new Error(error.message)
  return (data ?? []) as ReferenciaVentaRow[]
}

export async function upsertReferenciaVenta(
  input: {
    referencia: string
    descripcion?: string | null
    linea?: string | null
    categoria?: string | null
    valor_unidad: number
  },
  creadoPor: number
): Promise<void> {
  const db = createVanessaClient()
  const ref = input.referencia.trim().toUpperCase()

  const { data: existente } = await db
    .from("referencia_venta")
    .select("id")
    .ilike("referencia", ref)
    .maybeSingle()

  const campos = {
    descripcion: input.descripcion?.trim() || null,
    linea: input.linea?.trim() || null,
    categoria: input.categoria?.trim() || null,
    valor_unidad: input.valor_unidad,
  }

  if (existente) {
    const { error } = await db
      .from("referencia_venta")
      .update(campos)
      .eq("id", (existente as { id: number }).id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await db
      .from("referencia_venta")
      .insert({ referencia: ref, ...campos, creado_por: creadoPor })
    if (error) throw new Error(error.message)
  }
}

// ── Ventas ──────────────────────────────────────────────────────

export async function listVentas(input?: {
  desde?: string
  hasta?: string
  clienteId?: number | null
  estado?: string | null
  razon_social?: RazonSocial | null
}): Promise<VentaConDetalle[]> {
  const db = createVanessaClient()

  let q = db.from("venta").select(VENTA_COLS).order("fecha", { ascending: false }).order("id", {
    ascending: false,
  })
  if (input?.desde) q = q.gte("fecha", input.desde)
  if (input?.hasta) q = q.lte("fecha", input.hasta)
  if (input?.clienteId) q = q.eq("cliente_id", input.clienteId)
  if (input?.estado) q = q.eq("estado", input.estado)
  if (input?.razon_social) q = q.eq("razon_social", input.razon_social)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  const ventas = (data ?? []) as VentaRow[]
  if (ventas.length === 0) return []

  const { data: detalles } = await db
    .from("venta_detalle")
    .select(DETALLE_COLS)
    .in(
      "venta_id",
      ventas.map((v) => v.id)
    )
    .order("id")

  const porVenta = new Map<number, VentaDetalleRow[]>()
  for (const d of (detalles ?? []) as VentaDetalleRow[]) {
    const arr = porVenta.get(d.venta_id) ?? []
    arr.push(d)
    porVenta.set(d.venta_id, arr)
  }

  return ventas.map((v) => ({ ...v, detalle: porVenta.get(v.id) ?? [] }))
}

export interface LineaVentaInput {
  referencia: string
  descripcion?: string | null
  linea?: string | null
  categoria?: string | null
  talla?: string | null
  cantidad: number
  valor_unidad: number
}

// Crea o actualiza una venta en borrador con sus líneas
export async function guardarVenta(
  input: {
    id?: number | null
    numero_documento?: string | null
    fecha: string
    cliente_id: number | null
    cliente_nombre: string
    ciudad?: string | null
    observacion?: string | null
    forma_pago?: FormaPago
    dias_credito?: number
    razon_social?: RazonSocial
    lineas: LineaVentaInput[]
  },
  creadoPor: number
): Promise<number> {
  const db = createVanessaClient()

  if (input.lineas.length === 0) throw new Error("Agrega al menos una referencia a la venta")
  const invalida = input.lineas.find((l) => !l.referencia.trim() || !(l.cantidad > 0))
  if (invalida) throw new Error("Cada línea necesita referencia y cantidad mayor que 0")

  const totalUnidades = input.lineas.reduce((s, l) => s + l.cantidad, 0)
  const totalValor = input.lineas.reduce((s, l) => s + l.cantidad * l.valor_unidad, 0)

  const formaPago: FormaPago = input.forma_pago ?? "contado"
  const diasCredito = formaPago === "credito" ? Math.max(0, input.dias_credito ?? 0) : 0

  const cabecera = {
    fecha: input.fecha,
    cliente_id: input.cliente_id,
    cliente_nombre: input.cliente_nombre.trim().toUpperCase(),
    ciudad: input.ciudad?.trim().toUpperCase() || null,
    total_unidades: totalUnidades,
    total_valor: totalValor,
    observacion: input.observacion?.trim() || null,
    forma_pago: formaPago,
    dias_credito: diasCredito,
    razon_social: input.razon_social ?? "ACOA",
  }

  let ventaId = input.id ?? null

  if (ventaId) {
    // Solo se edita mientras esté en borrador
    const { data: actual } = await db
      .from("venta")
      .select("estado")
      .eq("id", ventaId)
      .maybeSingle()
    if ((actual as { estado: string } | null)?.estado === "confirmada") {
      throw new Error("La venta ya fue confirmada y descontó inventario; anúlala para cambiarla")
    }
    const { error } = await db.from("venta").update(cabecera).eq("id", ventaId)
    if (error) throw new Error(error.message)
    await db.from("venta_detalle").delete().eq("venta_id", ventaId)
  } else {
    // El numero de documento es automatico: sale de la secuencia
    const numero = input.numero_documento?.trim() || (await siguienteConsecutivo())
    const { data, error } = await db
      .from("venta")
      .insert({
        ...cabecera,
        numero_documento: numero,
        estado: "borrador",
        creado_por: creadoPor,
      })
      .select("id")
      .single()
    if (error || !data) throw new Error(error?.message ?? "Error creando la venta")
    ventaId = data.id
  }

  const filas = input.lineas.map((l) => ({
    venta_id: ventaId,
    referencia: l.referencia.trim().toUpperCase(),
    descripcion: l.descripcion?.trim() || null,
    linea: l.linea?.trim() || null,
    categoria: l.categoria?.trim() || null,
    talla: l.talla?.trim().toUpperCase() || null,
    cantidad: l.cantidad,
    valor_unidad: l.valor_unidad,
    valor_total: l.cantidad * l.valor_unidad,
  }))
  const { error: errDet } = await db.from("venta_detalle").insert(filas)
  if (errDet) throw new Error(errDet.message)

  await registrarHistorial({
    venta_id: ventaId as number,
    nivel: "factura",
    accion: input.id ? "editada" : "creada",
    descripcion: `${formaPago === "credito" ? "Credito" : "Contado"} - ${
      filas.length
    } linea(s)`,
    total_valor: totalValor,
    total_unidades: totalUnidades,
    usuario_id: creadoPor,
  })

  // Historial a nivel detalle: que se vendio en esta version del documento
  for (const f of filas) {
    await registrarHistorial({
      venta_id: ventaId as number,
      nivel: "detalle",
      accion: input.id ? "linea editada" : "linea agregada",
      referencia: f.referencia,
      talla: f.talla,
      cantidad: f.cantidad,
      valor_unidad: f.valor_unidad,
      usuario_id: creadoPor,
    })
  }

  return ventaId as number
}

export interface FaltanteInventario {
  referencia: string
  talla: string
  solicitado: number
  disponible: number
}

// Compara lo que pide la venta contra el saldo de inventario por
// referencia + talla. Varias lineas de la misma referencia/talla suman,
// para que no se apruebe una venta que en conjunto excede el disponible.
export async function verificarDisponible(
  lineas: Array<{ referencia: string; talla: string | null; cantidad: number }>
): Promise<FaltanteInventario[]> {
  const saldos = await getSaldosInventario()

  const disponiblePor = new Map<string, number>()
  for (const s of saldos) {
    const key = `${(s.referencia ?? "").trim().toUpperCase()}|${s.talla.trim().toUpperCase()}`
    disponiblePor.set(key, (disponiblePor.get(key) ?? 0) + s.disponible)
  }

  const solicitadoPor = new Map<string, { referencia: string; talla: string; cantidad: number }>()
  for (const l of lineas) {
    const referencia = l.referencia.trim().toUpperCase()
    const talla = (l.talla ?? "").trim().toUpperCase()
    const key = `${referencia}|${talla}`
    const actual = solicitadoPor.get(key)
    if (actual) actual.cantidad += l.cantidad
    else solicitadoPor.set(key, { referencia, talla, cantidad: l.cantidad })
  }

  const faltantes: FaltanteInventario[] = []
  for (const [key, s] of solicitadoPor) {
    const disponible = disponiblePor.get(key) ?? 0
    if (s.cantidad > disponible) {
      faltantes.push({
        referencia: s.referencia,
        talla: s.talla || "(sin talla)",
        solicitado: s.cantidad,
        disponible,
      })
    }
  }
  return faltantes
}

// Confirma la venta y descuenta del inventario: cada línea genera una
// salida en inventrans por referencia y talla.
export async function confirmarVenta(
  ventaId: number,
  creadoPor: number
): Promise<{ lineas: number }> {
  const db = createVanessaClient()

  const { data: venta } = await db
    .from("venta")
    .select(VENTA_COLS)
    .eq("id", ventaId)
    .maybeSingle()
  const v = venta as VentaRow | null
  if (!v) throw new Error("Venta no encontrada")
  if (v.estado === "confirmada") throw new Error("La venta ya está confirmada")

  const { data: detalles } = await db
    .from("venta_detalle")
    .select(DETALLE_COLS)
    .eq("venta_id", ventaId)
  const lineas = (detalles ?? []) as VentaDetalleRow[]
  if (lineas.length === 0) throw new Error("La venta no tiene líneas")

  // El inventario se lleva por referencia + talla: sin talla no hay contra
  // que descontar, asi que la venta no se puede confirmar.
  const sinTallaRefs = lineas.filter((l) => !l.talla?.trim()).map((l) => l.referencia)
  if (sinTallaRefs.length > 0) {
    throw new Error(
      `Indica la talla para descontar del inventario: ${[...new Set(sinTallaRefs)].join(", ")}`
    )
  }

  // Antes de descontar nada, comprobar que haya disponible para todas las
  // lineas: la venta se confirma completa o no se confirma.
  const faltantes = await verificarDisponible(lineas)
  if (faltantes.length > 0) {
    const detalle = faltantes
      .map(
        (f) =>
          `${f.referencia} talla ${f.talla}: pide ${f.solicitado}, disponible ${f.disponible}`
      )
      .join("; ")
    throw new Error(`No hay inventario suficiente. ${detalle}`)
  }

  // La OP más reciente de cada referencia, solo como dato informativo
  const { data: ordenes } = await db
    .from("orden_produccion")
    .select("id, numero_op, referencia")
    .order("numero_op", { ascending: false })
  const ordenesRows = (ordenes ?? []) as Array<{
    id: number
    numero_op: number
    referencia: string | null
  }>

  for (const l of lineas) {
    const orden = ordenesRows.find(
      (o) => (o.referencia ?? "").trim().toUpperCase() === l.referencia.trim().toUpperCase()
    )

    const { data: mov, error } = await db
      .from("inventrans")
      .insert({
        tipo: "salida",
        motivo: `Venta ${v.numero_documento}`,
        orden_id: orden?.id ?? null,
        numero_op: orden?.numero_op ?? null,
        referencia: l.referencia,
        // La salida de venta no se ata a un lote
        lote_id: null,
        lote_nombre: null,
        prenda_nombre: null,
        talla: (l.talla ?? "").trim(),
        color: null,
        cantidad: l.cantidad,
        fecha: v.fecha,
        observacion: `${v.cliente_nombre}${v.ciudad ? ` · ${v.ciudad}` : ""}`,
        creado_por: creadoPor,
      })
      .select("id")
      .single()
    if (error || !mov) throw new Error(error?.message ?? "Error descontando del inventario")

    await db.from("venta_detalle").update({ inventrans_id: mov.id }).eq("id", l.id)
  }

  // Las ventas a credito pasan a cartera con su fecha de vencimiento
  const vencimiento =
    v.forma_pago === "credito" && v.dias_credito > 0
      ? sumarDias(v.fecha, v.dias_credito)
      : v.forma_pago === "credito"
        ? v.fecha
        : null

  const { error: errEstado } = await db
    .from("venta")
    .update({
      estado: "confirmada",
      confirmada_en: new Date().toISOString(),
      fecha_vencimiento: vencimiento,
    })
    .eq("id", ventaId)
  if (errEstado) throw new Error(errEstado.message)

  await registrarHistorial({
    venta_id: ventaId,
    nivel: "factura",
    accion: "confirmada",
    descripcion:
      v.forma_pago === "credito"
        ? `A credito${vencimiento ? `, vence el ${vencimiento}` : ""}. Descuenta inventario.`
        : "Pago inmediato. Descuenta inventario.",
    total_valor: Number(v.total_valor),
    total_unidades: v.total_unidades,
    usuario_id: creadoPor,
  })

  return { lineas: lineas.length }
}

// Suma dias calendario a una fecha ISO (YYYY-MM-DD)
function sumarDias(fechaISO: string, dias: number): string {
  const [y, m, d] = fechaISO.split("-").map(Number)
  const f = new Date(Date.UTC(y, m - 1, d))
  f.setUTCDate(f.getUTCDate() + dias)
  return f.toISOString().slice(0, 10)
}

// Anula la venta y devuelve al inventario lo que había descontado
export async function anularVenta(ventaId: number): Promise<void> {
  const db = createVanessaClient()

  const { data: detalles } = await db
    .from("venta_detalle")
    .select("id, inventrans_id")
    .eq("venta_id", ventaId)

  const movIds = ((detalles ?? []) as Array<{ id: number; inventrans_id: number | null }>)
    .map((d) => d.inventrans_id)
    .filter((x): x is number => x != null)

  if (movIds.length > 0) {
    const { error } = await db.from("inventrans").delete().in("id", movIds)
    if (error) throw new Error(error.message)
    await db.from("venta_detalle").update({ inventrans_id: null }).eq("venta_id", ventaId)
  }

  const { error } = await db.from("venta").update({ estado: "anulada" }).eq("id", ventaId)
  if (error) throw new Error(error.message)

  await registrarHistorial({
    venta_id: ventaId,
    nivel: "factura",
    accion: "anulada",
    descripcion:
      movIds.length > 0
        ? `Se devolvieron ${movIds.length} movimiento(s) al inventario`
        : "Sin movimientos de inventario que devolver",
  })
}

export async function eliminarVenta(ventaId: number): Promise<void> {
  const db = createVanessaClient()
  // Devolver el inventario antes de borrar
  await anularVenta(ventaId)
  const { error } = await db.from("venta").delete().eq("id", ventaId)
  if (error) throw new Error(error.message)
}

// ── Consecutivo del documento ───────────────────────────────────

// Toma el siguiente numero de la secuencia. Es atomico: dos usuarios
// registrando a la vez no obtienen el mismo numero.
async function siguienteConsecutivo(): Promise<string> {
  const db = createVanessaClient()

  // El mayor documento que ya existe. Sirve para detectar una secuencia
  // atrasada, como queda tras cargar ventas historicas.
  const { data: ventas } = await db.from("venta").select("numero_documento").limit(5000)
  const usados = new Set<string>()
  let maximo = 0
  for (const v of (ventas ?? []) as Array<{ numero_documento: string }>) {
    const doc = (v.numero_documento ?? "").trim()
    usados.add(doc)
    const m = /(\d+)\s*$/.exec(doc)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > maximo) maximo = n
    }
  }

  const { data, error } = await db.rpc("siguiente_documento_venta")
  if (!error && data != null) {
    const n = parseInt(String(data), 10)
    // Si la secuencia va adelante del historico, se usa tal cual
    if (Number.isFinite(n) && n > maximo && !usados.has(String(n))) return String(n)

    // Va atrasada: se adelanta de una vez al mayor existente
    const { error: errAjuste } = await db.rpc("ajustar_consecutivo_venta")
    if (!errAjuste) {
      const { data: reintento, error: errReintento } = await db.rpc("siguiente_documento_venta")
      if (!errReintento && reintento != null) {
        const m = parseInt(String(reintento), 10)
        if (Number.isFinite(m) && m > maximo && !usados.has(String(m))) return String(m)
      }
    }
  }

  // Respaldo: el mayor numero + 1
  return String(maximo + 1)
}

// Numero que se le muestra al usuario antes de guardar. Es solo una
// vista previa: el numero definitivo se asigna al crear la venta.
export async function getSiguienteDocumento(): Promise<string> {
  const db = createVanessaClient()
  const { data } = await db.from("venta").select("numero_documento").limit(5000)

  let maximo = 0
  for (const v of (data ?? []) as Array<{ numero_documento: string }>) {
    const m = /(\d+)\s*$/.exec((v.numero_documento ?? "").trim())
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > maximo) maximo = n
    }
  }
  return String(maximo + 1)
}

// ── Historial de la venta ───────────────────────────────────────

async function registrarHistorial(input: {
  venta_id: number
  nivel: "factura" | "detalle"
  accion: string
  razon_social?: RazonSocial | null
  descripcion?: string | null
  total_valor?: number | null
  total_unidades?: number | null
  referencia?: string | null
  talla?: string | null
  cantidad?: number | null
  valor_unidad?: number | null
  usuario_id?: number | null
}): Promise<void> {
  const db = createVanessaClient()

  // La razon social se toma de la venta si no viene explicita, para que
  // el historial se pueda filtrar sin depender de la venta
  let razonSocial = input.razon_social ?? null
  if (!razonSocial) {
    const { data } = await db
      .from("venta")
      .select("razon_social")
      .eq("id", input.venta_id)
      .maybeSingle()
    razonSocial = (data as { razon_social: RazonSocial } | null)?.razon_social ?? null
  }

  let usuarioNombre: string | null = null
  if (input.usuario_id) {
    const { data } = await db
      .from("usuario")
      .select("nombre_completo")
      .eq("id", input.usuario_id)
      .maybeSingle()
    usuarioNombre = (data as { nombre_completo: string } | null)?.nombre_completo ?? null
  }

  // El historial no debe tumbar la operacion si falla
  await db.from("venta_historial").insert({
    venta_id: input.venta_id,
    nivel: input.nivel,
    accion: input.accion,
    descripcion: input.descripcion ?? null,
    total_valor: input.total_valor ?? null,
    total_unidades: input.total_unidades ?? null,
    referencia: input.referencia ?? null,
    talla: input.talla ?? null,
    cantidad: input.cantidad ?? null,
    valor_unidad: input.valor_unidad ?? null,
    usuario_id: input.usuario_id ?? null,
    usuario_nombre: usuarioNombre,
    razon_social: razonSocial,
  })
}

// Historial de una venta (factura y detalle)
export async function getHistorialVenta(ventaId: number): Promise<VentaHistorialRow[]> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("venta_historial")
    .select("*")
    .eq("venta_id", ventaId)
    .order("creado_en", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as VentaHistorialRow[]
}

// Historial global, para la pestana de historial del modulo
export async function getHistorialGlobal(input?: {
  nivel?: "factura" | "detalle" | null
  razon_social?: RazonSocial | null
  desde?: string
  hasta?: string
}): Promise<HistorialConVenta[]> {
  const db = createVanessaClient()

  let q = db
    .from("venta_historial")
    .select("*")
    .order("creado_en", { ascending: false })
    .limit(2000)
  if (input?.nivel) q = q.eq("nivel", input.nivel)
  if (input?.razon_social) q = q.eq("razon_social", input.razon_social)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  const filas = (data ?? []) as VentaHistorialRow[]
  if (filas.length === 0) return []

  const { data: ventas } = await db
    .from("venta")
    .select("id, numero_documento, cliente_nombre, fecha, razon_social")
    .in("id", [...new Set(filas.map((f) => f.venta_id))])

  const porId = new Map(
    ((ventas ?? []) as Array<{
      id: number
      numero_documento: string
      cliente_nombre: string
      fecha: string
      razon_social: RazonSocial
    }>).map((v) => [v.id, v])
  )

  const conVenta = filas.map((f) => {
    const v = porId.get(f.venta_id)
    return {
      ...f,
      numero_documento: v?.numero_documento ?? "(eliminada)",
      cliente_nombre: v?.cliente_nombre ?? "",
      fecha_venta: v?.fecha ?? "",
      // Si el evento no la trae, se usa la de la venta
      razon_social: f.razon_social ?? v?.razon_social ?? null,
    }
  })

  // El filtro por fecha es sobre la fecha de la venta
  return conVenta.filter((h) => {
    if (input?.desde && h.fecha_venta && h.fecha_venta < input.desde) return false
    if (input?.hasta && h.fecha_venta && h.fecha_venta > input.hasta) return false
    return true
  })
}

// ── Cartera: abonos de las ventas a credito ─────────────────────

export async function getAbonos(ventaId: number): Promise<VentaAbonoRow[]> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("venta_abono")
    .select("id, venta_id, fecha, valor, medio_pago, referencia, observacion, creado_en")
    .eq("venta_id", ventaId)
    .order("fecha", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as VentaAbonoRow[]
}

export async function registrarAbono(
  input: {
    venta_id: number
    fecha: string
    valor: number
    medio_pago?: string | null
    referencia?: string | null
    observacion?: string | null
  },
  creadoPor: number
): Promise<void> {
  if (!(input.valor > 0)) throw new Error("El valor del abono debe ser mayor que 0")

  const db = createVanessaClient()

  const { data: venta } = await db
    .from("venta")
    .select("id, estado, forma_pago, total_valor, total_abonado, numero_documento")
    .eq("id", input.venta_id)
    .maybeSingle()
  const v = venta as VentaRow | null
  if (!v) throw new Error("Venta no encontrada")
  if (v.estado !== "confirmada") {
    throw new Error("Solo se abonan las ventas confirmadas")
  }
  if (v.forma_pago !== "credito") {
    throw new Error("Esta venta es de pago inmediato, no tiene cartera")
  }

  const saldo = Number(v.total_valor) - Number(v.total_abonado)
  if (input.valor > saldo) {
    throw new Error(
      `El abono (${input.valor}) supera el saldo pendiente (${saldo})`
    )
  }

  const { error } = await db.from("venta_abono").insert({
    venta_id: input.venta_id,
    fecha: input.fecha,
    valor: input.valor,
    medio_pago: input.medio_pago?.trim() || null,
    referencia: input.referencia?.trim() || null,
    observacion: input.observacion?.trim() || null,
    creado_por: creadoPor,
  })
  if (error) throw new Error(error.message)

  const nuevoTotal = Number(v.total_abonado) + input.valor
  const { error: errTotal } = await db
    .from("venta")
    .update({ total_abonado: nuevoTotal })
    .eq("id", input.venta_id)
  if (errTotal) throw new Error(errTotal.message)

  await registrarHistorial({
    venta_id: input.venta_id,
    nivel: "factura",
    accion: "abono",
    descripcion: `Abono de ${input.valor}${
      input.medio_pago ? ` por ${input.medio_pago}` : ""
    }. Saldo: ${Number(v.total_valor) - nuevoTotal}`,
    total_valor: Number(v.total_valor),
    usuario_id: creadoPor,
  })
}

export async function eliminarAbono(abonoId: number, creadoPor: number): Promise<void> {
  const db = createVanessaClient()

  const { data: abono } = await db
    .from("venta_abono")
    .select("id, venta_id, valor")
    .eq("id", abonoId)
    .maybeSingle()
  const a = abono as { id: number; venta_id: number; valor: number } | null
  if (!a) throw new Error("Abono no encontrado")

  const { error } = await db.from("venta_abono").delete().eq("id", abonoId)
  if (error) throw new Error(error.message)

  const { data: venta } = await db
    .from("venta")
    .select("total_abonado")
    .eq("id", a.venta_id)
    .maybeSingle()
  const total = Number((venta as { total_abonado: number } | null)?.total_abonado ?? 0)
  await db
    .from("venta")
    .update({ total_abonado: Math.max(0, total - Number(a.valor)) })
    .eq("id", a.venta_id)

  await registrarHistorial({
    venta_id: a.venta_id,
    nivel: "factura",
    accion: "abono eliminado",
    descripcion: `Se elimino un abono de ${a.valor}`,
    usuario_id: creadoPor,
  })
}

// Numero de documento ya asignado a una venta
export async function getDocumentoDeVenta(ventaId: number): Promise<string | undefined> {
  const db = createVanessaClient()
  const { data } = await db
    .from("venta")
    .select("numero_documento")
    .eq("id", ventaId)
    .maybeSingle()
  return (data as { numero_documento: string } | null)?.numero_documento
}
