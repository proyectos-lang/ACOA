"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import { requirePermiso } from "@/lib/auth/require-permiso"
import { updateHojaCostos } from "@/lib/db/hoja-costos"
import { sumValorPorPrenda } from "@/lib/db/op-material"
import { getCurvaTallas } from "@/lib/db/curva-talla"
import { getOrdenById } from "@/lib/db/orden-produccion"
import { getOpTelas } from "@/lib/db/op-tela"

export interface CostosActionResult {
  error?: string
  success?: boolean
  costo_materiales?: number
  costo_unitario?: number
  margen_calculado?: number
}

const VALORES_FIJOS_KEYS = [
  "valor_cordon",
  "valor_empaque",
  "valor_bandera",
  "valor_corte",
  "valor_trazos_insumos_corte",
  "valor_estampacion_aplique_dtf",
  "valor_confeccion",
  "valor_bolsas_flechas_stickers",
  "valor_etiqueta",
  "valor_instruccion",
  "valor_comision",
  "valor_transporte",
  "valor_flete",
  "valor_viaticos",
  "valor_oros",
] as const

export async function guardarHojaCostosAction(
  ordenId: number,
  formData: FormData
): Promise<CostosActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  await requirePermiso("ver_costos")

  try {
    const valoresFijos: Record<string, number> = {}
    let sumaFijos = 0

    for (const key of VALORES_FIJOS_KEYS) {
      const raw = parseFloat((formData.get(key) as string | null) ?? "0")
      const v = isNaN(raw) ? 0 : Math.round(raw * 100) / 100
      valoresFijos[key] = v
      sumaFijos += v
    }

    const pvRaw = parseFloat((formData.get("precio_venta") as string | null) ?? "")
    const precio_venta = isNaN(pvRaw) || pvRaw === 0 ? null : pvRaw

    const [costo_m_raw, curva, orden, opTelas] = await Promise.all([
      sumValorPorPrenda(ordenId),
      getCurvaTallas(ordenId),
      getOrdenById(ordenId),
      getOpTelas(ordenId),
    ])
    const costo_materiales = Math.round(costo_m_raw * 10000) / 10000
    const costo_unitario = Math.round((costo_materiales + sumaFijos) * 10000) / 10000
    const totalCapas = opTelas.reduce((s, t) => s + t.capas, 0) || (orden?.capas ?? 1)
    const total_unidades = totalCapas * curva.length

    await updateHojaCostos(ordenId, {
      ...valoresFijos,
      costo_materiales,
      costo_unitario,
      precio_venta,
      total_unidades,
    })

    revalidatePath(`/produccion/${ordenId}`)
    revalidatePath(`/produccion/${ordenId}/costos`)
    return { success: true, costo_materiales, costo_unitario }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error guardando hoja de costos" }
  }
}
