"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import { createColor, toggleColorActivo } from "@/lib/db/color"

export interface ColorActionResult {
  error?: string
  success?: boolean
}

export async function crearColorAction(nombre: string): Promise<ColorActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  const n = nombre.trim()
  if (!n) return { error: "El nombre es requerido" }
  try {
    await createColor(n, session.userId)
    revalidatePath("/materiales/colores")
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error creando color"
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { error: "Ya existe un color con ese nombre" }
    }
    return { error: msg }
  }
}

export async function toggleColorActivoAction(
  id: number,
  activo: boolean
): Promise<ColorActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  try {
    await toggleColorActivo(id, activo)
    revalidatePath("/materiales/colores")
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error actualizando color" }
  }
}
