import { requirePermiso } from "@/lib/auth/require-permiso"
import { getSaldosInventario, getMovimientos } from "@/lib/db/inventario-producto"
import { InventarioClient } from "@/components/inventario/inventario-client"

export default async function InventarioPage() {
  await requirePermiso("mod_empaque")

  const [saldos, movimientos] = await Promise.all([
    getSaldosInventario(),
    getMovimientos(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Inventario de producto terminado</h1>
        <p className="text-sm text-stone-500">
          Cada empaque carga el inventario con su trazabilidad. Aquí ves el disponible por
          referencia, lote, prenda y talla, y registras las salidas.
        </p>
      </div>

      <InventarioClient saldos={saldos} movimientos={movimientos} />
    </div>
  )
}
