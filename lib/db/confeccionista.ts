import { createVanessaClient } from "@/lib/supabase/vanessa"

export interface ConfeccionistaRow {
  id: number
  nombre_completo: string
  telefono: string | null
  celular: string | null
  direccion: string | null
  barrio: string | null
  fecha_nacimiento: string | null
  url_foto_cedula: string | null
  activo: boolean
  creado_en: string
}

const SELECT_COLS =
  "id, nombre_completo, telefono, celular, direccion, barrio, fecha_nacimiento, url_foto_cedula, activo, creado_en"

export async function listConfeccionistas(soloActivos = false): Promise<ConfeccionistaRow[]> {
  const db = createVanessaClient()
  let q = db.from("confeccionista").select(SELECT_COLS).order("nombre_completo")
  if (soloActivos) q = q.eq("activo", true)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as ConfeccionistaRow[]
}

export async function createConfeccionista(
  input: {
    nombre_completo: string
    telefono?: string | null
    celular?: string | null
    direccion?: string | null
    barrio?: string | null
    fecha_nacimiento?: string | null
    url_foto_cedula?: string | null
  },
  creadoPor: number
): Promise<number> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("confeccionista")
    .insert({
      nombre_completo: input.nombre_completo.trim(),
      telefono: input.telefono ?? null,
      celular: input.celular ?? null,
      direccion: input.direccion ?? null,
      barrio: input.barrio ?? null,
      fecha_nacimiento: input.fecha_nacimiento ?? null,
      url_foto_cedula: input.url_foto_cedula ?? null,
      creado_por: creadoPor,
    })
    .select("id")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Error creando confeccionista")
  return data.id
}

export async function updateConfeccionista(
  id: number,
  input: Partial<{
    nombre_completo: string
    telefono: string | null
    celular: string | null
    direccion: string | null
    barrio: string | null
    fecha_nacimiento: string | null
    url_foto_cedula: string | null
    activo: boolean
  }>
): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("confeccionista").update(input).eq("id", id)
  if (error) throw new Error(error.message)
}

export async function deleteConfeccionista(id: number): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("confeccionista").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

export async function uploadFotoCedulaConfeccionista(
  file: File,
  confeccionistaId: number
): Promise<string> {
  const db = createVanessaClient()
  const ext = file.name.split(".").pop() ?? "jpg"
  const path = `confeccionistas/${confeccionistaId}/cedula_${Date.now()}.${ext}`
  const buffer = await file.arrayBuffer()
  const { error } = await db.storage
    .from("documentos")
    .upload(path, buffer, { contentType: file.type, upsert: true })
  if (error) throw new Error(error.message)
  const { data } = db.storage.from("documentos").getPublicUrl(path)
  return data.publicUrl
}
