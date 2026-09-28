"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import {
  upsertReferenciaVenta,
  getVentasPorEmpresa,
  getResumenPorEmpresa,
  type EmpresaProducto,
  type VentaPorEmpresa,
  type ResumenEmpresa,
} from "@/lib/db/venta"
import { createVanessaClient } from "@/lib/supabase/vanessa"

type ActionResult = {
  error?: string
  success?: boolean
  ventas?: VentaPorEmpresa[]
  resumen?: ResumenEmpresa[]
  mixtas?: number
  total?: number
}

export async function guardarProductoAction(input: {
  referencia: string
  descripcion?: string
  linea?: string
  categoria?: string
  valor_unidad: number
  empresa: EmpresaProducto
}): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  if (!input.referencia.trim()) return { error: "Indica la referencia" }

  try {
    await upsertReferenciaVenta(input, session.userId)
    revalidatePath("/ventas")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error guardando el producto" }
  }
}

export async function cambiarEmpresaProductoAction(
  referenciaId: number,
  empresa: EmpresaProducto
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const db = createVanessaClient()
    const { error } = await db
      .from("referencia_venta")
      .update({ empresa })
      .eq("id", referenciaId)
    if (error) throw new Error(error.message)
    revalidatePath("/ventas")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error cambiando la empresa" }
  }
}

export async function desactivarProductoAction(
  referenciaId: number,
  activo: boolean
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const db = createVanessaClient()
    const { error } = await db
      .from("referencia_venta")
      .update({ activo })
      .eq("id", referenciaId)
    if (error) throw new Error(error.message)
    revalidatePath("/ventas")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error actualizando el producto" }
  }
}

// Registro de ventas: global (sin empresa) o de una sola empresa
export async function cargarVentasPorEmpresaAction(input?: {
  empresa?: EmpresaProducto | null
  desde?: string
  hasta?: string
  estado?: string | null
}): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const ventas = await getVentasPorEmpresa(input)
    return { success: true, ventas }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error cargando el registro" }
  }
}

export async function cargarResumenEmpresasAction(input?: {
  desde?: string
  hasta?: string
}): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const r = await getResumenPorEmpresa(input)
    return { success: true, resumen: r.resumen, mixtas: r.mixtas, total: r.total }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error cargando el resumen" }
  }
}
