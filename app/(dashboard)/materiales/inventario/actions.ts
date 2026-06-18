"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import { createMovimiento, getMovimientosByMaterial } from "@/lib/db/inventario"
import type { MovimientoRow } from "@/lib/db/inventario"

export interface InventarioActionResult {
  error?: string
  success?: boolean
}

export async function getMovimientosAction(materialId: number): Promise<MovimientoRow[]> {
  const session = await getSession()
  if (!session) return []
  return getMovimientosByMaterial(materialId)
}

export async function crearMovimientoAction(
  materialId: number,
  formData: FormData
): Promise<InventarioActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  const tipo = formData.get("tipo") as "entrada" | "salida"
  if (!tipo || !["entrada", "salida"].includes(tipo)) return { error: "Tipo inválido" }

  const concepto = formData.get("concepto") as string
  const conceptosValidos = ["compra", "ajuste", "devolucion", "op_consumo", "otro"]
  if (!conceptosValidos.includes(concepto)) return { error: "Concepto inválido" }

  const cantidadRaw = parseFloat((formData.get("cantidad") as string | null) ?? "")
  if (isNaN(cantidadRaw) || cantidadRaw <= 0) return { error: "Cantidad debe ser mayor a 0" }

  const fecha = (formData.get("fecha") as string | null) || undefined
  const observacion = (formData.get("observacion") as string | null)?.trim() || undefined

  try {
    await createMovimiento({
      material_id: materialId,
      tipo,
      concepto: concepto as "compra" | "ajuste" | "devolucion" | "op_consumo" | "otro",
      cantidad: cantidadRaw,
      fecha,
      observacion,
      creado_por: session.userId,
    })
    revalidatePath("/materiales/inventario")
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error registrando movimiento" }
  }
}
