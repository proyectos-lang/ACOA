"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getSession } from "@/lib/auth/session"
import { createUsuario, updateUsuario, deleteUsuario } from "@/lib/db/usuario"
import { updatePermiso, type PermisoKey } from "@/lib/db/permiso"

const crearSchema = z.object({
  nombre_usuario: z.string().min(3, "Mínimo 3 caracteres").max(50),
  nombre_completo: z.string().min(1, "Requerido"),
  contrasena: z.string().min(6, "Mínimo 6 caracteres"),
  activo: z.boolean(),
})

const editarSchema = z.object({
  nombre_completo: z.string().min(1, "Requerido"),
  contrasena: z.string().optional(),
  activo: z.boolean(),
})

export interface ActionResult {
  error?: string
  success?: boolean
}

async function requireAdmin(): Promise<number> {
  const session = await getSession()
  if (!session) throw new Error("No autorizado")
  return session.userId
}

export async function crearUsuarioAction(formData: FormData): Promise<ActionResult> {
  try {
    const creadoPor = await requireAdmin()

    const parsed = crearSchema.safeParse({
      nombre_usuario: formData.get("nombre_usuario"),
      nombre_completo: formData.get("nombre_completo"),
      contrasena: formData.get("contrasena"),
      activo: formData.get("activo") === "true",
    })

    if (!parsed.success) {
      return { error: parsed.error.errors[0].message }
    }

    await createUsuario({ ...parsed.data, creado_por: creadoPor })
    revalidatePath("/usuarios")
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error creando usuario"
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return { error: "El nombre de usuario ya existe" }
    }
    return { error: msg }
  }
}

export async function editarUsuarioAction(
  id: number,
  formData: FormData
): Promise<ActionResult> {
  try {
    await requireAdmin()

    const parsed = editarSchema.safeParse({
      nombre_completo: formData.get("nombre_completo"),
      contrasena: formData.get("contrasena") || undefined,
      activo: formData.get("activo") === "true",
    })

    if (!parsed.success) {
      return { error: parsed.error.errors[0].message }
    }

    await updateUsuario(id, parsed.data)
    revalidatePath("/usuarios")
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error editando usuario" }
  }
}

export async function eliminarUsuarioAction(id: number): Promise<ActionResult> {
  try {
    const creadoPor = await requireAdmin()
    if (id === creadoPor) return { error: "No puedes eliminar tu propio usuario" }

    await deleteUsuario(id)
    revalidatePath("/usuarios")
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error eliminando usuario" }
  }
}

export async function actualizarPermisosAction(
  usuarioId: number,
  permisos: Partial<Record<PermisoKey, boolean>>
): Promise<ActionResult> {
  try {
    await requireAdmin()
    await updatePermiso(usuarioId, permisos)
    revalidatePath(`/usuarios/${usuarioId}/permisos`)
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error guardando permisos" }
  }
}
