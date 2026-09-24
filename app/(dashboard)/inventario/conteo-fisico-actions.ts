"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import { getPermiso } from "@/lib/db/permiso"
import {
  abrirConteoFisico,
  guardarConteoFisico,
  cerrarConteoFisico,
  anularConteoFisico,
  getConteoFisico,
  type ConteoFisicoConDetalle,
} from "@/lib/db/conteo-fisico"

type ActionResult = {
  error?: string
  success?: boolean
  conteoId?: number
  lineas?: number
  ajustes?: number
  diferencia?: number
  conteo?: ConteoFisicoConDetalle | null
}

function revalidar() {
  revalidatePath("/inventario")
  revalidatePath("/inventario/conteo-fisico")
}

async function esAdmin(userId: number): Promise<boolean> {
  const permiso = await getPermiso(userId)
  return permiso?.mod_usuarios === true
}

export async function abrirConteoFisicoAction(input: {
  fecha: string
  referencias?: string[]
  observacion?: string
}): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  if (!input.fecha) return { error: "Indica la fecha del conteo" }

  try {
    const r = await abrirConteoFisico(input, session.userId)
    revalidar()
    return { success: true, conteoId: r.id, lineas: r.lineas }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error abriendo el conteo" }
  }
}

export async function guardarConteoFisicoAction(
  conteoId: number,
  lineas: Array<{ id: number; cantidad_fisica: number | null; observacion?: string }>
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await guardarConteoFisico(conteoId, lineas)
    revalidar()
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error guardando el conteo" }
  }
}

// Cerrar ajusta el inventario: se reserva al administrador
export async function cerrarConteoFisicoAction(conteoId: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  if (!(await esAdmin(session.userId))) {
    return { error: "Solo el administrador puede cerrar un conteo y ajustar el inventario" }
  }

  try {
    const r = await cerrarConteoFisico(conteoId, session.userId)
    revalidar()
    return { success: true, ajustes: r.ajustes, diferencia: r.diferencia }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error cerrando el conteo" }
  }
}

export async function anularConteoFisicoAction(conteoId: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  if (!(await esAdmin(session.userId))) {
    return { error: "Solo el administrador puede anular un conteo" }
  }

  try {
    await anularConteoFisico(conteoId, session.userId)
    revalidar()
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error anulando el conteo" }
  }
}

export async function cargarConteoFisicoAction(conteoId: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const conteo = await getConteoFisico(conteoId)
    return { success: true, conteo }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error cargando el conteo" }
  }
}
