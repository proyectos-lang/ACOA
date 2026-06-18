"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import { upsertConteo, replaceConteoDetalle, validarConteo } from "@/lib/db/conteo"
import { getLoteById, getLotesByOrden, updateLoteEstado } from "@/lib/db/lote"
import { cambiarEstado } from "@/lib/db/orden-produccion"

type ActionResult = { error?: string; success?: boolean; total_contado?: number }

export async function guardarConteoAction(
  loteId: number,
  formData: FormData,
  filas: Array<{ color: string; talla: string; cantidad_contada: number }>
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const conteoId = await upsertConteo({
      lote_id: loteId,
      fecha_conteo: (formData.get("fecha_conteo") as string) || null,
      observacion: (formData.get("observacion") as string)?.trim() || null,
      creado_por: session.userId,
    })

    const total = await replaceConteoDetalle(conteoId, filas, session.userId)
    revalidatePath(`/conteo/${loteId}`)
    return { success: true, total_contado: total }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error guardando conteo" }
  }
}

export async function validarConteoAction(
  loteId: number,
  formData: FormData,
  filas: Array<{ color: string; talla: string; cantidad_contada: number }>
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const lote = await getLoteById(loteId)
    if (!lote) return { error: "Lote no encontrado" }

    // Guardar conteo primero (garantiza que la fila existe antes de validar)
    const fechaHoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
    const conteoId = await upsertConteo({
      lote_id: loteId,
      fecha_conteo: (formData.get("fecha_conteo") as string) || fechaHoy,
      observacion: (formData.get("observacion") as string)?.trim() || null,
      creado_por: session.userId,
    })
    const total = await replaceConteoDetalle(conteoId, filas, session.userId)

    if (total === 0) {
      return { error: "El total contado es 0. Ingrese las cantidades antes de validar." }
    }

    // Marcar como validado y avanzar el lote
    await validarConteo(loteId)
    await updateLoteEstado(loteId, "empaque")

    // Si todos los lotes de la OP están en empaque, avanzar la OP
    const todos = await getLotesByOrden(lote.orden_id)
    if (todos.every((l) => l.id === loteId || l.estado === "empaque")) {
      await cambiarEstado(lote.orden_id, "empaque")
    }

    revalidatePath(`/conteo/${loteId}`)
    revalidatePath("/conteo")
    return { success: true, total_contado: total }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error validando conteo" }
  }
}
