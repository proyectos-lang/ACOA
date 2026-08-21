"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import {
  createConfeccionista,
  updateConfeccionista,
  deleteConfeccionista,
  uploadFotoCedulaConfeccionista,
} from "@/lib/db/confeccionista"

export interface ConfeccionistaActionResult {
  error?: string
  success?: boolean
}

function camposDesdeForm(formData: FormData) {
  return {
    nombre_completo: ((formData.get("nombre_completo") as string) ?? "").trim(),
    telefono: ((formData.get("telefono") as string) ?? "").trim() || null,
    celular: ((formData.get("celular") as string) ?? "").trim() || null,
    direccion: ((formData.get("direccion") as string) ?? "").trim() || null,
    barrio: ((formData.get("barrio") as string) ?? "").trim() || null,
    fecha_nacimiento: ((formData.get("fecha_nacimiento") as string) ?? "") || null,
  }
}

export async function crearConfeccionistaAction(
  formData: FormData
): Promise<ConfeccionistaActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  const campos = camposDesdeForm(formData)
  if (!campos.nombre_completo) return { error: "El nombre completo es requerido" }

  try {
    const id = await createConfeccionista(campos, session.userId)

    const foto = formData.get("foto_cedula") as File | null
    if (foto && foto.size > 0) {
      const url = await uploadFotoCedulaConfeccionista(foto, id)
      await updateConfeccionista(id, { url_foto_cedula: url })
    }

    revalidatePath("/confeccionistas")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error creando confeccionista" }
  }
}

export async function editarConfeccionistaAction(
  id: number,
  formData: FormData
): Promise<ConfeccionistaActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  const campos = camposDesdeForm(formData)
  if (!campos.nombre_completo) return { error: "El nombre completo es requerido" }

  try {
    await updateConfeccionista(id, campos)

    const foto = formData.get("foto_cedula") as File | null
    if (foto && foto.size > 0) {
      const url = await uploadFotoCedulaConfeccionista(foto, id)
      await updateConfeccionista(id, { url_foto_cedula: url })
    }

    revalidatePath("/confeccionistas")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error actualizando confeccionista" }
  }
}

export async function toggleConfeccionistaActivoAction(
  id: number,
  activo: boolean
): Promise<ConfeccionistaActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  try {
    await updateConfeccionista(id, { activo })
    revalidatePath("/confeccionistas")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error actualizando confeccionista" }
  }
}

export async function eliminarConfeccionistaAction(
  id: number
): Promise<ConfeccionistaActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  try {
    await deleteConfeccionista(id)
    revalidatePath("/confeccionistas")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error eliminando confeccionista" }
  }
}
