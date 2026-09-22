import Link from "next/link"
import { PackageMinus } from "lucide-react"
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
      <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Inventario de producto terminado</h1>
        <p className="text-sm text-stone-500">
          Cada empaque carga el inventario con su trazabilidad. Aquí ves el disponible por
          referencia, lote, prenda y talla, y registras las salidas.
        </p>
      </div>
        <Link
          href="/inventario/ordenes-salida"
          className="flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: "#344966" }}
        >
          <PackageMinus className="h-4 w-4" />
          Ordenes de salida
        </Link>
      </div>

      <InventarioClient saldos={saldos} movimientos={movimientos} />
    </div>
  )
}
