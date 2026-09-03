"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import {
  habilitarPagoEstampacion,
  registrarAbono,
  eliminarAbono,
  eliminarPago,
  updatePago,
  updateAbono,
  uploadReciboPago,
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
  formData: FormData
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const valor = parseFloat(formData.get("valor") as string)
    if (isNaN(valor) || valor <= 0) return { error: "Ingresa el valor del abono" }

    // Recibo adjunto (imagen o PDF), opcional
    let urlRecibo: string | null = null
    const recibo = formData.get("recibo") as File | null
    if (recibo && recibo.size > 0) {
      urlRecibo = await uploadReciboPago(recibo, `pago_${pagoId}`)
    }

    await registrarAbono({
      pago_id: pagoId,
      valor,
      fecha: (formData.get("fecha") as string) || new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }),
      observacion: (formData.get("observacion") as string)?.trim() || null,
      url_recibo: urlRecibo,
      creado_por: session.userId,
    })
    revalidatePath("/pagos")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error registrando el abono" }
  }
}

export async function editarPagoAction(
  pagoId: number,
  campos: { beneficiario?: string; cantidad?: number; precio_unitario?: number }
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await updatePago(pagoId, campos)
    revalidatePath("/pagos")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error editando el pago" }
  }
}

export async function editarAbonoAction(
  abonoId: number,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const valorRaw = formData.get("valor") as string
    const valor = valorRaw ? parseFloat(valorRaw) : NaN
    if (isNaN(valor) || valor <= 0) return { error: "Ingresa un valor válido para el abono" }

    // Recibo adjunto: si viene archivo, reemplaza el anterior
    let urlRecibo: string | undefined
    const recibo = formData.get("recibo") as File | null
    if (recibo && recibo.size > 0) {
      urlRecibo = await uploadReciboPago(recibo, `abono_${abonoId}`)
    }

    await updateAbono(abonoId, {
      valor,
      fecha: (formData.get("fecha") as string) || undefined,
      observacion: (formData.get("observacion") as string) ?? null,
      ...(urlRecibo ? { url_recibo: urlRecibo } : {}),
    })
    revalidatePath("/pagos")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error editando el abono" }
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
