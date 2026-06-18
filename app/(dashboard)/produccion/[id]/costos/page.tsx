import { requirePermiso } from "@/lib/auth/require-permiso"
import { getOrdenById } from "@/lib/db/orden-produccion"
import { getHojaCostos } from "@/lib/db/hoja-costos"
import { getOpMateriales } from "@/lib/db/op-material"
import { HojaCostosClient } from "@/components/produccion/hoja-costos-client"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

function padOP(n: number) {
  return `OP-${String(n).padStart(4, "0")}`
}

export default async function HojaCostosPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermiso("ver_costos")

  const { id } = await params
  const ordenId = Number(id)
  if (isNaN(ordenId)) notFound()

  const [orden, hojaCostos, opMateriales] = await Promise.all([
    getOrdenById(ordenId),
    getHojaCostos(ordenId),
    getOpMateriales(ordenId),
  ])

  if (!orden || !hojaCostos) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link
          href={`/produccion/${ordenId}`}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-stone-500 hover:bg-stone-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {padOP(orden.numero_op)}
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#0D1821" }}>
            Hoja de Costos
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            {orden.referencia} · {padOP(orden.numero_op)}
          </p>
        </div>
      </div>

      <HojaCostosClient
        orden={orden}
        hojaCostos={hojaCostos}
        opMateriales={opMateriales}
      />
    </div>
  )
}
