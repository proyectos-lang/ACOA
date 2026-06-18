import { requirePermiso } from "@/lib/auth/require-permiso"
import { getSession } from "@/lib/auth/session"
import { getOrdenById } from "@/lib/db/orden-produccion"
import { getCorteByOrden, getCorteConTelas, upsertCorte, ensureCorteTelas } from "@/lib/db/corte"
import { getCurvaTallas } from "@/lib/db/curva-talla"
import { getOpMateriales } from "@/lib/db/op-material"
import { getLotesByOrden } from "@/lib/db/lote"
import { CorteFichaClient } from "@/components/corte/corte-ficha-client"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

export default async function CorteFichaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermiso("mod_corte")
  const { id } = await params
  const ordenId = parseInt(id, 10)
  if (isNaN(ordenId)) notFound()

  const session = await getSession()

  const [orden, curvaTallas, opMateriales, lotes] = await Promise.all([
    getOrdenById(ordenId),
    getCurvaTallas(ordenId),
    getOpMateriales(ordenId),
    getLotesByOrden(ordenId),
  ])

  if (!orden) notFound()

  // Garantizar que el registro corte existe
  const existingCorte = await getCorteByOrden(ordenId)
  let corteId: number
  if (!existingCorte && session) {
    corteId = await upsertCorte({ orden_id: ordenId, creado_por: session.userId })
  } else if (existingCorte) {
    corteId = existingCorte.id
  } else {
    notFound()
  }

  // Garantizar filas corte_tela para cada material tipo tela
  const telaMateriales = opMateriales.filter((m) =>
    m.tipo.toLowerCase().includes("tela")
  )
  if (telaMateriales.length > 0 && session) {
    await ensureCorteTelas(
      corteId,
      telaMateriales.map((m) => ({ id: m.id, nombre: m.nombre })),
      session.userId
    )
  }

  // Cargar corte con fichas de tela embebidas
  const corte = await getCorteConTelas(ordenId)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/corte"
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Corte
        </Link>
        <span className="text-stone-300">/</span>
        <span className="text-sm font-medium text-stone-700">
          OP-{String(orden.numero_op).padStart(4, "0")} — {orden.referencia}
        </span>
      </div>

      <CorteFichaClient
        orden={orden}
        corte={corte}
        curvaTallas={curvaTallas}
        opMateriales={opMateriales}
        lotes={lotes}
      />
    </div>
  )
}
