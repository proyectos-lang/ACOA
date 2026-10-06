import { createVanessaClient } from "@/lib/supabase/vanessa"
import type { LoteRow } from "@/lib/db/lote"
import type { OrdenProduccionRow } from "@/lib/db/orden-produccion"

export interface ConteoRow {
  id: number
  lote_id: number
  fecha_conteo: string | null
  total_contado: number
  validado: boolean
  observacion: string | null
  justificacion_diferencia: string | null
}

export interface ConteoDetalleRow {
  id: number
  conteo_id: number
  // Pieza del conjunto a la que pertenece la fila; null en OPs de una
  // prenda y en los conteos anteriores al registro por pieza
  prenda_id: number | null
  color: string
  talla: string
  cantidad_contada: number
  imperfectos: number
}

const SELECT_COLS_CONTEO =
  "id, lote_id, fecha_conteo, total_contado, validado, observacion, justificacion_diferencia"
const SELECT_COLS_DETALLE =
  "id, conteo_id, prenda_id, color, talla, cantidad_contada, imperfectos"

export async function getConteoByLote(loteId: number): Promise<ConteoRow | null> {
  const db = createVanessaClient()
  const { data } = await db
    .from("conteo")
    .select(SELECT_COLS_CONTEO)
    .eq("lote_id", loteId)
    .maybeSingle()
  return data as ConteoRow | null
}

export async function getConteoDetalle(conteoId: number): Promise<ConteoDetalleRow[]> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("conteo_detalle")
    .select(SELECT_COLS_DETALLE)
    .eq("conteo_id", conteoId)
    .order("color")
    .order("talla")
  if (error) throw new Error(error.message)
  return (data ?? []) as ConteoDetalleRow[]
}

export async function upsertConteo(input: {
  lote_id: number
  fecha_conteo?: string | null
  observacion?: string | null
  creado_por: number
}): Promise<number> {
  const db = createVanessaClient()
  const existing = await getConteoByLote(input.lote_id)

  if (existing) {
    const { error } = await db
      .from("conteo")
      .update({
        fecha_conteo: input.fecha_conteo ?? null,
        observacion: input.observacion ?? null,
      })
      .eq("lote_id", input.lote_id)
    if (error) throw new Error(error.message)
    return existing.id
  } else {
    const { data, error } = await db
      .from("conteo")
      .insert({
        lote_id: input.lote_id,
        fecha_conteo: input.fecha_conteo ?? null,
        observacion: input.observacion ?? null,
        total_contado: 0,
        validado: false,
        creado_por: input.creado_por,
      })
      .select("id")
      .single()
    if (error || !data) throw new Error(error?.message ?? "Error creando conteo")
    return data.id
  }
}

export interface ConteoDetalleInput {
  prenda_id?: number | null
  color: string
  talla: string
  cantidad_contada: number
  imperfectos?: number
}

// Reemplaza el detalle del conteo. En los conjuntos cada fila lleva su
// pieza, y lo contado de cada pieza se copia a lote_prenda.cantidad_contada
// (es lo que usa el pago al confeccionista por pieza y la trazabilidad).
// total_contado del conteo es la suma de todas las filas.
export async function replaceConteoDetalle(
  conteoId: number,
  filas: ConteoDetalleInput[],
  creadoPor: number
): Promise<number> {
  const db = createVanessaClient()
  const { error: delErr } = await db
    .from("conteo_detalle")
    .delete()
    .eq("conteo_id", conteoId)
  if (delErr) throw new Error(delErr.message)

  // Agrupar filas repetidas (misma pieza, talla y color) sumando cantidades:
  // conteo_detalle tiene unicidad por (conteo_id, pieza, color, talla)
  const agrupadas = new Map<
    string,
    { prenda_id: number | null; color: string; talla: string; cantidad_contada: number; imperfectos: number }
  >()
  for (const f of filas) {
    const prendaId = f.prenda_id ?? null
    const color = f.color.trim()
    const talla = f.talla.trim()
    const key = `${prendaId ?? 0}|${color.toLowerCase()}|${talla.toLowerCase()}`
    const prev = agrupadas.get(key)
    if (prev) {
      prev.cantidad_contada += f.cantidad_contada || 0
      prev.imperfectos += f.imperfectos || 0
    } else {
      agrupadas.set(key, {
        prenda_id: prendaId,
        color,
        talla,
        cantidad_contada: f.cantidad_contada || 0,
        imperfectos: f.imperfectos || 0,
      })
    }
  }
  const filasUnicas = [...agrupadas.values()]

  const totalContado = filasUnicas.reduce((s, f) => s + (f.cantidad_contada || 0), 0)

  if (filasUnicas.length > 0) {
    const rows = filasUnicas.map((f) => ({
      conteo_id: conteoId,
      prenda_id: f.prenda_id,
      color: f.color,
      talla: f.talla,
      cantidad_contada: f.cantidad_contada,
      imperfectos: f.imperfectos,
      creado_por: creadoPor,
    }))
    const { error: insErr } = await db.from("conteo_detalle").insert(rows)
    if (insErr) throw new Error(insErr.message)
  }

  const { error: updErr } = await db
    .from("conteo")
    .update({ total_contado: totalContado })
    .eq("id", conteoId)
  if (updErr) throw new Error(updErr.message)

  // Lo contado de cada pieza viaja a la pieza
  const porPrenda = new Map<number, number>()
  for (const f of filasUnicas) {
    if (f.prenda_id == null) continue
    porPrenda.set(f.prenda_id, (porPrenda.get(f.prenda_id) ?? 0) + f.cantidad_contada)
  }
  for (const [prendaId, contadas] of porPrenda) {
    const { error } = await db
      .from("lote_prenda")
      .update({ cantidad_contada: contadas })
      .eq("id", prendaId)
    if (error) throw new Error(error.message)
  }

  return totalContado
}

export async function validarConteo(
  loteId: number,
  justificacion?: string | null
): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db
    .from("conteo")
    .update({ validado: true, justificacion_diferencia: justificacion?.trim() || null })
    .eq("lote_id", loteId)
  if (error) throw new Error(error.message)
}

// ── Bandeja ────────────────────────────────────────────────────

export type LoteConConteo = LoteRow & {
  orden: Pick<OrdenProduccionRow, "numero_op" | "referencia">
  conteo: ConteoRow | null
}

export async function getLotesEnConteo(): Promise<LoteConConteo[]> {
  const db = createVanessaClient()
  const { data: lotes, error } = await db
    .from("lote")
    .select("id, corte_id, orden_id, numero_lote, descripcion, color, cantidad_programada, precio_empaque_unidad, estado, url_imagen, notas_diseno")
    .eq("estado", "conteo")
    .order("numero_lote", { ascending: false })
  if (error) throw new Error(error.message)
  if (!lotes?.length) return []

  const rows = lotes as LoteRow[]
  const ordenIds = [...new Set(rows.map((l) => l.orden_id))]
  const loteIds = rows.map((l) => l.id)

  const [{ data: ops }, { data: conteos }] = await Promise.all([
    db.from("orden_produccion").select("id, numero_op, referencia").in("id", ordenIds),
    db.from("conteo").select(SELECT_COLS_CONTEO).in("lote_id", loteIds),
  ])

  const opMap = new Map(
    ((ops ?? []) as Array<{ id: number; numero_op: number; referencia: string }>).map((o) => [
      o.id,
      o,
    ])
  )
  const conteoMap = new Map(((conteos ?? []) as ConteoRow[]).map((c) => [c.lote_id, c]))

  return rows.map((l) => ({
    ...l,
    orden: opMap.get(l.orden_id) ?? { numero_op: 0, referencia: "—" },
    conteo: conteoMap.get(l.id) ?? null,
  }))
}
