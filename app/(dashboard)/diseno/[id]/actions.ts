"use server"

import { getSession } from "@/lib/auth/session"
import {
  guardarDiseno,
  uploadImagenDiseno,
  aprobarDiseno,
  getDisenoByOrden,
} from "@/lib/db/diseno"
import { cambiarEstado } from "@/lib/db/orden-produccion"
import { revalidatePath } from "next/cache"

type ActionResult = { error?: string; success?: boolean }

export async function guardarDisenoAction(
  ordenId: number,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const especificaciones_confirmacion =
      (formData.get("especificaciones_confirmacion") as string)?.trim() || null
    const carta_color = (formData.get("carta_color") as string)?.trim() || null
    const especificaciones_diseno =
      (formData.get("especificaciones_diseno") as string)?.trim() || null
    const file = formData.get("imagen_prenda") as File | null

    const input: Parameters<typeof guardarDiseno>[0] = {
      orden_id: ordenId,
      especificaciones_confirmacion,
      carta_color,
      especificaciones_diseno,
      creado_por: session.userId,
    }

    if (file && file.size > 0) {
      input.url_imagen_prenda = await uploadImagenDiseno(file, ordenId)
    }

    await guardarDiseno(input)
    revalidatePath(`/diseno/${ordenId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error guardando diseño" }
  }
}

export async function aprobarDisenoAction(ordenId: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const diseno = await getDisenoByOrden(ordenId)
    if (!diseno?.url_imagen_prenda) {
      return { error: "Debe subir la imagen de la prenda antes de aprobar" }
    }
    await aprobarDiseno(ordenId)
    await cambiarEstado(ordenId, "corte")
    revalidatePath(`/diseno/${ordenId}`)
    revalidatePath("/diseno")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error aprobando diseño" }
  }
}
