"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import { guardarConfeccion, uploadImagenConfeccion, replaceInsumos, getConfeccionByLote } from "@/lib/db/confeccion"
import { createNovedadProceso, deleteNovedadProceso } from "@/lib/db/novedad-proceso"
import { getLoteById, updateLoteEstado, sincronizarEstadoOrdenDesdeLotes } from "@/lib/db/lote"
import { getOrdenById } from "@/lib/db/orden-produccion"
import {
  listPrendasByLote,
  updatePrenda,
  sincronizarEstadoLoteDesdePrendas,
} from "@/lib/db/lote-prenda"
import { sumarDiasSinDomingo, hoyBogota } from "@/lib/fechas-habiles"

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
    // El precio del lote nunca queda null: si el formulario no lo trae
    // (OPs tipo conjunto), se usa la suma de los precios de sus prendas
    let precioFinal = precioRaw ? parseFloat(precioRaw) : null
    if (precioFinal == null || isNaN(precioFinal)) {
      const prendas = await listPrendasByLote(loteId)
      precioFinal = prendas.reduce((s, p) => s + (Number(p.conf_precio) || 0), 0)
    }

    let urlImagen: string | undefined
    const file = formData.get("imagen") as File | null
    if (file && file.size > 0) {
      urlImagen = await uploadImagenConfeccion(file, loteId)
    }

    // La fecha estimada se calcula con los días de entrega (sin domingos)
    const fechaEntrega = (formData.get("fecha_entrega_lote") as string) || null
    const diasRaw = formData.get("dias_entrega") as string
    const diasNum = diasRaw ? parseInt(diasRaw, 10) : NaN
    const diasEntrega = !isNaN(diasNum) && diasNum > 0 ? diasNum : null
    const fechaEstimada = diasEntrega
      ? sumarDiasSinDomingo(fechaEntrega || hoyBogota(), diasEntrega)
      : (formData.get("fecha_estimada_entrega") as string) || null

    await guardarConfeccion({
      lote_id: loteId,
      cantidad_reconfirmada: cantidadRaw ? parseInt(cantidadRaw, 10) : null,
      nombre_confeccionista: (formData.get("nombre_confeccionista") as string)?.trim() || null,
      precio_confeccion: precioFinal,
      fecha_entrega_lote: fechaEntrega,
      dias_entrega: diasEntrega,
      fecha_estimada_entrega: fechaEstimada,
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

// Enviar a conteo exige el registro real de la etapa: fecha de retorno y
// cuantas unidades volvieron del confeccionista (cantidad_reconfirmada).
// Antes bastaba con que la fila de confeccion existiera. En los conjuntos
// se exige por pieza y el envio avanza las piezas que sigan en confeccion.
export async function enviarAConteoAction(loteId: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const lote = await getLoteById(loteId)
    if (!lote) return { error: "Lote no encontrado" }
    const orden = await getOrdenById(lote.orden_id)

    if (orden?.tipo_prenda === "conjunto") {
      const prendas = await listPrendasByLote(loteId)
      if (prendas.length === 0) return { error: "El lote no tiene piezas registradas" }
      const pendientes = prendas.filter((p) => p.estado === "confeccion")
      for (const p of pendientes) {
        if (!p.conf_fecha_retorno) {
          return { error: `Falta la fecha de retorno de la pieza "${p.nombre}"` }
        }
        if (p.conf_cantidad_recibida == null) {
          return {
            error: `Falta registrar cuántas unidades de "${p.nombre}" volvieron de confección`,
          }
        }
      }
      for (const p of pendientes) await updatePrenda(p.id, { estado: "conteo" })
      await sincronizarEstadoLoteDesdePrendas(loteId)
    } else {
      const confeccion = await getConfeccionByLote(loteId)
      if (!confeccion) {
        return { error: "Registre la información de confección antes de enviar a conteo." }
      }
      if (!confeccion.fecha_retorno_lote) {
        return { error: "Registra la fecha de retorno del lote antes de enviarlo a conteo" }
      }
      if (confeccion.cantidad_reconfirmada == null) {
        return {
          error: "Registra cuántas unidades volvieron de confección antes de enviar el lote",
        }
      }
      await updateLoteEstado(loteId, "conteo")
    }

    await sincronizarEstadoOrdenDesdeLotes(lote.orden_id)

    revalidatePath(`/confeccion/${loteId}`)
    revalidatePath("/confeccion")
    revalidatePath("/conteo")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error enviando a conteo" }
  }
}
