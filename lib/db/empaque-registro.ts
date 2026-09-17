import { createVanessaClient } from "@/lib/supabase/vanessa"
import type { LoteRow } from "@/lib/db/lote"
import type { OrdenProduccionRow } from "@/lib/db/orden-produccion"

export interface EmpaqueRegistroRow {
  id: number
  lote_id: number
  persona_id: number
  color: string
  talla: string
  cantidad: number
  imperfectos: number
  precio_unidad: number
  valor_total: number
  fecha: string
  // false = el empaque carga inventario pero no se le paga a la
  // empacadora (reempaque, correccion, producto devuelto)
  genera_pago: boolean
}

export interface AcumuladoTalla {
  color: string
  talla: string
  total_cantidad: number
  total_valor: number
}

const SELECT_COLS =
  "id, lote_id, persona_id, color, talla, cantidad, imperfectos, precio_unidad, valor_total, fecha, genera_pago"

export async function getEmpaquePorLote(loteId: number): Promise<EmpaqueRegistroRow[]> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("empaque_registro")
    .select(SELECT_COLS)
    .eq("lote_id", loteId)
    .order("id", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as EmpaqueRegistroRow[]
}

export function calcularAcumulado(registros: EmpaqueRegistroRow[]): AcumuladoTalla[] {
  const map = new Map<string, AcumuladoTalla>()
  for (const r of registros) {
    const key = `${r.color}||${r.talla}`
    const ex = map.get(key) ?? {
      color: r.color,
      talla: r.talla,
      total_cantidad: 0,
      total_valor: 0,
    }
    map.set(key, {
      ...ex,
      total_cantidad: ex.total_cantidad + r.cantidad,
      total_valor: Math.round((ex.total_valor + Number(r.valor_total)) * 100) / 100,
    })
  }
  return [...map.values()]
}

export async function getEmpaqueTotalPorLote(loteId: number): Promise<number> {
  const registros = await getEmpaquePorLote(loteId)
  return registros.reduce((s, r) => s + r.cantidad, 0)
}

export async function createEmpaqueRegistro(input: {
  lote_id: number
  persona_id: number
  color: string
  talla: string
  cantidad: number
  imperfectos?: number
  precio_unidad: number
  fecha: string
  creado_por: number
  // Por defecto el empaque se paga; en false solo carga inventario
  genera_pago?: boolean
}): Promise<number> {
  const db = createVanessaClient()
  // valor_total is GENERATED — do not include
  const { data, error } = await db.from("empaque_registro").insert({
    lote_id: input.lote_id,
    persona_id: input.persona_id,
    color: input.color.trim(),
    talla: input.talla.trim(),
    cantidad: input.cantidad,
    imperfectos: input.imperfectos ?? 0,
    // Si no se paga, el precio del registro queda en cero: asi ningun
    // reporte que sume valor_total lo cuenta como pago
    precio_unidad: input.genera_pago === false ? 0 : input.precio_unidad,
    fecha: input.fecha,
    genera_pago: input.genera_pago !== false,
    creado_por: input.creado_por,
  }).select("id").single()
  if (error || !data) throw new Error(error?.message ?? "Error registrando empaque")
  return (data as { id: number }).id
}

export async function deleteEmpaqueRegistro(id: number): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("empaque_registro").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

export async function getEmpaqueResumenPorPersonaYPeriodo(
  personaId: number,
  fechaInicio: string,
  fechaFin: string
): Promise<{ total_valor: number; total_cantidad: number }> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("empaque_registro")
    .select("cantidad, valor_total")
    .eq("persona_id", personaId)
    .eq("genera_pago", true)
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Array<{ cantidad: number; valor_total: number }>
  return {
    total_valor: rows.reduce((s, r) => s + Number(r.valor_total), 0),
    total_cantidad: rows.reduce((s, r) => s + r.cantidad, 0),
  }
}

// ── Bandeja ────────────────────────────────────────────────────

export type LoteConEmpaque = LoteRow & {
  orden: Pick<OrdenProduccionRow, "numero_op" | "referencia">
  total_empacado: number
  total_contado: number
  ultima_fecha_empaque: string | null
}

export async function getLotesEnEmpaque(): Promise<LoteConEmpaque[]> {
  return getLotesPorEstadoEmpaque("empaque")
}

// Historial: lotes que ya se terminaron de empacar. Se consultan para
// revisar lo hecho y, si hace falta, corregirlo.
export async function getLotesFinalizados(input?: {
  desde?: string
  hasta?: string
}): Promise<LoteConEmpaque[]> {
  return getLotesPorEstadoEmpaque("finalizado", input)
}

async function getLotesPorEstadoEmpaque(
  estado: "empaque" | "finalizado",
  input?: { desde?: string; hasta?: string }
): Promise<LoteConEmpaque[]> {
  const db = createVanessaClient()
  const { data: lotes, error } = await db
    .from("lote")
    .select("id, corte_id, orden_id, numero_lote, descripcion, color, cantidad_programada, precio_empaque_unidad, estado, url_imagen, notas_diseno, justificacion_empaque")
    .eq("estado", estado)
    .order("numero_lote", { ascending: false })
  if (error) throw new Error(error.message)
  if (!lotes?.length) return []

  const rows = lotes as LoteRow[]
  const ordenIds = [...new Set(rows.map((l) => l.orden_id))]
  const loteIds = rows.map((l) => l.id)

  const [{ data: ops }, { data: registros }, { data: conteos }] = await Promise.all([
    db.from("orden_produccion").select("id, numero_op, referencia").in("id", ordenIds),
    db.from("empaque_registro").select("lote_id, cantidad, fecha").in("lote_id", loteIds),
    db.from("conteo").select("lote_id, total_contado").in("lote_id", loteIds),
  ])

  const opMap = new Map(
    ((ops ?? []) as Array<{ id: number; numero_op: number; referencia: string }>).map((o) => [
      o.id,
      o,
    ])
  )
  const empMap = new Map<number, number>()
  const fechaMap = new Map<number, string>()
  for (const r of (registros ?? []) as Array<{ lote_id: number; cantidad: number; fecha: string }>) {
    empMap.set(r.lote_id, (empMap.get(r.lote_id) ?? 0) + r.cantidad)
    const prev = fechaMap.get(r.lote_id)
    if (!prev || r.fecha > prev) fechaMap.set(r.lote_id, r.fecha)
  }
  const conteoMap = new Map(
    ((conteos ?? []) as Array<{ lote_id: number; total_contado: number }>).map((c) => [
      c.lote_id,
      c.total_contado,
    ])
  )

  const resultado = rows.map((l) => ({
    ...l,
    orden: opMap.get(l.orden_id) ?? { numero_op: 0, referencia: "—" },
    total_empacado: empMap.get(l.id) ?? 0,
    total_contado: conteoMap.get(l.id) ?? 0,
    ultima_fecha_empaque: fechaMap.get(l.id) ?? null,
  }))

  if (!input?.desde && !input?.hasta) return resultado

  // El filtro de fechas mira cuando se empaco, no cuando se creo el lote
  return resultado.filter((l) => {
    const f = l.ultima_fecha_empaque
    if (!f) return false
    if (input.desde && f < input.desde) return false
    if (input.hasta && f > input.hasta) return false
    return true
  })
}
