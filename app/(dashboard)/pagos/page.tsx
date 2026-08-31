import { requirePermiso } from "@/lib/auth/require-permiso"
import { listPagosConContexto } from "@/lib/db/pago"
import { PagosClient } from "@/components/pagos/pagos-client"

export default async function PagosPage() {
  await requirePermiso("ver_costos")
  const pagos = await listPagosConContexto()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Pagos</h1>
        <p className="text-sm text-stone-500">
          Pagos a estampadores y confeccionistas. El pago de estampación se habilita desde la
          ficha del lote; el de confección se habilita automáticamente al validar el conteo.
        </p>
      </div>

      <PagosClient pagos={pagos} />
    </div>
  )
}
