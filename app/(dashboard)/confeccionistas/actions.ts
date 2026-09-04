"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import {
  createConfeccionista,
  updateConfeccionista,
  deleteConfeccionista,
  uploadFotoCedulaConfeccionista,
  uploadCertificacionBancariaConfeccionista,
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
    banco: ((formData.get("banco") as string) ?? "").trim() || null,
    tipo_cuenta: ((formData.get("tipo_cuenta") as string) ?? "").trim() || null,
    numero_cuenta: ((formData.get("numero_cuenta") as string) ?? "").trim() || null,
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

    const certificacion = formData.get("certificacion_bancaria") as File | null
    if (certificacion && certificacion.size > 0) {
      const urlCert = await uploadCertificacionBancariaConfeccionista(certificacion, id)
      await updateConfeccionista(id, { url_certificacion_bancaria: urlCert })
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

    const certificacion = formData.get("certificacion_bancaria") as File | null
    if (certificacion && certificacion.size > 0) {
      const urlCert = await uploadCertificacionBancariaConfeccionista(certificacion, id)
      await updateConfeccionista(id, { url_certificacion_bancaria: urlCert })
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
