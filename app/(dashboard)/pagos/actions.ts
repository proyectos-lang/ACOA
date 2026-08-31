"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import {
  habilitarPagoEstampacion,
  registrarAbono,
  eliminarAbono,
  eliminarPago,
} from "@/lib/db/pago"

type ActionResult = { error?: string; success?: boolean; count?: number }

export async function habilitarPagoEstampacionAction(
  loteId: number
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const count = await habilitarPagoEstampacion(loteId, session.userId)
    revalidatePath("/pagos")
    revalidatePath(`/estampacion/${loteId}`)
    return { success: true, count }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error habilitando el pago" }
  }
}

export async function registrarAbonoAction(
  pagoId: number,
  input: { valor: number; fecha: string; observacion?: string }
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await registrarAbono({
      pago_id: pagoId,
      valor: input.valor,
      fecha: input.fecha,
      observacion: input.observacion ?? null,
      creado_por: session.userId,
    })
    revalidatePath("/pagos")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error registrando el abono" }
  }
}

export async function eliminarAbonoAction(abonoId: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await eliminarAbono(abonoId)
    revalidatePath("/pagos")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error eliminando el abono" }
  }
}

export async function eliminarPagoAction(pagoId: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await eliminarPago(pagoId)
    revalidatePath("/pagos")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error eliminando el pago" }
  }
}
