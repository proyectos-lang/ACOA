import { requirePermiso } from "@/lib/auth/require-permiso"
import { listMateriales, getDistinctTipos, getDistinctUnidades } from "@/lib/db/material"
import { MaterialesClient } from "@/components/materiales/materiales-client"
import Link from "next/link"
import { BarChart2 } from "lucide-react"

export default async function MaterialesPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; activo?: string }>
}) {
  await requirePermiso("mod_orden_produccion")

  const { tipo, activo: activoParam } = await searchParams
  const activo =
    activoParam === "false" ? false : activoParam === "true" ? true : undefined

  const [materiales, tipos, unidades] = await Promise.all([
    listMateriales({ tipo, activo }),
    getDistinctTipos(),
    getDistinctUnidades(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#0D1821" }}>
            Materiales
          </h1>
          <p className="text-sm text-stone-500 mt-1">Maestro de materiales e insumos</p>
        </div>
        <Link
          href="/materiales/inventario"
          className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50 transition-colors"
        >
          <BarChart2 className="h-4 w-4 text-stone-500" />
          Inventario
        </Link>
      </div>
      <MaterialesClient
        materiales={materiales}
        tiposExistentes={tipos}
        unidadesExistentes={unidades}
      />
    </div>
  )
}
