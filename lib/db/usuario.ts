import { createVanessaClient } from "@/lib/supabase/vanessa"
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

type UsuarioLogin = {
  id: number
  nombre_usuario: string
  contrasena_hash: string
  nombre_completo: string | null
  activo: boolean
}

export async function getUsuarioPorNombre(nombreUsuario: string) {
  const db = createVanessaClient()
  const buscado = nombreUsuario.trim().toLowerCase()
  const COLS = "id, nombre_usuario, contrasena_hash, nombre_completo, activo"

  // Coincidencia exacta (los usuarios se crean en minúsculas)
  const { data } = await db
    .from("usuario")
    .select(COLS)
    .eq("nombre_usuario", buscado)
    .maybeSingle()
  if (data) return data as UsuarioLogin

  // Respaldo sin distinguir mayúsculas: usuarios cargados manualmente en la
  // base de datos pueden tener el nombre con mayúsculas o espacios
  const { data: alt } = await db
    .from("usuario")
    .select(COLS)
    .ilike("nombre_usuario", buscado)
    .limit(1)
  return (alt?.[0] as UsuarioLogin | undefined) ?? null
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

  const { data, error } = await db
    .from("usuario")
    .insert({
      nombre_usuario: input.nombre_usuario.trim().toLowerCase(),
      // Decisión del negocio: la contraseña se guarda en texto plano
      // (el login compara texto plano; ver app/login/actions.ts).
      // Se recortan espacios accidentales para que coincida con el login.
      contrasena_hash: input.contrasena.trim(),
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
  if (input.contrasena && input.contrasena.trim().length >= 6) {
    // Texto plano, igual que en createUsuario
    updates.contrasena_hash = input.contrasena.trim()
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
