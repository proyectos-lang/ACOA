"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import {
  getNominaDiaria,
  updateConfigGeneral,
  cerrarDiaNomina,
  reabrirDiaNomina,
  getNominaProduccion,
  type NominaPersona,
  type ConfigNominaGeneral,
  type LineaProduccion,
} from "@/lib/db/nomina-diaria"

type ActionResult = {
  error?: string
  success?: boolean
  personas?: NominaPersona[]
  config?: ConfigNominaGeneral | null
  lineas?: LineaProduccion[]
  valorPrenda?: number
}

export async function cargarNominaDiariaAction(input: {
  desde: string
  hasta: string
  personaId?: number | null
}): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const { personas, config } = await getNominaDiaria(input)
    return { success: true, personas, config }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error cargando la nómina" }
  }
}

export async function guardarConfigNominaAction(
  id: number,
  campos: Record<string, number>
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await updateConfigGeneral(id, campos)
    revalidatePath("/nomina")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error guardando la configuración" }
  }
}

export async function cerrarDiaNominaAction(input: {
  persona_id: number
  fecha: string
  valor_pagado: number
  observacion?: string
}): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await cerrarDiaNomina({ ...input, cerrado_por: session.userId })
    revalidatePath("/nomina")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error cerrando el día" }
  }
}

export async function reabrirDiaNominaAction(
  personaId: number,
  fecha: string
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await reabrirDiaNomina(personaId, fecha)
    revalidatePath("/nomina")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error reabriendo el día" }
  }
}

// Nomina por produccion: que referencias empaco cada persona cada dia
export async function cargarNominaProduccionAction(input: {
  desde: string
  hasta: string
  personaId?: number | null
}): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const { lineas, valorPrenda } = await getNominaProduccion(input)
    return { success: true, lineas, valorPrenda }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error cargando la produccion" }
  }
}
