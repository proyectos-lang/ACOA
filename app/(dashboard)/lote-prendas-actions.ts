"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import {
  createPrenda,
  updatePrenda,
  deletePrenda,
  sincronizarPreciosProcesoLote,
  type PrendaEstado,
} from "@/lib/db/lote-prenda"

type ActionResult = { error?: string; success?: boolean; id?: number }

function revalidarFichas(loteId: number) {
  for (const p of [
    `/estampacion/${loteId}`,
    `/confeccion/${loteId}`,
    `/conteo/${loteId}`,
  ]) revalidatePath(p)
}

export async function crearPrendaAction(
  loteId: number,
  nombre: string,
  estadoInicial: PrendaEstado
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  if (!nombre.trim()) return { error: "Escribe el nombre de la prenda (ej: Camiseta, Pantalón)" }

  try {
    const id = await createPrenda(loteId, nombre, estadoInicial, session.userId)
    await sincronizarPreciosProcesoLote(loteId, session.userId)
    revalidarFichas(loteId)
    return { success: true, id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error creando la prenda" }
  }
}

export async function actualizarPrendaAction(
  prendaId: number,
  loteId: number,
  campos: {
    nombre?: string
    nombre_estampador?: string | null
    est_precio?: number | null
    est_fecha_entrega?: string | null
    est_fecha_estimada?: string | null
    est_fecha_retorno?: string | null
    nombre_confeccionista?: string | null
    conf_precio?: number | null
    conf_fecha_entrega?: string | null
    conf_fecha_estimada?: string | null
    conf_fecha_retorno?: string | null
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

export async function avanzarPrendaAction(
  prendaId: number,
  loteId: number,
  nuevoEstado: PrendaEstado
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await updatePrenda(prendaId, { estado: nuevoEstado })
    revalidarFichas(loteId)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error avanzando la prenda" }
  }
}

export async function eliminarPrendaAction(
  prendaId: number,
  loteId: number
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await deletePrenda(prendaId)
    await sincronizarPreciosProcesoLote(loteId, session.userId)
    revalidarFichas(loteId)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error eliminando la prenda" }
  }
}
