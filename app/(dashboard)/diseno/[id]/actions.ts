"use server"

import { getSession } from "@/lib/auth/session"
import {
  guardarDiseno,
  uploadImagenDiseno,
  aprobarDiseno,
  getDisenoByOrden,
} from "@/lib/db/diseno"
import { cambiarEstado } from "@/lib/db/orden-produccion"
import { updateLoteDiseno, uploadImagenLote, getLotesByOrden, updateLoteEstado } from "@/lib/db/lote"
import { upsertEstampacionParcial } from "@/lib/db/estampacion"
import { asegurarPrendasDeOrdenConjunto } from "@/lib/db/lote-prenda"
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

    // El estampador se puede asignar ya desde Diseño: queda registrado en
    // el proceso de estampación del lote (sin pisar sus otros datos)
    const estampador = (formData.get("nombre_estampador") as string | null)?.trim()
    if (estampador !== undefined && estampador !== null) {
      await upsertEstampacionParcial(
        loteId,
        { nombre_estampador: estampador || null },
        session.userId
      )
    }

    revalidatePath(`/diseno/${ordenId}`)
    revalidatePath(`/produccion/${ordenId}`)
    revalidatePath(`/estampacion/${loteId}`)
    revalidatePath("/estampacion")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error guardando diseño del lote" }
  }
}

export async function aprobarDisenoAction(ordenId: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
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

// Aprueba el diseño y envía los lotes directamente a Estampación, saltando
// el paso por Corte: los lotes ya existentes pasan a estado "estampacion"
// y empiezan a aparecer en la bandeja de ese módulo.
export async function aprobarYEnviarEstampacionAction(
  ordenId: number
): Promise<ActionResult & { lotesEnviados?: number }> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const lotes = await getLotesByOrden(ordenId)
    if (lotes.length === 0) {
      return {
        error:
          "Esta orden aún no tiene lotes. Créalos desde la pestaña Curva de la OP antes de enviar a estampación.",
      }
    }

    // Solo avanzan los lotes que aún no han pasado de estampación
    const porEnviar = lotes.filter((l) => l.estado === "cortado")
    if (porEnviar.length === 0) {
      return { error: "Los lotes de esta orden ya fueron enviados a estampación o están más adelante." }
    }

    const diseno = await getDisenoByOrden(ordenId)
    if (!diseno) {
      await guardarDiseno({ orden_id: ordenId, creado_por: session.userId })
    }
    await aprobarDiseno(ordenId)

    for (const l of porEnviar) {
      await updateLoteEstado(l.id, "estampacion")
    }
    await cambiarEstado(ordenId, "estampacion")

    // OPs tipo conjunto: dividir automáticamente los lotes en sus piezas
    await asegurarPrendasDeOrdenConjunto(ordenId, session.userId)

    revalidatePath(`/diseno/${ordenId}`)
    revalidatePath("/diseno")
    revalidatePath("/estampacion")
    revalidatePath(`/produccion/${ordenId}`)
    return { success: true, lotesEnviados: porEnviar.length }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error enviando a estampación" }
  }
}
