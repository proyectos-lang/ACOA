"use server"

import { getSession } from "@/lib/auth/session"
import { guardarEstampacion, getEstampacionByLote } from "@/lib/db/estampacion"
import {
  listPrendasByLote,
  updatePrenda,
  sincronizarEstadoLoteDesdePrendas,
} from "@/lib/db/lote-prenda"
import { sumarDiasSinDomingo, hoyBogota } from "@/lib/fechas-habiles"
import { createNovedadProceso, deleteNovedadProceso } from "@/lib/db/novedad-proceso"
import { getLoteById, updateLoteEstado, sincronizarEstadoOrdenDesdeLotes } from "@/lib/db/lote"
import { getOrdenById } from "@/lib/db/orden-produccion"
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
    // El precio del lote nunca queda null: si el formulario no lo trae
    // (OPs tipo conjunto), se usa la suma de los precios de sus prendas
    let precioFinal = isNaN(precio) ? null : precio
    if (precioFinal == null) {
      const prendas = await listPrendasByLote(loteId)
      precioFinal = prendas.reduce((s, p) => s + (Number(p.est_precio) || 0), 0)
    }
    // La fecha estimada se calcula con los días de entrega (sin domingos)
    // desde la fecha de entrega del lote; si no hay días, se usa la fecha
    // que venga en el formulario
    const fechaEntrega = (formData.get("fecha_entrega_lote") as string) || null
    const diasRaw = formData.get("dias_entrega") as string
    const dias = diasRaw ? parseInt(diasRaw, 10) : NaN
    const diasEntrega = !isNaN(dias) && dias > 0 ? dias : null
    const fechaEstimada = diasEntrega
      ? sumarDiasSinDomingo(fechaEntrega || hoyBogota(), diasEntrega)
      : (formData.get("fecha_estimada_entrega") as string) || null

    // Unidades que volvieron del estampador: vacio = aun no se recibio
    const recibidaRaw = (formData.get("cantidad_recibida") as string | null) ?? ""
    const cantidadRecibida = recibidaRaw.trim() === "" ? null : parseInt(recibidaRaw, 10)
    if (cantidadRecibida != null && (Number.isNaN(cantidadRecibida) || cantidadRecibida < 0)) {
      return { error: "Las unidades recibidas deben ser un número mayor o igual a 0" }
    }

    await guardarEstampacion({
      lote_id: loteId,
      nombre_estampador: (formData.get("nombre_estampador") as string)?.trim() || null,
      precio_estampacion: precioFinal,
      fecha_entrega_lote: fechaEntrega,
      dias_entrega: diasEntrega,
      fecha_estimada_entrega: fechaEstimada,
      fecha_retorno_lote: (formData.get("fecha_retorno_lote") as string) || null,
      cantidad_recibida: cantidadRecibida,
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

// Enviar a confeccion exige el registro real de la etapa: fecha de retorno
// y cuantas unidades volvieron del estampador. Antes bastaba con que la
// fila de estampacion existiera. En los conjuntos se exige por pieza, y el
// envio del lote avanza las piezas que sigan en estampacion para que lote
// y piezas no se desalineen (la base tenia 34 piezas desfasadas por eso).
export async function enviarAConfeccionAction(loteId: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const lote = await getLoteById(loteId)
    if (!lote) return { error: "Lote no encontrado" }
    const orden = await getOrdenById(lote.orden_id)

    if (orden?.tipo_prenda === "conjunto") {
      const prendas = await listPrendasByLote(loteId)
      if (prendas.length === 0) return { error: "El lote no tiene piezas registradas" }
      const pendientes = prendas.filter((p) => p.estado === "estampacion")
      for (const p of pendientes) {
        if (!p.est_fecha_retorno) {
          return { error: `Falta la fecha de retorno de la pieza "${p.nombre}"` }
        }
        if (p.est_cantidad_recibida == null) {
          return {
            error: `Falta registrar cuántas unidades de "${p.nombre}" volvieron de estampación`,
          }
        }
      }
      for (const p of pendientes) await updatePrenda(p.id, { estado: "confeccion" })
      await sincronizarEstadoLoteDesdePrendas(loteId)
    } else {
      const estampacion = await getEstampacionByLote(loteId)
      if (!estampacion) {
        return { error: "Registre la información de estampación antes de enviar a confección." }
      }
      if (!estampacion.fecha_retorno_lote) {
        return { error: "Registra la fecha de retorno del lote antes de enviarlo a confección" }
      }
      if (estampacion.cantidad_recibida == null) {
        return {
          error: "Registra cuántas unidades volvieron de estampación antes de enviar el lote",
        }
      }
      await updateLoteEstado(loteId, "confeccion")
    }

    await sincronizarEstadoOrdenDesdeLotes(lote.orden_id)

    revalidatePath(`/estampacion/${loteId}`)
    revalidatePath("/estampacion")
    revalidatePath("/confeccion")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error enviando a confección" }
  }
}
