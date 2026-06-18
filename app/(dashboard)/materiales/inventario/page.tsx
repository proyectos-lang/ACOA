import { requirePermiso } from "@/lib/auth/require-permiso"
import { getStockMateriales } from "@/lib/db/inventario"
import { InventarioClient } from "@/components/materiales/inventario-client"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

export default async function InventarioPage() {
  await requirePermiso("mod_orden_produccion")
  const stock = await getStockMateriales()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/materiales"
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Materiales
        </Link>
        <span className="text-stone-300">/</span>
        <span className="text-sm font-medium text-stone-700">Inventario</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#0D1821" }}>
          Inventario de materiales
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Stock en tiempo real y registro de movimientos
        </p>
      </div>

      <InventarioClient stock={stock} />
    </div>
  )
}
