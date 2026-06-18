import { createVanessaClient } from "@/lib/supabase/vanessa"

export const PERMISO_MODULOS = [
  { key: "mod_configuracion",    label: "Configuración" },
  { key: "mod_usuarios",         label: "Usuarios" },
  { key: "mod_personal",         label: "Personal" },
  { key: "mod_asistencia",       label: "Asistencia" },
  { key: "mod_nomina",           label: "Nómina" },
  { key: "mod_orden_produccion", label: "Orden de Producción" },
  { key: "mod_diseno",           label: "Diseño" },
  { key: "mod_corte",            label: "Corte" },
  { key: "mod_estampacion",      label: "Estampación" },
  { key: "mod_confeccion",       label: "Confección" },
  { key: "mod_conteo",           label: "Conteo" },
  { key: "mod_empaque",          label: "Empaque" },
  { key: "mod_seguimiento",      label: "Seguimiento" },
  { key: "ver_costos",           label: "Ver Costos" },
] as const

export type PermisoKey = (typeof PERMISO_MODULOS)[number]["key"]

export interface PermisoRow {
  id: number
  usuario_id: number
  mod_configuracion: boolean
  mod_usuarios: boolean
  mod_personal: boolean
  mod_asistencia: boolean
  mod_nomina: boolean
  mod_orden_produccion: boolean
  mod_diseno: boolean
  mod_corte: boolean
  mod_estampacion: boolean
  mod_confeccion: boolean
  mod_conteo: boolean
  mod_empaque: boolean
  mod_seguimiento: boolean
  ver_costos: boolean
}

export async function getPermiso(usuarioId: number): Promise<PermisoRow | null> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("permiso")
    .select("*")
    .eq("usuario_id", usuarioId)
    .single()

  if (error || !data) return null
  return data as PermisoRow
}

export async function createPermisoVacio(usuarioId: number, creadoPor: number): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("permiso").insert({
    usuario_id: usuarioId,
    creado_por: creadoPor,
  })
  if (error) throw new Error(error.message)
}

export async function updatePermiso(
  usuarioId: number,
  permisos: Partial<Record<PermisoKey, boolean>>
): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db
    .from("permiso")
    .update(permisos)
    .eq("usuario_id", usuarioId)
  if (error) throw new Error(error.message)
}
