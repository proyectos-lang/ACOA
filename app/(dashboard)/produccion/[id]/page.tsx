import { requirePermiso } from "@/lib/auth/require-permiso"
import { getOrdenById } from "@/lib/db/orden-produccion"
import { getOpMateriales } from "@/lib/db/op-material"
import { getCurvaTallas } from "@/lib/db/curva-talla"
import { listMateriales } from "@/lib/db/material"
import { getSession } from "@/lib/auth/session"
import { getPermiso } from "@/lib/db/permiso"
import { getHojaCostos } from "@/lib/db/hoja-costos"
import { getOpTelas } from "@/lib/db/op-tela"
import { getOpTelaLotes } from "@/lib/db/op-tela-lote"
import { getLotesByOrden } from "@/lib/db/lote"
import { OrdenDetalleClient } from "@/components/produccion/orden-detalle-client"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ESTADO_OP_LABEL, ESTADO_OP_COLOR } from "@/lib/db/orden-produccion"

function padOP(n: number) {
  return `OP-${String(n).padStart(4, "0")}`
}

export default async function OrdenDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermiso("mod_orden_produccion")

  const { id } = await params
  const ordenId = Number(id)
  if (isNaN(ordenId)) notFound()

  const [orden, opMateriales, curvaTallas, materiales, session, opTelas, opTelaLotes, lotes] = await Promise.all([
    getOrdenById(ordenId),
    getOpMateriales(ordenId),
    getCurvaTallas(ordenId),
    listMateriales({ activo: true }),
    getSession(),
    getOpTelas(ordenId),
    getOpTelaLotes(ordenId),
    getLotesByOrden(ordenId),
  ])

  if (!orden) notFound()

  const permiso = session ? await getPermiso(session.userId) : null
  const tieneVerCostos = permiso?.ver_costos === true
  const hojaCostos = tieneVerCostos ? await getHojaCostos(ordenId) : null

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link
          href="/produccion"
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-stone-500 hover:bg-stone-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Producción
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#0D1821" }}>
              {padOP(orden.numero_op)} — {orden.referencia}
            </h1>
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                ESTADO_OP_COLOR[orden.estado]
              }`}
            >
              {ESTADO_OP_LABEL[orden.estado]}
            </span>
          </div>
          <p className="text-sm text-stone-500 mt-1">
            {[orden.gama_color, orden.fecha_programacion && `Prog. ${orden.fecha_programacion}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      <OrdenDetalleClient
        orden={orden}
        opMateriales={opMateriales}
        curvaTallas={curvaTallas}
        maestroMateriales={materiales}
        tieneVerCostos={tieneVerCostos}
        hojaCostos={hojaCostos}
        opTelas={opTelas}
        opTelaLotes={opTelaLotes}
        lotes={lotes}
      />
    </div>
  )
}
