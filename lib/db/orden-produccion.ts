import { createVanessaClient } from "@/lib/supabase/vanessa"
import { deleteLoteCascada } from "@/lib/db/lote"

export type EstadoOP =
  | "programada"
  | "diseno"
  | "corte"
  | "estampacion"
  | "confeccion"
  | "conteo"
  | "empaque"
  | "terminada"

export const ESTADO_OP_LABEL: Record<EstadoOP, string> = {
  programada:  "Programada",
  diseno:      "Diseño",
  corte:       "Corte",
  estampacion: "Estampación",
  confeccion:  "Confección",
  conteo:      "Conteo",
  empaque:     "Empaque",
  terminada:   "Terminada",
}

export const ESTADO_OP_COLOR: Record<EstadoOP, string> = {
  programada:  "bg-blue-100 text-blue-800",
  diseno:      "bg-purple-100 text-purple-800",
  corte:       "bg-orange-100 text-orange-800",
  estampacion: "bg-pink-100 text-pink-800",
  confeccion:  "bg-teal-100 text-teal-800",
  conteo:      "bg-yellow-100 text-yellow-800",
  empaque:     "bg-green-100 text-green-800",
  terminada:   "bg-stone-100 text-stone-700",
}

export interface OrdenProduccionRow {
  id: number
  numero_op: number
  fecha_programacion: string | null
  referencia: string
  descripcion: string | null
  url_molde: string | null
  gama_color: string | null
  observaciones: string | null
  estado: EstadoOP
  capas: number
  categoria_id: number | null
  pasa_estampacion: boolean
  creado_por: number | null
  creado_en: string
}

const SELECT_COLS =
  "id, numero_op, fecha_programacion, referencia, descripcion, url_molde, gama_color, observaciones, estado, capas, categoria_id, pasa_estampacion, creado_por, creado_en"

export async function listOrdenes(filtros?: {
  estado?: string
  busqueda?: string
}): Promise<OrdenProduccionRow[]> {
  const db = createVanessaClient()
  let q = db
    .from("orden_produccion")
    .select(SELECT_COLS)
    .order("numero_op", { ascending: false })
  if (filtros?.estado && filtros.estado !== "todos")
    q = q.eq("estado", filtros.estado)
  if (filtros?.busqueda?.trim()) {
    const b = filtros.busqueda.trim()
    q = q.or(`referencia.ilike.%${b}%,descripcion.ilike.%${b}%`)
  }
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as OrdenProduccionRow[]
}

export async function getOrdenById(id: number): Promise<OrdenProduccionRow | null> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("orden_produccion")
    .select(SELECT_COLS)
    .eq("id", id)
    .maybeSingle()
  // Un error real de DB (ej. columna faltante por migración sin correr) debe
  // verse como error, no convertirse en un 404 engañoso
  if (error) throw new Error(error.message)
  return data as OrdenProduccionRow | null
}

export async function createOrden(input: {
  referencia: string
  descripcion?: string | null
  fecha_programacion?: string | null
  gama_color?: string | null
  observaciones?: string | null
  url_molde?: string | null
  creado_por: number
}): Promise<number> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("orden_produccion")
    .insert({
      referencia: input.referencia.trim(),
      descripcion: input.descripcion || null,
      fecha_programacion: input.fecha_programacion || null,
      gama_color: input.gama_color || null,
      observaciones: input.observaciones || null,
      url_molde: input.url_molde || null,
      creado_por: input.creado_por,
    })
    .select("id")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Error creando orden")
  return data.id
}

export async function updateOrden(
  id: number,
  input: Partial<{
    numero_op: number
    referencia: string
    descripcion: string | null
    fecha_programacion: string | null
    gama_color: string | null
    observaciones: string | null
    url_molde: string | null
    capas: number
    categoria_id: number | null
    pasa_estampacion: boolean
  }>
): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("orden_produccion").update(input).eq("id", id)
  if (error) throw new Error(error.message)
}

export async function cambiarEstado(id: number, estado: EstadoOP): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("orden_produccion").update({ estado }).eq("id", id)
  if (error) throw new Error(error.message)
}

export async function uploadMolde(file: File, ordenId: number): Promise<string> {
  const db = createVanessaClient()
  const ext = file.name.split(".").pop() ?? "pdf"
  const path = `${ordenId}/molde_${Date.now()}.${ext}`
  const buffer = await file.arrayBuffer()
  const { error } = await db.storage
    .from("moldes")
    .upload(path, buffer, { contentType: file.type, upsert: true })
  if (error) throw new Error(error.message)
  const { data } = db.storage.from("moldes").getPublicUrl(path)
  return data.publicUrl
}

// Elimina una orden de producción completa: todos sus lotes (con sus
// operaciones de estampación/confección/conteo/empaque), el corte y sus
// fichas de tela, la curva, materiales, hoja de costos y diseño.
export async function deleteOrdenCascada(ordenId: number): Promise<void> {
  const db = createVanessaClient()

  const { data: lotes, error: lotesErr } = await db
    .from("lote")
    .select("id")
    .eq("orden_id", ordenId)
  if (lotesErr) throw new Error(lotesErr.message)
  for (const l of (lotes ?? []) as { id: number }[]) {
    await deleteLoteCascada(l.id)
  }

  // Fichas de tela del corte (dependen de corte.id)
  const { data: cortes } = await db.from("corte").select("id").eq("orden_id", ordenId)
  const corteIds = ((cortes ?? []) as { id: number }[]).map((c) => c.id)
  if (corteIds.length > 0) {
    const { error } = await db.from("corte_tela").delete().in("corte_id", corteIds)
    if (error) throw new Error(`corte_tela: ${error.message}`)
  }

  for (const tabla of [
    "corte_capa_real", "corte", "op_tela_lote", "op_tela",
    "op_material", "curva_talla", "hoja_costos", "diseno",
  ]) {
    const { error } = await db.from(tabla).delete().eq("orden_id", ordenId)
    if (error) throw new Error(`${tabla}: ${error.message}`)
  }

  const { error } = await db.from("orden_produccion").delete().eq("id", ordenId)
  if (error) throw new Error(error.message)
}
