"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import { requirePermiso } from "@/lib/auth/require-permiso"
import { saveConfigCostos } from "@/lib/db/config-costos"
import { VALORES_FIJOS } from "@/lib/db/hoja-costos"

export interface ConfigCostosActionResult {
  error?: string
  success?: boolean
}

export async function guardarConfigCostosAction(
  formData: FormData
): Promise<ConfigCostosActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  await requirePermiso("ver_costos")

  try {
    const valores: Record<string, number> = {}
    for (const f of VALORES_FIJOS) {
      const raw = parseFloat((formData.get(f.key as string) as string | null) ?? "0")
      valores[f.key as string] = isNaN(raw) || raw < 0 ? 0 : Math.round(raw * 100) / 100
    }
    await saveConfigCostos(valores, session.userId)
    revalidatePath("/configuracion-costos")
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error guardando configuración de costos" }
  }
}
