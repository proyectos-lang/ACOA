"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import {
  registrarMovimiento,
  eliminarMovimiento,
  getMovimientos,
  sincronizarInventarioDesdeEmpaque,
  type InventransRow,
  type TipoMovimiento,
} from "@/lib/db/inventario-producto"

type ActionResult = {
  error?: string
  success?: boolean
  count?: number
  movimientos?: InventransRow[]
}

export async function registrarMovimientoAction(input: {
  tipo: TipoMovimiento
  motivo: string
  lote_id: number | null
  prenda_nombre?: string
  talla: string
  cantidad: number
  fecha: string
  observacion?: string
}): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  if (!input.talla.trim()) return { error: "Indica la talla" }

  try {
    await registrarMovimiento({ ...input, creado_por: session.userId })
    revalidatePath("/inventario")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error registrando el movimiento" }
  }
}

export async function eliminarMovimientoAction(id: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await eliminarMovimiento(id)
    revalidatePath("/inventario")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error eliminando el movimiento" }
  }
}

export async function cargarMovimientosAction(loteId?: number | null): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const movimientos = await getMovimientos(loteId)
    return { success: true, movimientos }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error cargando los movimientos" }
  }
}

// Genera las entradas de inventario de los empaques ya registrados que
// todavía no las tienen (carga inicial del inventario)
export async function sincronizarInventarioAction(): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const count = await sincronizarInventarioDesdeEmpaque(session.userId)
    revalidatePath("/inventario")
    return { success: true, count }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error sincronizando el inventario" }
  }
}
