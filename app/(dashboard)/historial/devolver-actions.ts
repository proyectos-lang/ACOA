"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import { getPermiso } from "@/lib/db/permiso"
import {
  previsualizarDevolucion,
  devolverLoteAlProcesoAnterior,
  listLotesEnProceso,
  type ResumenDevolucion,
  type LoteEnProceso,
} from "@/lib/db/devolver-proceso"

type ActionResult = {
  error?: string
  success?: boolean
  resumen?: ResumenDevolucion
  lotes?: LoteEnProceso[]
  destino?: string
}

// Devolver borra lo registrado en el proceso actual: es del administrador
async function requireAdmin(): Promise<number | null> {
  const session = await getSession()
  if (!session) return null
  const permiso = await getPermiso(session.userId)
  return permiso?.mod_usuarios === true ? session.userId : null
}

export async function cargarLotesEnProcesoAction(input?: {
  estado?: string | null
  texto?: string
}): Promise<ActionResult> {
  const userId = await requireAdmin()
  if (!userId) return { error: "Solo el administrador puede devolver procesos" }

  try {
    const lotes = await listLotesEnProceso(input)
    return { success: true, lotes }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error cargando los lotes" }
  }
}

// Que se va a borrar, para mostrarlo antes de confirmar
export async function previsualizarDevolucionAction(
  loteId: number
): Promise<ActionResult> {
  const userId = await requireAdmin()
  if (!userId) return { error: "Solo el administrador puede devolver procesos" }

  try {
    const resumen = await previsualizarDevolucion(loteId)
    return { success: true, resumen }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error revisando el lote" }
  }
}

export async function devolverLoteAction(loteId: number): Promise<ActionResult> {
  const userId = await requireAdmin()
  if (!userId) return { error: "Solo el administrador puede devolver procesos" }

  try {
    const r = await devolverLoteAlProcesoAnterior(loteId, userId)
    for (const ruta of [
      "/historial",
      "/corte",
      "/estampacion",
      "/confeccion",
      "/conteo",
      "/empaque",
      "/inventario",
      "/produccion",
      "/seguimiento",
      "/trazabilidad",
    ]) {
      revalidatePath(ruta)
    }
    return { success: true, destino: r.destino }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error devolviendo el lote" }
  }
}
