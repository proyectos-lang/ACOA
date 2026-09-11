import { createVanessaClient } from "@/lib/supabase/vanessa"

// Reporte de cortes entregados: qué se cortó cada día, con el detalle por
// OP, material, color y lote (capas reales y prendas resultantes).

export interface DetalleCorteFila {
  slot: number
  tipo_tela: string
  color: string
  lote_nombre: string
  capas_programadas: number
  capas_reales: number
  comentario: string | null
}

export interface CorteEntregado {
  corte_id: number
  orden_id: number
  numero_op: number
  referencia: string
  descripcion: string | null
  fecha_corte: string
  fecha_programacion: string | null
  consecutivo_corte: number
  tallas: number
  // Totales del corte (solo Material 1: las capas son compartidas)
  total_capas: number
  total_prendas: number
  lotes: string[]
  telas: string[]
  // Diferencias frente a lo programado
  cambios: number
  detalle: DetalleCorteFila[]
}

export interface DiaCorte {
  fecha: string
  dia_semana: number
  cortes: CorteEntregado[]
  total_capas: number
  total_prendas: number
  total_ops: number
}

// Cortes entregados (con fecha de corte) dentro de un rango
export async function getReporteCortes(input: {
  desde: string
  hasta: string
  ordenId?: number | null
}): Promise<DiaCorte[]> {
  const db = createVanessaClient()

  let q = db
    .from("corte")
    .select("id, orden_id, consecutivo_corte, fecha_corte, fecha_programacion")
    .not("fecha_corte", "is", null)
    .gte("fecha_corte", input.desde)
    .lte("fecha_corte", input.hasta)
    .order("fecha_corte", { ascending: false })
  if (input.ordenId) q = q.eq("orden_id", input.ordenId)

  const { data: cortes, error } = await q
  if (error) throw new Error(error.message)
  const filas = (cortes ?? []) as Array<{
    id: number
    orden_id: number
    consecutivo_corte: number
    fecha_corte: string
    fecha_programacion: string | null
  }>
  if (filas.length === 0) return []

  const ordenIds = [...new Set(filas.map((c) => c.orden_id))]

  const [{ data: ops }, { data: capas }, { data: telas }, { data: programadas }, { data: curvas }] =
    await Promise.all([
      db
        .from("orden_produccion")
        .select("id, numero_op, referencia, descripcion")
        .in("id", ordenIds),
      db
        .from("corte_capa_real")
        .select("orden_id, slot, fila, lote_nombre, capas_reales, comentario")
        .in("orden_id", ordenIds),
      db.from("op_tela").select("orden_id, slot, fila, tipo_tela, color").in("orden_id", ordenIds),
      db
        .from("op_tela_lote")
        .select("orden_id, slot, fila, lote_nombre, color, capas")
        .in("orden_id", ordenIds),
      db.from("curva_talla").select("orden_id").in("orden_id", ordenIds),
    ])

  const opMap = new Map(
    ((ops ?? []) as Array<{
      id: number
      numero_op: number
      referencia: string
      descripcion: string | null
    }>).map((o) => [o.id, o])
  )

  // Número de tallas por orden (las prendas son capas × tallas)
  const tallasPorOrden = new Map<number, number>()
  for (const c of (curvas ?? []) as Array<{ orden_id: number }>) {
    tallasPorOrden.set(c.orden_id, (tallasPorOrden.get(c.orden_id) ?? 0) + 1)
  }

  // Color y tipo de tela por posición (orden + slot + fila)
  const telaMap = new Map<string, { tipo_tela: string; color: string }>()
  for (const t of (telas ?? []) as Array<{
    orden_id: number
    slot: number
    fila: number
    tipo_tela: string | null
    color: string | null
  }>) {
    telaMap.set(`${t.orden_id}|${t.slot}|${t.fila ?? 0}`, {
      tipo_tela: t.tipo_tela ?? "—",
      color: t.color ?? "—",
    })
  }

  // Capas programadas, para detectar los cambios hechos en planta
  const progMap = new Map<string, { capas: number; color: string }>()
  for (const r of (programadas ?? []) as Array<{
    orden_id: number
    slot: number
    fila: number
    lote_nombre: string
    color: string
    capas: number
  }>) {
    progMap.set(`${r.orden_id}|${r.slot}|${r.fila ?? 0}|${r.lote_nombre}`, {
      capas: r.capas,
      color: r.color,
    })
  }

  // Capas reales agrupadas por orden
  const realesPorOrden = new Map<
    number,
    Array<{
      slot: number
      fila: number
      lote_nombre: string
      capas_reales: number
      comentario: string | null
    }>
  >()
  for (const c of (capas ?? []) as Array<{
    orden_id: number
    slot: number
    fila: number
    lote_nombre: string
    capas_reales: number
    comentario: string | null
  }>) {
    const arr = realesPorOrden.get(c.orden_id) ?? []
    arr.push(c)
    realesPorOrden.set(c.orden_id, arr)
  }

  const entregados: CorteEntregado[] = filas.map((c) => {
    const op = opMap.get(c.orden_id)
    const tallas = tallasPorOrden.get(c.orden_id) ?? 0
    const reales = realesPorOrden.get(c.orden_id) ?? []

    const detalle: DetalleCorteFila[] = reales
      .map((r) => {
        const tela = telaMap.get(`${c.orden_id}|${r.slot}|${r.fila}`)
        const prog = progMap.get(`${c.orden_id}|${r.slot}|${r.fila}|${r.lote_nombre}`)
        return {
          slot: r.slot,
          tipo_tela: tela?.tipo_tela ?? "—",
          color: tela?.color ?? prog?.color ?? "—",
          lote_nombre: r.lote_nombre,
          capas_programadas: prog?.capas ?? 0,
          capas_reales: r.capas_reales,
          comentario: r.comentario,
        }
      })
      .sort(
        (a, b) =>
          a.slot - b.slot ||
          a.lote_nombre.localeCompare(b.lote_nombre, "es", { numeric: true }) ||
          a.color.localeCompare(b.color, "es")
      )

    // Las capas son compartidas entre materiales: el total sale del slot 1
    const slotBase = detalle.length > 0 ? Math.min(...detalle.map((d) => d.slot)) : 1
    const delSlotBase = detalle.filter((d) => d.slot === slotBase)
    const totalCapas = delSlotBase.reduce((s, d) => s + d.capas_reales, 0)

    return {
      corte_id: c.id,
      orden_id: c.orden_id,
      numero_op: op?.numero_op ?? 0,
      referencia: op?.referencia ?? "—",
      descripcion: op?.descripcion ?? null,
      fecha_corte: c.fecha_corte,
      fecha_programacion: c.fecha_programacion,
      consecutivo_corte: c.consecutivo_corte,
      tallas,
      total_capas: totalCapas,
      total_prendas: totalCapas * tallas,
      lotes: [...new Set(delSlotBase.map((d) => d.lote_nombre))],
      telas: [...new Set(detalle.map((d) => d.tipo_tela).filter((t) => t !== "—"))],
      cambios: detalle.filter((d) => d.capas_reales !== d.capas_programadas).length,
      detalle,
    }
  })

  // Agrupar por día de entrega
  const dias = new Map<string, DiaCorte>()
  for (const e of entregados) {
    let dia = dias.get(e.fecha_corte)
    if (!dia) {
      const [y, m, d] = e.fecha_corte.split("-").map(Number)
      dia = {
        fecha: e.fecha_corte,
        dia_semana: new Date(Date.UTC(y, m - 1, d)).getUTCDay(),
        cortes: [],
        total_capas: 0,
        total_prendas: 0,
        total_ops: 0,
      }
      dias.set(e.fecha_corte, dia)
    }
    dia.cortes.push(e)
    dia.total_capas += e.total_capas
    dia.total_prendas += e.total_prendas
    dia.total_ops += 1
  }

  return [...dias.values()].sort((a, b) => b.fecha.localeCompare(a.fecha))
}
