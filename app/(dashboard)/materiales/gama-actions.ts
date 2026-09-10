"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import {
  getGamaTela,
  agregarColorTela,
  eliminarColorTela,
  replaceGamaTela,
  type TelaColorRow,
} from "@/lib/db/tela-color"

type ActionResult = { error?: string; success?: boolean; colores?: TelaColorRow[] }

export async function cargarGamaTelaAction(materialId: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const colores = await getGamaTela(materialId)
    return { success: true, colores }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error cargando la gama" }
  }
}

export async function agregarColorTelaAction(
  materialId: number,
  color: string
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await agregarColorTela(materialId, color, session.userId)
    revalidatePath("/materiales")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error agregando el color" }
  }
}

export async function eliminarColorTelaAction(id: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await eliminarColorTela(id)
    revalidatePath("/materiales")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error eliminando el color" }
  }
}

// Reemplaza la gama completa (pegando una lista de colores)
export async function reemplazarGamaTelaAction(
  materialId: number,
  colores: string[]
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await replaceGamaTela(materialId, colores, session.userId)
    revalidatePath("/materiales")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error guardando la gama" }
  }
}
