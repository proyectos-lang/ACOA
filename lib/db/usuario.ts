import { createVanessaClient } from "@/lib/supabase/vanessa"
import bcrypt from "bcryptjs"
import { createPermisoVacio } from "@/lib/db/permiso"

export interface UsuarioRow {
  id: number
  nombre_usuario: string
  nombre_completo: string | null
  activo: boolean
  persona_id: number | null
  creado_en: string
  actualizado_en: string
}

export interface UsuarioConPersona extends UsuarioRow {
  persona: { nombre: string; documento: string } | null
}

export async function getUsuarioPorNombre(nombreUsuario: string) {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("usuario")
    .select("id, nombre_usuario, contrasena_hash, nombre_completo, activo")
    .eq("nombre_usuario", nombreUsuario.trim().toLowerCase())
    .single()

  if (error || !data) return null
  return data as {
    id: number
    nombre_usuario: string
    contrasena_hash: string
    nombre_completo: string | null
    activo: boolean
  }
}

export async function listUsuarios(): Promise<UsuarioConPersona[]> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("usuario")
    .select("id, nombre_usuario, nombre_completo, activo, persona_id, creado_en, actualizado_en, persona(nombre, documento)")
    .order("id")

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as UsuarioConPersona[]
}

export async function getUsuarioById(id: number): Promise<UsuarioRow | null> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("usuario")
    .select("id, nombre_usuario, nombre_completo, activo, persona_id, creado_en, actualizado_en")
    .eq("id", id)
    .single()

  if (error || !data) return null
  return data as UsuarioRow
}

export async function createUsuario(input: {
  nombre_usuario: string
  contrasena: string
  nombre_completo: string
  activo: boolean
  persona_id?: number | null
  creado_por: number
}): Promise<number> {
  const db = createVanessaClient()
  const hash = await bcrypt.hash(input.contrasena, 10)

  const { data, error } = await db
    .from("usuario")
    .insert({
      nombre_usuario: input.nombre_usuario.trim().toLowerCase(),
      contrasena_hash: hash,
      nombre_completo: input.nombre_completo.trim(),
      activo: input.activo,
      persona_id: input.persona_id ?? null,
      creado_por: input.creado_por,
    })
    .select("id")
    .single()

  if (error || !data) throw new Error(error?.message ?? "Error creando usuario")

  // Crear fila de permisos vacía automáticamente
  await createPermisoVacio(data.id, input.creado_por)

  return data.id
}

export async function updateUsuario(
  id: number,
  input: {
    nombre_completo?: string
    activo?: boolean
    contrasena?: string
    persona_id?: number | null
  }
): Promise<void> {
  const db = createVanessaClient()
  const updates: Record<string, unknown> = {}

  if (input.nombre_completo !== undefined) updates.nombre_completo = input.nombre_completo.trim()
  if (input.activo !== undefined) updates.activo = input.activo
  if (input.persona_id !== undefined) updates.persona_id = input.persona_id
  if (input.contrasena && input.contrasena.length >= 6) {
    updates.contrasena_hash = await bcrypt.hash(input.contrasena, 10)
  }

  if (Object.keys(updates).length === 0) return
  const { error } = await db.from("usuario").update(updates).eq("id", id)
  if (error) throw new Error(error.message)
}

export async function deleteUsuario(id: number): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("usuario").delete().eq("id", id)
  if (error) throw new Error(error.message)
}
