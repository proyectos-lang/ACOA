import { requirePermiso } from "@/lib/auth/require-permiso"
import { listVentas, listClientes, listReferenciasVenta } from "@/lib/db/venta"
import { getDashboardVentas } from "@/lib/db/ventas-dashboard"
import { getSaldosInventario } from "@/lib/db/inventario-producto"
import { VentasClient } from "@/components/ventas/ventas-client"

export const dynamic = "force-dynamic"

export default async function VentasPage() {
  await requirePermiso("mod_ventas")

  const [ventas, clientes, referencias, saldos, dashboard] = await Promise.all([
    listVentas(),
    listClientes(),
    listReferenciasVenta(),
    getSaldosInventario(),
    getDashboardVentas(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Ventas</h1>
        <p className="text-sm text-stone-500">
          Registra la venta por cliente, documento y fecha. Al confirmarla, cada línea descuenta
          del inventario de producto terminado por referencia y talla.
        </p>
      </div>

      <VentasClient
        ventas={ventas}
        clientes={clientes}
        referencias={referencias}
        saldos={saldos}
        dashboard={dashboard}
      />
    </div>
  )
}
