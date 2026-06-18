import { createVanessaClient } from "@/lib/supabase/vanessa"
import type { LoteRow } from "@/lib/db/lote"
import type { OrdenProduccionRow } from "@/lib/db/orden-produccion"

export interface ConfeccionRow {
  id: number
  lote_id: number
  cantidad_reconfirmada: number | null
  nombre_confeccionista: string | null
  precio_confeccion: number | null
  fecha_entrega_lote: string | null
  fecha_retorno_lote: string | null
  url_imagen_prenda: string | null
  condiciones_confeccion: string | null
}

export interface ConfeccionInsumoRow {
  id: number
  confeccion_id: number
  nombre: string
  valor: number
}

const SELECT_COLS =
  "id, lote_id, cantidad_reconfirmada, nombre_confeccionista, precio_confeccion, fecha_entrega_lote, fecha_retorno_lote, url_imagen_prenda, condiciones_confeccion"

export async function getConfeccionByLote(loteId: number): Promise<ConfeccionRow | null> {
  const db = createVanessaClient()
  const { data } = await db
    .from("confeccion")
    .select(SELECT_COLS)
    .eq("lote_id", loteId)
    .maybeSingle()
  return data as ConfeccionRow | null
}

export async function guardarConfeccion(input: {
  lote_id: number
  cantidad_reconfirmada?: number | null
  nombre_confeccionista?: string | null
  precio_confeccion?: number | null
  fecha_entrega_lote?: string | null
  fecha_retorno_lote?: string | null
  url_imagen_prenda?: string
  condiciones_confeccion?: string | null
  creado_por: number
}): Promise<number> {
  const db = createVanessaClient()
  const existing = await getConfeccionByLote(input.lote_id)

  const fields: Record<string, unknown> = {
    cantidad_reconfirmada: input.cantidad_reconfirmada ?? null,
    nombre_confeccionista: input.nombre_confeccionista ?? null,
    precio_confeccion: input.precio_confeccion ?? null,
    fecha_entrega_lote: input.fecha_entrega_lote ?? null,
    fecha_retorno_lote: input.fecha_retorno_lote ?? null,
    condiciones_confeccion: input.condiciones_confeccion ?? null,
  }
  if (input.url_imagen_prenda !== undefined) {
    fields.url_imagen_prenda = input.url_imagen_prenda
  }

  if (existing) {
    const { error } = await db.from("confeccion").update(fields).eq("lote_id", input.lote_id)
    if (error) throw new Error(error.message)
    return existing.id
  } else {
    const { data, error } = await db
      .from("confeccion")
      .insert({ lote_id: input.lote_id, ...fields, creado_por: input.creado_por })
      .select("id")
      .single()
    if (error || !data) throw new Error(error?.message ?? "Error creando confección")
    return data.id
  }
}

export async function uploadImagenConfeccion(file: File, loteId: number): Promise<string> {
  const db = createVanessaClient()
  const ext = file.name.split(".").pop() ?? "jpg"
  const path = `${loteId}/prenda_${Date.now()}.${ext}`
  const buffer = await file.arrayBuffer()
  const { error } = await db.storage
    .from("confeccion")
    .upload(path, buffer, { contentType: file.type, upsert: true })
  if (error) throw new Error(error.message)
  const { data } = db.storage.from("confeccion").getPublicUrl(path)
  return data.publicUrl
}

// ── Insumos ────────────────────────────────────────────────────

export async function getInsumosByConfeccion(
  confeccionId: number
): Promise<ConfeccionInsumoRow[]> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("confeccion_insumo")
    .select("id, confeccion_id, nombre, valor")
    .eq("confeccion_id", confeccionId)
    .order("id")
  if (error) throw new Error(error.message)
  return (data ?? []) as ConfeccionInsumoRow[]
}

export async function replaceInsumos(
  confeccionId: number,
  filas: Array<{ nombre: string; valor: number }>,
  creadoPor: number
): Promise<void> {
  const db = createVanessaClient()
  const { error: delErr } = await db
    .from("confeccion_insumo")
    .delete()
    .eq("confeccion_id", confeccionId)
  if (delErr) throw new Error(delErr.message)
  if (filas.length === 0) return
  const rows = filas.map((f) => ({
    confeccion_id: confeccionId,
    nombre: f.nombre.trim(),
    valor: f.valor,
    creado_por: creadoPor,
  }))
  const { error: insErr } = await db.from("confeccion_insumo").insert(rows)
  if (insErr) throw new Error(insErr.message)
}

// ── Bandeja ────────────────────────────────────────────────────

export type LoteConConfeccion = LoteRow & {
  orden: Pick<OrdenProduccionRow, "numero_op" | "referencia">
  confeccion: ConfeccionRow | null
}

export async function getLotesEnConfeccion(): Promise<LoteConConfeccion[]> {
  const db = createVanessaClient()
  const { data: lotes, error } = await db
    .from("lote")
    .select("id, corte_id, orden_id, numero_lote, color, cantidad_programada, precio_empaque_unidad, estado")
    .eq("estado", "confeccion")
    .order("numero_lote", { ascending: false })
  if (error) throw new Error(error.message)
  if (!lotes?.length) return []

  const rows = lotes as LoteRow[]
  const ordenIds = [...new Set(rows.map((l) => l.orden_id))]
  const loteIds = rows.map((l) => l.id)

  const [{ data: ops }, { data: confecciones }] = await Promise.all([
    db.from("orden_produccion").select("id, numero_op, referencia").in("id", ordenIds),
    db.from("confeccion").select(SELECT_COLS).in("lote_id", loteIds),
  ])

  const opMap = new Map(
    ((ops ?? []) as Array<{ id: number; numero_op: number; referencia: string }>).map((o) => [
      o.id,
      o,
    ])
  )
  const confMap = new Map(((confecciones ?? []) as ConfeccionRow[]).map((c) => [c.lote_id, c]))

  return rows.map((l) => ({
    ...l,
    orden: opMap.get(l.orden_id) ?? { numero_op: 0, referencia: "—" },
    confeccion: confMap.get(l.id) ?? null,
  }))
}
