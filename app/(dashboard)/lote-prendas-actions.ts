"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import {
  listPrendasByLote,
  updatePrenda,
  sincronizarPreciosProcesoLote,
  sincronizarEstadoLoteDesdePrendas,
  PRENDA_ESTADO_LABEL,
  type PrendaEstado,
} from "@/lib/db/lote-prenda"
import { getLoteById, sincronizarEstadoOrdenDesdeLotes, LOTE_ESTADO_LABEL } from "@/lib/db/lote"

type ActionResult = { error?: string; success?: boolean; aviso?: string }

// Las piezas se crean y se retiran desde la ficha de la OP (orden_pieza);
// aqui solo se registra lo que le pasa a cada una en su etapa y se avanza.

function revalidarFichas(loteId: number) {
  for (const p of [
    `/estampacion/${loteId}`,
    `/confeccion/${loteId}`,
    `/conteo/${loteId}`,
    // Los listados tambien muestran lo asignado por prenda: sin esto
    // seguian mostrando los datos viejos y parecia que no se guardaba
    "/estampacion",
    "/confeccion",
    "/conteo",
    // El estado de la pieza arrastra al lote y a la orden
    "/produccion",
    "/trazabilidad",
    "/seguimiento",
  ]) revalidatePath(p)
}

export async function actualizarPrendaAction(
  prendaId: number,
  loteId: number,
  campos: {
    nombre?: string
    nombre_estampador?: string | null
    est_precio?: number | null
    est_dias_entrega?: number | null
    est_fecha_entrega?: string | null
    est_fecha_estimada?: string | null
    est_fecha_retorno?: string | null
    est_cantidad_recibida?: number | null
    nombre_confeccionista?: string | null
    conf_precio?: number | null
    conf_dias_entrega?: number | null
    conf_fecha_entrega?: string | null
    conf_fecha_estimada?: string | null
    conf_fecha_retorno?: string | null
    conf_cantidad_recibida?: number | null
    cantidad_contada?: number | null
  }
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await updatePrenda(prendaId, campos)
    // El precio de cada prenda viaja al registro del lote (suma por proceso)
    if (campos.est_precio !== undefined || campos.conf_precio !== undefined) {
      await sincronizarPreciosProcesoLote(loteId, session.userId)
    }
    revalidarFichas(loteId)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error guardando la prenda" }
  }
}

// Avanza una pieza al siguiente proceso. Cada etapa exige su registro real
// antes de salir (fecha de retorno y cuantas unidades volvieron), y el
// cambio arrastra al lote (va donde su pieza mas atrasada) y a la orden.
export async function avanzarPrendaAction(
  prendaId: number,
  loteId: number,
  nuevoEstado: PrendaEstado
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const prendas = await listPrendasByLote(loteId)
    const prenda = prendas.find((p) => p.id === prendaId)
    if (!prenda) return { error: "Pieza no encontrada" }

    if (prenda.estado === "estampacion") {
      if (!prenda.est_fecha_retorno) {
        return {
          error: `Registra la fecha de retorno de "${prenda.nombre}" antes de enviarla a confección`,
        }
      }
      if (prenda.est_cantidad_recibida == null) {
        return {
          error: `Registra cuántas unidades de "${prenda.nombre}" volvieron de estampación antes de enviarla`,
        }
      }
    }
    if (prenda.estado === "confeccion") {
      if (!prenda.conf_fecha_retorno) {
        return {
          error: `Registra la fecha de retorno de "${prenda.nombre}" antes de enviarla a conteo`,
        }
      }
      if (prenda.conf_cantidad_recibida == null) {
        return {
          error: `Registra cuántas unidades de "${prenda.nombre}" volvieron de confección antes de enviarla`,
        }
      }
    }

    await updatePrenda(prendaId, { estado: nuevoEstado })

    const loteNuevo = await sincronizarEstadoLoteDesdePrendas(loteId)
    let aviso = `"${prenda.nombre}" → ${PRENDA_ESTADO_LABEL[nuevoEstado]}`
    if (loteNuevo) {
      aviso += ` · el lote pasó a ${LOTE_ESTADO_LABEL[loteNuevo] ?? loteNuevo}`
      const lote = await getLoteById(loteId)
      if (lote) {
        const opNueva = await sincronizarEstadoOrdenDesdeLotes(lote.orden_id)
        if (opNueva) aviso += ` y la orden a ${opNueva}`
      }
    }

    revalidarFichas(loteId)
    return { success: true, aviso }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error avanzando la prenda" }
  }
}
