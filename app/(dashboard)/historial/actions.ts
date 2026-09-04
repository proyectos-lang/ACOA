"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import { getPermiso } from "@/lib/db/permiso"
import {
  listHistorial,
  updateRegistroHistorial,
  deleteRegistroHistorial,
  type RegistroHistorial,
} from "@/lib/db/historial"

type ActionResult = { error?: string; success?: boolean; registros?: RegistroHistorial[] }

// El historial es exclusivo del administrador (permiso de Usuarios)
async function requireAdmin(): Promise<boolean> {
  const session = await getSession()
  if (!session) return false
  const permiso = await getPermiso(session.userId)
  return permiso?.mod_usuarios === true
}

export async function cargarHistorialAction(moduloKey: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { error: "Solo el administrador puede ver el historial" }

  try {
    const registros = await listHistorial(moduloKey)
    return { success: true, registros }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error cargando el historial" }
  }
}

export async function editarRegistroHistorialAction(
  moduloKey: string,
  registroId: number,
  campos: Record<string, unknown>
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { error: "Solo el administrador puede editar el historial" }

  try {
    await updateRegistroHistorial(moduloKey, registroId, campos)
    revalidatePath("/historial")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error guardando los cambios" }
  }
}

export async function eliminarRegistroHistorialAction(
  moduloKey: string,
  registroId: number
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { error: "Solo el administrador puede eliminar registros" }

  try {
    await deleteRegistroHistorial(moduloKey, registroId)
    revalidatePath("/historial")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error eliminando el registro" }
  }
}
