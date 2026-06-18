import { requirePermiso } from "@/lib/auth/require-permiso"
import { listOrdenes } from "@/lib/db/orden-produccion"
import { OrdenesClient } from "@/components/produccion/ordenes-client"

export default async function ProduccionPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string }>
}) {
  await requirePermiso("mod_orden_produccion")

  const { estado, q } = await searchParams
  const ordenes = await listOrdenes({ estado, busqueda: q })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#0D1821" }}>
          Órdenes de Producción
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Gestión de órdenes y seguimiento de estado
        </p>
      </div>
      <OrdenesClient ordenes={ordenes} />
    </div>
  )
}
