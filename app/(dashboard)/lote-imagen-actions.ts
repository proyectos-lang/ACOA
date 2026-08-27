"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import { updateLoteDiseno, uploadImagenLote } from "@/lib/db/lote"

type ActionResult = { error?: string; success?: boolean; url?: string }

// Sube o reemplaza la imagen de referencia de un lote. Compartida por las
// fichas de Estampación y Confección (la de Diseño usa su propia action).
export async function subirImagenLoteAction(
  loteId: number,
  ordenId: number,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  const file = formData.get("imagen_lote") as File | null
  if (!file || file.size === 0) return { error: "Selecciona una imagen" }

  try {
    const url = await uploadImagenLote(file, ordenId, loteId)
    await updateLoteDiseno(loteId, { url_imagen: url })
    for (const p of [
      `/estampacion/${loteId}`,
      `/confeccion/${loteId}`,
      "/estampacion",
      "/confeccion",
      `/diseno/${ordenId}`,
      `/produccion/${ordenId}`,
    ]) revalidatePath(p)
    return { success: true, url }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error subiendo la imagen del lote" }
  }
}
