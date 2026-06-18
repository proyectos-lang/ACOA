"use server"

import { getSession } from "@/lib/auth/session"
import { getPermiso } from "@/lib/db/permiso"
import { getCurvaTallas } from "@/lib/db/curva-talla"
import { getLotesByOrden } from "@/lib/db/lote"
import { getDisenoByOrden } from "@/lib/db/diseno"
import { getCorteConTelas } from "@/lib/db/corte"
import { getEstampacionByLote } from "@/lib/db/estampacion"
import { getConfeccionByLote } from "@/lib/db/confeccion"
import { getConteoByLote } from "@/lib/db/conteo"
import { getEmpaqueTotalPorLote } from "@/lib/db/empaque-registro"
import { getHojaCostos } from "@/lib/db/hoja-costos"
import { getOpMateriales } from "@/lib/db/op-material"

import type { CurvaTallaRow } from "@/lib/db/curva-talla"
import type { LoteRow } from "@/lib/db/lote"
import type { DisenoRow } from "@/lib/db/diseno"
import type { CorteConTelas } from "@/lib/db/corte"
import type { EstampacionRow } from "@/lib/db/estampacion"
import type { ConfeccionRow } from "@/lib/db/confeccion"
import type { ConteoRow } from "@/lib/db/conteo"
import type { HojaCostosRow } from "@/lib/db/hoja-costos"
import type { OpMaterialRow } from "@/lib/db/op-material"

export type LoteDetalle = {
  lote: LoteRow
  estampacion: EstampacionRow | null
  confeccion: ConfeccionRow | null
  conteo: ConteoRow | null
  totalEmpacado: number
}

export type DetalleOPData = {
  curva: CurvaTallaRow[]
  lotes: LoteDetalle[]
  diseno: DisenoRow | null
  corte: CorteConTelas | null
  costos: HojaCostosRow | null
  materiales: OpMaterialRow[]
}

export async function getDetalleOPAction(ordenId: number): Promise<DetalleOPData | null> {
  const session = await getSession()
  if (!session) return null

  const permiso = await getPermiso(session.userId)
  const verCostos = permiso?.ver_costos ?? false

  const [curva, lotes, diseno, corte] = await Promise.all([
    getCurvaTallas(ordenId),
    getLotesByOrden(ordenId),
    getDisenoByOrden(ordenId),
    getCorteConTelas(ordenId),
  ])

  const lotesConDetalle: LoteDetalle[] = await Promise.all(
    lotes.map(async (lote) => {
      const [estampacion, confeccion, conteo, totalEmpacado] = await Promise.all([
        getEstampacionByLote(lote.id),
        getConfeccionByLote(lote.id),
        getConteoByLote(lote.id),
        getEmpaqueTotalPorLote(lote.id),
      ])
      return { lote, estampacion, confeccion, conteo, totalEmpacado }
    })
  )

  let costos: HojaCostosRow | null = null
  let materiales: OpMaterialRow[] = []
  if (verCostos) {
    ;[costos, materiales] = await Promise.all([
      getHojaCostos(ordenId),
      getOpMateriales(ordenId),
    ])
  }

  return { curva, lotes: lotesConDetalle, diseno, corte, costos, materiales }
}
