import { createVanessaClient } from "@/lib/supabase/vanessa"
import type { OrdenProduccionRow } from "@/lib/db/orden-produccion"

export interface DisenoRow {
  id: number
  orden_id: number
  especificaciones_confirmacion: string | null
  url_imagen_prenda: string | null
  carta_color: string | null
  especificaciones_diseno: string | null
  aprobado: boolean
  fecha_aprobacion: string | null
}

const SELECT_COLS =
  "id, orden_id, especificaciones_confirmacion, url_imagen_prenda, carta_color, especificaciones_diseno, aprobado, fecha_aprobacion"

export async function getDisenoByOrden(ordenId: number): Promise<DisenoRow | null> {
  const db = createVanessaClient()
  const { data } = await db
    .from("diseno")
    .select(SELECT_COLS)
    .eq("orden_id", ordenId)
    .maybeSingle()
  return data as DisenoRow | null
}

export async function guardarDiseno(input: {
  orden_id: number
  especificaciones_confirmacion?: string | null
  carta_color?: string | null
  especificaciones_diseno?: string | null
  url_imagen_prenda?: string
  creado_por: number
}): Promise<void> {
  const db = createVanessaClient()
  const existing = await getDisenoByOrden(input.orden_id)

  if (existing) {
    const payload: Record<string, unknown> = {
      especificaciones_confirmacion: input.especificaciones_confirmacion ?? null,
      carta_color: input.carta_color ?? null,
      especificaciones_diseno: input.especificaciones_diseno ?? null,
    }
    if (input.url_imagen_prenda !== undefined) {
      payload.url_imagen_prenda = input.url_imagen_prenda
    }
    const { error } = await db.from("diseno").update(payload).eq("orden_id", input.orden_id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await db.from("diseno").insert({
      orden_id: input.orden_id,
      especificaciones_confirmacion: input.especificaciones_confirmacion ?? null,
      carta_color: input.carta_color ?? null,
      especificaciones_diseno: input.especificaciones_diseno ?? null,
      url_imagen_prenda: input.url_imagen_prenda ?? null,
      aprobado: false,
      creado_por: input.creado_por,
    })
    if (error) throw new Error(error.message)
  }
}

export async function aprobarDiseno(ordenId: number): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db
    .from("diseno")
    .update({ aprobado: true, fecha_aprobacion: new Date().toISOString() })
    .eq("orden_id", ordenId)
  if (error) throw new Error(error.message)
}

export async function uploadImagenDiseno(file: File, ordenId: number): Promise<string> {
  const db = createVanessaClient()
  const ext = file.name.split(".").pop() ?? "jpg"
  const path = `${ordenId}/prenda_${Date.now()}.${ext}`
  const buffer = await file.arrayBuffer()
  const { error } = await db.storage
    .from("disenos")
    .upload(path, buffer, { contentType: file.type, upsert: true })
  if (error) throw new Error(error.message)
  const { data } = db.storage.from("disenos").getPublicUrl(path)
  return data.publicUrl
}

export interface DisenoConOP extends DisenoRow {
  numero_op: number
  fecha_programacion: string | null
}

export async function getDisenosByReferencia(
  referencia: string,
  excludeOrdenId: number
): Promise<DisenoConOP[]> {
  const db = createVanessaClient()
  const { data: ops, error: opErr } = await db
    .from("orden_produccion")
    .select("id, numero_op, fecha_programacion")
    .eq("referencia", referencia)
    .neq("id", excludeOrdenId)
    .order("numero_op", { ascending: false })
    .limit(10)
  if (opErr) throw new Error(opErr.message)
  if (!ops?.length) return []

  type OpRow = { id: number; numero_op: number; fecha_programacion: string | null }
  const opList = ops as OpRow[]
  const opIds = opList.map((o) => o.id)
  const opMap = new Map(opList.map((o) => [o.id, o]))

  const { data: disenos } = await db
    .from("diseno")
    .select(SELECT_COLS)
    .in("orden_id", opIds)
    .not("url_imagen_prenda", "is", null)
    .order("orden_id", { ascending: false })

  return ((disenos ?? []) as DisenoRow[]).map((d) => ({
    ...d,
    numero_op: opMap.get(d.orden_id)?.numero_op ?? 0,
    fecha_programacion: opMap.get(d.orden_id)?.fecha_programacion ?? null,
  }))
}

export async function listOPsEnDiseno(): Promise<
  (OrdenProduccionRow & { diseno: DisenoRow | null })[]
> {
  const db = createVanessaClient()
  const { data: ops, error } = await db
    .from("orden_produccion")
    .select(
      "id, numero_op, fecha_programacion, referencia, descripcion, url_molde, gama_color, observaciones, estado, creado_por, creado_en"
    )
    .eq("estado", "diseno")
    .order("numero_op", { ascending: false })
  if (error) throw new Error(error.message)
  if (!ops?.length) return []

  const ordenIds = (ops as { id: number }[]).map((o) => o.id)
  const { data: disenos } = await db
    .from("diseno")
    .select(SELECT_COLS)
    .in("orden_id", ordenIds)

  const disenoMap = new Map(
    ((disenos ?? []) as DisenoRow[]).map((d) => [d.orden_id, d])
  )

  return (ops as OrdenProduccionRow[]).map((op) => ({
    ...op,
    diseno: disenoMap.get(op.id) ?? null,
  }))
}
