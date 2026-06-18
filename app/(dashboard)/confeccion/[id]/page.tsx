import { requirePermiso } from "@/lib/auth/require-permiso"
import { getLoteById } from "@/lib/db/lote"
import { getOrdenById } from "@/lib/db/orden-produccion"
import { getCurvaTallas } from "@/lib/db/curva-talla"
import { getConfeccionByLote, getInsumosByConfeccion } from "@/lib/db/confeccion"
import { getNovedadesByLote } from "@/lib/db/novedad-proceso"
import { ConfeccionFichaClient } from "@/components/confeccion/confeccion-ficha-client"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

export default async function ConfeccionFichaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermiso("mod_confeccion")
  const { id } = await params
  const loteId = parseInt(id, 10)

  const lote = await getLoteById(loteId)
  if (!lote) notFound()

  const confeccion = await getConfeccionByLote(loteId)

  const [orden, curvaTallas, insumos, novedades] = await Promise.all([
    getOrdenById(lote.orden_id),
    getCurvaTallas(lote.orden_id),
    confeccion ? getInsumosByConfeccion(confeccion.id) : Promise.resolve([]),
    getNovedadesByLote(loteId, "confeccion"),
  ])

  if (!orden) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/confeccion"
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Confección
        </Link>
        <span className="text-stone-300">/</span>
        <span className="text-sm font-medium text-stone-700">
          LOTE-{String(lote.numero_lote).padStart(4, "0")} — {lote.color}
        </span>
      </div>

      <ConfeccionFichaClient
        lote={lote}
        orden={orden}
        curvaTallas={curvaTallas}
        confeccion={confeccion}
        insumos={insumos}
        novedades={novedades}
      />
    </div>
  )
}
