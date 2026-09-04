"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import {
  createEstampador,
  updateEstampador,
  deleteEstampador,
  uploadFotoCedula,
  uploadCertificacionBancaria,
} from "@/lib/db/estampador"

export interface EstampadorActionResult {
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

export async function crearEstampadorAction(
  formData: FormData
): Promise<EstampadorActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  const campos = camposDesdeForm(formData)
  if (!campos.nombre_completo) return { error: "El nombre completo es requerido" }

  try {
    const id = await createEstampador(campos, session.userId)

    const foto = formData.get("foto_cedula") as File | null
    if (foto && foto.size > 0) {
      const url = await uploadFotoCedula(foto, id)
      await updateEstampador(id, { url_foto_cedula: url })
    }

    const certificacion = formData.get("certificacion_bancaria") as File | null
    if (certificacion && certificacion.size > 0) {
      const urlCert = await uploadCertificacionBancaria(certificacion, id)
      await updateEstampador(id, { url_certificacion_bancaria: urlCert })
    }

    revalidatePath("/estampadores")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error creando estampador" }
  }
}

export async function editarEstampadorAction(
  id: number,
  formData: FormData
): Promise<EstampadorActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  const campos = camposDesdeForm(formData)
  if (!campos.nombre_completo) return { error: "El nombre completo es requerido" }

  try {
    await updateEstampador(id, campos)

    const foto = formData.get("foto_cedula") as File | null
    if (foto && foto.size > 0) {
      const url = await uploadFotoCedula(foto, id)
      await updateEstampador(id, { url_foto_cedula: url })
    }

    const certificacion = formData.get("certificacion_bancaria") as File | null
    if (certificacion && certificacion.size > 0) {
      const urlCert = await uploadCertificacionBancaria(certificacion, id)
      await updateEstampador(id, { url_certificacion_bancaria: urlCert })
    }

    revalidatePath("/estampadores")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error actualizando estampador" }
  }
}

export async function toggleEstampadorActivoAction(
  id: number,
  activo: boolean
): Promise<EstampadorActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  try {
    await updateEstampador(id, { activo })
    revalidatePath("/estampadores")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error actualizando estampador" }
  }
}

export async function eliminarEstampadorAction(id: number): Promise<EstampadorActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  try {
    await deleteEstampador(id)
    revalidatePath("/estampadores")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error eliminando estampador" }
  }
}
