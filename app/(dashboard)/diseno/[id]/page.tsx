import { requirePermiso } from "@/lib/auth/require-permiso"
import { getOrdenById } from "@/lib/db/orden-produccion"
import { getDisenoByOrden, getDisenosByReferencia } from "@/lib/db/diseno"
import { DisenaFichaClient } from "@/components/diseno/diseno-ficha-client"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

export default async function DisenaFichaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermiso("mod_diseno")
  const { id } = await params
  const ordenId = parseInt(id, 10)

  const [orden, diseno] = await Promise.all([
    getOrdenById(ordenId),
    getDisenoByOrden(ordenId),
  ])

  if (!orden) notFound()

  const disenosAnteriores = await getDisenosByReferencia(orden.referencia, orden.id)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/diseno"
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Diseño
        </Link>
        <span className="text-stone-300">/</span>
        <span className="text-sm font-medium text-stone-700">
          OP-{String(orden.numero_op).padStart(4, "0")} — {orden.referencia}
        </span>
      </div>

      <DisenaFichaClient orden={orden} diseno={diseno} disenosAnteriores={disenosAnteriores} />
    </div>
  )
}
