"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import {
  getLiquidacionEmpaque,
  cerrarDiaEmpaque,
  reabrirDiaEmpaque,
  type DiaEmpaquePersona,
} from "@/lib/db/liquidacion-empaque"

type ActionResult = { error?: string; success?: boolean; dias?: DiaEmpaquePersona[] }

export async function cargarLiquidacionEmpaqueAction(input: {
  desde: string
  hasta: string
  personaId?: number | null
}): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const dias = await getLiquidacionEmpaque(input)
    return { success: true, dias }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error cargando la liquidación" }
  }
}

export async function cerrarDiaEmpaqueAction(input: {
  persona_id: number
  fecha: string
  total_unidades: number
  total_imperfectos: number
  total_valor: number
  observacion?: string
}): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await cerrarDiaEmpaque({ ...input, cerrado_por: session.userId })
    revalidatePath("/liquidacion-empaque")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error cerrando el día" }
  }
}

export async function reabrirDiaEmpaqueAction(
  personaId: number,
  fecha: string
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await reabrirDiaEmpaque(personaId, fecha)
    revalidatePath("/liquidacion-empaque")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error reabriendo el día" }
  }
}
