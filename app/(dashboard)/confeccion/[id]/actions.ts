"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import { guardarConfeccion, uploadImagenConfeccion, replaceInsumos, getConfeccionByLote } from "@/lib/db/confeccion"
import { createNovedadProceso, deleteNovedadProceso } from "@/lib/db/novedad-proceso"
import { getLoteById, getLotesByOrden, updateLoteEstado } from "@/lib/db/lote"
import { cambiarEstado } from "@/lib/db/orden-produccion"

type ActionResult = { error?: string; success?: boolean }

export async function guardarConfeccionAction(
  loteId: number,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const cantidadRaw = formData.get("cantidad_reconfirmada") as string
    const precioRaw = formData.get("precio_confeccion") as string

    let urlImagen: string | undefined
    const file = formData.get("imagen") as File | null
    if (file && file.size > 0) {
      urlImagen = await uploadImagenConfeccion(file, loteId)
    }

    await guardarConfeccion({
      lote_id: loteId,
      cantidad_reconfirmada: cantidadRaw ? parseInt(cantidadRaw, 10) : null,
      nombre_confeccionista: (formData.get("nombre_confeccionista") as string)?.trim() || null,
      precio_confeccion: precioRaw ? parseFloat(precioRaw) : null,
      fecha_entrega_lote: (formData.get("fecha_entrega_lote") as string) || null,
      fecha_retorno_lote: (formData.get("fecha_retorno_lote") as string) || null,
      condiciones_confeccion: (formData.get("condiciones_confeccion") as string)?.trim() || null,
      ...(urlImagen !== undefined ? { url_imagen_prenda: urlImagen } : {}),
      creado_por: session.userId,
    })
    revalidatePath(`/confeccion/${loteId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error guardando confección" }
  }
}

export async function guardarInsumosAction(
  confeccionId: number,
  loteId: number,
  filas: Array<{ nombre: string; valor: number }>
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await replaceInsumos(confeccionId, filas, session.userId)
    revalidatePath(`/confeccion/${loteId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error guardando insumos" }
  }
}

export async function crearNovedadConfeccionAction(input: {
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
      proceso: "confeccion",
      tipo: input.tipo as "reposicion" | "averia" | "dano" | "cobro" | "compra",
      cantidad: input.cantidad,
      valor: input.valor,
      descripcion: input.descripcion?.trim() || null,
      creado_por: session.userId,
    })
    revalidatePath(`/confeccion/${input.lote_id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error registrando novedad" }
  }
}

export async function eliminarNovedadConfeccionAction(
  novedadId: number,
  loteId: number
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await deleteNovedadProceso(novedadId)
    revalidatePath(`/confeccion/${loteId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error eliminando novedad" }
  }
}

export async function enviarAConteoAction(loteId: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const [lote, confeccion] = await Promise.all([
      getLoteById(loteId),
      getConfeccionByLote(loteId),
    ])
    if (!lote) return { error: "Lote no encontrado" }
    if (!confeccion) {
      return { error: "Registre la información de confección antes de enviar a conteo." }
    }

    await updateLoteEstado(loteId, "conteo")

    // Si todos los lotes de la OP están en conteo, avanzar la OP
    const todos = await getLotesByOrden(lote.orden_id)
    if (todos.every((l) => l.id === loteId || l.estado === "conteo")) {
      await cambiarEstado(lote.orden_id, "conteo")
    }

    revalidatePath(`/confeccion/${loteId}`)
    revalidatePath("/confeccion")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error enviando a conteo" }
  }
}
