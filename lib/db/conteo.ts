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
}

export interface ConteoDetalleRow {
  id: number
  conteo_id: number
  color: string
  talla: string
  cantidad_contada: number
}

const SELECT_COLS_CONTEO =
  "id, lote_id, fecha_conteo, total_contado, validado, observacion"
const SELECT_COLS_DETALLE =
  "id, conteo_id, color, talla, cantidad_contada"

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

export async function replaceConteoDetalle(
  conteoId: number,
  filas: Array<{ color: string; talla: string; cantidad_contada: number }>,
  creadoPor: number
): Promise<number> {
  const db = createVanessaClient()
  const { error: delErr } = await db
    .from("conteo_detalle")
    .delete()
    .eq("conteo_id", conteoId)
  if (delErr) throw new Error(delErr.message)

  const totalContado = filas.reduce((s, f) => s + (f.cantidad_contada || 0), 0)

  if (filas.length > 0) {
    const rows = filas.map((f) => ({
      conteo_id: conteoId,
      color: f.color.trim(),
      talla: f.talla.trim(),
      cantidad_contada: f.cantidad_contada,
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

  return totalContado
}

export async function validarConteo(loteId: number): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db
    .from("conteo")
    .update({ validado: true })
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
    .select("id, corte_id, orden_id, numero_lote, color, cantidad_programada, precio_empaque_unidad, estado")
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
