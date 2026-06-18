import { requirePermiso } from "@/lib/auth/require-permiso"
import { getLoteById } from "@/lib/db/lote"
import { getOrdenById } from "@/lib/db/orden-produccion"
import { getCurvaTallas } from "@/lib/db/curva-talla"
import { getConteoByLote, getConteoDetalle } from "@/lib/db/conteo"
import { getEmpaquePorLote } from "@/lib/db/empaque-registro"
import { listPersonas } from "@/lib/db/persona"
import { EmpaqueRegistroClient } from "@/components/empaque/empaque-registro-client"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

export default async function EmpaqueFichaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermiso("mod_empaque")
  const { id } = await params
  const loteId = parseInt(id, 10)

  const lote = await getLoteById(loteId)
  if (!lote) notFound()

  const conteo = await getConteoByLote(loteId)

  const [orden, curvaTallas, conteoDetalle, registros, empacadoras] = await Promise.all([
    getOrdenById(lote.orden_id),
    getCurvaTallas(lote.orden_id),
    conteo ? getConteoDetalle(conteo.id) : Promise.resolve([]),
    getEmpaquePorLote(loteId),
    listPersonas({ tipo_pago: "produccion", estado: "activo" }),
  ])

  if (!orden) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/empaque"
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Empaque
        </Link>
        <span className="text-stone-300">/</span>
        <span className="text-sm font-medium text-stone-700">
          LOTE-{String(lote.numero_lote).padStart(4, "0")} — {lote.color}
        </span>
      </div>

      <EmpaqueRegistroClient
        lote={lote}
        orden={orden}
        curvaTallas={curvaTallas}
        conteo={conteo}
        conteoDetalle={conteoDetalle}
        registros={registros}
        empacadoras={empacadoras}
      />
    </div>
  )
}
