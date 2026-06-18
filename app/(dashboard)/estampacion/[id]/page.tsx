import { requirePermiso } from "@/lib/auth/require-permiso"
import { getLoteById } from "@/lib/db/lote"
import { getOrdenById } from "@/lib/db/orden-produccion"
import { getCorteByOrden } from "@/lib/db/corte"
import { getCurvaTallas } from "@/lib/db/curva-talla"
import { getEstampacionByLote } from "@/lib/db/estampacion"
import { getNovedadesByLote } from "@/lib/db/novedad-proceso"
import { EstampacionFichaClient } from "@/components/estampacion/estampacion-ficha-client"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

export default async function EstampacionFichaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermiso("mod_estampacion")
  const { id } = await params
  const loteId = parseInt(id, 10)

  const lote = await getLoteById(loteId)
  if (!lote) notFound()

  const [orden, corte, curvaTallas, estampacion, novedades] = await Promise.all([
    getOrdenById(lote.orden_id),
    getCorteByOrden(lote.orden_id),
    getCurvaTallas(lote.orden_id),
    getEstampacionByLote(loteId),
    getNovedadesByLote(loteId, "estampacion"),
  ])

  if (!orden) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/estampacion"
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Estampación
        </Link>
        <span className="text-stone-300">/</span>
        <span className="text-sm font-medium text-stone-700">
          LOTE-{String(lote.numero_lote).padStart(4, "0")} — {lote.color}
        </span>
      </div>

      <EstampacionFichaClient
        lote={lote}
        orden={orden}
        corte={corte}
        curvaTallas={curvaTallas}
        estampacion={estampacion}
        novedades={novedades}
      />
    </div>
  )
}
