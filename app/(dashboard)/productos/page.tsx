import { requirePermiso } from "@/lib/auth/require-permiso"
import { listReferenciasVenta } from "@/lib/db/venta"
import { ProductosClient } from "@/components/productos/productos-client"

export const dynamic = "force-dynamic"

export default async function ProductosPage() {
  await requirePermiso("mod_ventas")
  const referencias = await listReferenciasVenta()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Productos</h1>
        <p className="text-sm text-stone-500">
          Maestro de referencias con su precio y la empresa a la que pertenecen. La empresa del
          producto define en qué contabilidad entra cada línea de venta.
        </p>
      </div>

      <ProductosClient referencias={referencias} />
    </div>
  )
}
