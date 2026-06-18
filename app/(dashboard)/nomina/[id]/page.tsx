import { requirePermiso } from "@/lib/auth/require-permiso"
import { getPeriodoById } from "@/lib/db/periodo-nomina"
import { getLiquidacionesPorPeriodo, getDetallesPorLiquidacion } from "@/lib/db/liquidacion"
import { LiquidacionGridClient } from "@/components/nomina/liquidacion-grid-client"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { notFound } from "next/navigation"

const MESES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

export default async function PeriodoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermiso("mod_nomina")

  const { id } = await params
  const periodoId = Number(id)
  if (isNaN(periodoId)) notFound()

  const periodo = await getPeriodoById(periodoId)
  if (!periodo) notFound()

  const liquidaciones = await getLiquidacionesPorPeriodo(periodoId)

  // Pre-fetch detalles para todas las liquidaciones
  const detallesMap: Record<number, Awaited<ReturnType<typeof getDetallesPorLiquidacion>>> = {}
  await Promise.all(
    liquidaciones.map(async (liq) => {
      detallesMap[liq.id] = await getDetallesPorLiquidacion(liq.id)
    })
  )

  const titulo = `${MESES[periodo.mes]} ${periodo.anio} — Q${periodo.quincena}`

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link
          href="/nomina"
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-stone-500 hover:bg-stone-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Nómina
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#0D1821" }}>
            {titulo}
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            {periodo.fecha_inicio} → {periodo.fecha_fin} ·{" "}
            <span
              className={`font-medium ${
                periodo.estado === "liquidado" ? "text-green-600" : "text-amber-600"
              }`}
            >
              {periodo.estado === "liquidado" ? "Liquidado" : "Abierto"}
            </span>
          </p>
        </div>
      </div>

      <LiquidacionGridClient
        periodo={periodo}
        liquidaciones={liquidaciones}
        detallesMap={detallesMap}
      />
    </div>
  )
}
