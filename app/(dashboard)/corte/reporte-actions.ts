"use server"

import { getSession } from "@/lib/auth/session"
import { getReporteCortes, type DiaCorte } from "@/lib/db/reporte-corte"

type ActionResult = { error?: string; success?: boolean; dias?: DiaCorte[] }

export async function cargarReporteCortesAction(input: {
  desde: string
  hasta: string
}): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const dias = await getReporteCortes(input)
    return { success: true, dias }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error cargando el reporte" }
  }
}
