"use server"

import { getSession } from "@/lib/auth/session"
import {
  guardarDiseno,
  uploadImagenDiseno,
  aprobarDiseno,
  getDisenoByOrden,
} from "@/lib/db/diseno"
import { cambiarEstado } from "@/lib/db/orden-produccion"
import { updateLoteDiseno, uploadImagenLote, getLotesByOrden } from "@/lib/db/lote"
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

export async function guardarLoteDisenoAction(
  loteId: number,
  ordenId: number,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const notas = (formData.get("notas_diseno") as string | null)?.trim() ?? ""
    const file = formData.get("imagen_lote") as File | null

    const input: { url_imagen?: string; notas_diseno: string | null } = {
      notas_diseno: notas || null,
    }
    if (file && file.size > 0) {
      input.url_imagen = await uploadImagenLote(file, ordenId, loteId)
    }

    await updateLoteDiseno(loteId, input)
    revalidatePath(`/diseno/${ordenId}`)
    revalidatePath(`/produccion/${ordenId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error guardando diseño del lote" }
  }
}

export async function aprobarDisenoAction(ordenId: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    // Cada lote debe tener su imagen de referencia antes de aprobar
    const lotes = await getLotesByOrden(ordenId)
    const sinImagen = lotes.filter((l) => !l.url_imagen)
    if (lotes.length > 0 && sinImagen.length > 0) {
      const nombres = sinImagen
        .map((l) => l.descripcion ?? `LOTE-${String(l.numero_lote).padStart(4, "0")}`)
        .join(", ")
      return { error: `Falta la imagen de referencia en: ${nombres}` }
    }

    // Asegurar que exista el registro de diseño antes de marcar aprobado
    const diseno = await getDisenoByOrden(ordenId)
    if (!diseno) {
      await guardarDiseno({ orden_id: ordenId, creado_por: session.userId })
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
