"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import { getEstampacionByLote, upsertEstampacionParcial } from "@/lib/db/estampacion"
import { getLoteById, getLotesByOrden, updateLoteEstado } from "@/lib/db/lote"
import { getHojaCostos } from "@/lib/db/hoja-costos"
import { cambiarEstado } from "@/lib/db/orden-produccion"

type ActionResult = { error?: string; success?: boolean; procesados?: number }

function hoyBogota(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
}

// Asignación masiva: estampador + fecha de entrega (hoy) + precio automático
// desde el costo de estampación de la hoja de costos de la OP
export async function asignarEstampadorMasivoAction(
  loteIds: number[],
  nombreEstampador: string
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  if (!nombreEstampador.trim()) return { error: "Selecciona un estampador" }
  if (loteIds.length === 0) return { error: "Selecciona al menos un lote" }

  try {
    const precioPorOrden = new Map<number, number | null>()
    let procesados = 0

    for (const loteId of loteIds) {
      const lote = await getLoteById(loteId)
      if (!lote) continue

      // Costo de estampación definido en la OP (hoja de costos), cacheado por orden
      if (!precioPorOrden.has(lote.orden_id)) {
        const hoja = await getHojaCostos(lote.orden_id)
        const v = Number(hoja?.valor_estampacion_aplique_dtf) || 0
        precioPorOrden.set(lote.orden_id, v > 0 ? v : null)
      }
      const precioOP = precioPorOrden.get(lote.orden_id) ?? null

      const actual = await getEstampacionByLote(loteId)
      await upsertEstampacionParcial(
        loteId,
        {
          nombre_estampador: nombreEstampador.trim(),
          // La fecha de entrega y el precio no pisan valores ya registrados
          ...(actual?.fecha_entrega_lote ? {} : { fecha_entrega_lote: hoyBogota() }),
          ...(actual?.precio_estampacion != null && Number(actual.precio_estampacion) > 0
            ? {}
            : precioOP != null
              ? { precio_estampacion: precioOP }
              : {}),
        },
        session.userId
      )
      procesados++
    }

    revalidatePath("/estampacion")
    return { success: true, procesados }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error en la asignación masiva" }
  }
}

// Marca la fecha de entrega al estampador en todos los lotes seleccionados
export async function marcarEntregaMasivaAction(
  loteIds: number[],
  fecha: string
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  if (loteIds.length === 0) return { error: "Selecciona al menos un lote" }
  if (!fecha) return { error: "Selecciona la fecha de entrega" }

  try {
    let procesados = 0
    for (const loteId of loteIds) {
      await upsertEstampacionParcial(loteId, { fecha_entrega_lote: fecha }, session.userId)
      procesados++
    }
    revalidatePath("/estampacion")
    return { success: true, procesados }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error marcando la fecha de entrega" }
  }
}

// Marca la fecha estimada de entrega (devolución del estampador) en los
// lotes seleccionados; alimenta las alertas de vencimiento del listado
export async function marcarFechaEstimadaMasivaAction(
  loteIds: number[],
  fecha: string
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  if (loteIds.length === 0) return { error: "Selecciona al menos un lote" }
  if (!fecha) return { error: "Selecciona la fecha estimada de entrega" }

  try {
    let procesados = 0
    for (const loteId of loteIds) {
      await upsertEstampacionParcial(loteId, { fecha_estimada_entrega: fecha }, session.userId)
      procesados++
    }
    revalidatePath("/estampacion")
    return { success: true, procesados }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error marcando la fecha estimada" }
  }
}

// Recepción masiva: registra la fecha de retorno (hoy) y envía los lotes a
// Confección; la OP avanza cuando todos sus lotes ya están en confección
export async function recepcionMasivaAction(loteIds: number[]): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  if (loteIds.length === 0) return { error: "Selecciona al menos un lote" }

  try {
    const ordenesAfectadas = new Set<number>()
    let procesados = 0

    for (const loteId of loteIds) {
      const lote = await getLoteById(loteId)
      if (!lote || lote.estado !== "estampacion") continue

      const actual = await getEstampacionByLote(loteId)
      await upsertEstampacionParcial(
        loteId,
        actual?.fecha_retorno_lote ? {} : { fecha_retorno_lote: hoyBogota() },
        session.userId
      )
      await updateLoteEstado(loteId, "confeccion")
      ordenesAfectadas.add(lote.orden_id)
      procesados++
    }

    for (const ordenId of ordenesAfectadas) {
      const todos = await getLotesByOrden(ordenId)
      const activos = todos.filter((l) => l.estado !== "finalizado" && l.estado !== "completado")
      if (activos.length > 0 && activos.every((l) => l.estado !== "estampacion" && l.estado !== "cortado")) {
        await cambiarEstado(ordenId, "confeccion")
      }
    }

    revalidatePath("/estampacion")
    revalidatePath("/confeccion")
    return { success: true, procesados }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error en la recepción masiva" }
  }
}
