"use server"

import { getSession } from "@/lib/auth/session"
import { guardarEstampacion, getEstampacionByLote } from "@/lib/db/estampacion"
import { createNovedadProceso, deleteNovedadProceso } from "@/lib/db/novedad-proceso"
import { getLoteById, getLotesByOrden, updateLoteEstado } from "@/lib/db/lote"
import { cambiarEstado } from "@/lib/db/orden-produccion"
import { revalidatePath } from "next/cache"

type ActionResult = { error?: string; success?: boolean }

export async function guardarEstampacionAction(
  loteId: number,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const precio = parseFloat(formData.get("precio_estampacion") as string)
    await guardarEstampacion({
      lote_id: loteId,
      nombre_estampador: (formData.get("nombre_estampador") as string)?.trim() || null,
      precio_estampacion: isNaN(precio) ? null : precio,
      fecha_entrega_lote: (formData.get("fecha_entrega_lote") as string) || null,
      fecha_retorno_lote: (formData.get("fecha_retorno_lote") as string) || null,
      observaciones_estampado:
        (formData.get("observaciones_estampado") as string)?.trim() || null,
      creado_por: session.userId,
    })
    revalidatePath(`/estampacion/${loteId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error guardando estampación" }
  }
}

export async function crearNovedadProcesoAction(input: {
  lote_id: number
  tipo: string
  cantidad: number
  valor: number
  descripcion?: string
}): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await createNovedadProceso({
      lote_id: input.lote_id,
      proceso: "estampacion",
      tipo: input.tipo as "reposicion" | "averia" | "dano" | "cobro" | "compra",
      cantidad: input.cantidad,
      valor: input.valor,
      descripcion: input.descripcion?.trim() || null,
      creado_por: session.userId,
    })
    revalidatePath(`/estampacion/${input.lote_id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error registrando novedad" }
  }
}

export async function eliminarNovedadProcesoAction(
  novedadId: number,
  loteId: number
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await deleteNovedadProceso(novedadId)
    revalidatePath(`/estampacion/${loteId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error eliminando novedad" }
  }
}

export async function enviarAConfeccionAction(loteId: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const [lote, estampacion] = await Promise.all([
      getLoteById(loteId),
      getEstampacionByLote(loteId),
    ])
    if (!lote) return { error: "Lote no encontrado" }
    if (!estampacion) {
      return { error: "Registre la información de estampación antes de enviar a confección." }
    }

    await updateLoteEstado(loteId, "confeccion")

    // Si todos los lotes de la OP están en confección, avanzar la OP
    const todos = await getLotesByOrden(lote.orden_id)
    if (todos.every((l) => l.id === loteId || l.estado === "confeccion")) {
      await cambiarEstado(lote.orden_id, "confeccion")
    }

    revalidatePath(`/estampacion/${loteId}`)
    revalidatePath("/estampacion")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error enviando a confección" }
  }
}
