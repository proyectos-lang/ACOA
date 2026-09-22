import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { requirePermiso } from "@/lib/auth/require-permiso"
import { getPermiso } from "@/lib/db/permiso"
import { listOrdenesSalida } from "@/lib/db/orden-salida"
import { listClientes, listReferenciasVenta } from "@/lib/db/venta"
import { getSaldosInventario } from "@/lib/db/inventario-producto"
import { OrdenSalidaClient } from "@/components/inventario/orden-salida-client"

export const dynamic = "force-dynamic"

export default async function OrdenesSalidaPage() {
  const { session } = await requirePermiso("mod_empaque")

  const [ordenes, clientes, referencias, saldos, permiso] = await Promise.all([
    listOrdenesSalida(),
    listClientes(),
    listReferenciasVenta(),
    getSaldosInventario(),
    getPermiso(session.userId),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/inventario"
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 transition-colors hover:text-stone-700"
        >
          <ChevronLeft className="h-4 w-4" />
          Inventario
        </Link>
        <span className="text-stone-300">/</span>
        <span className="text-sm font-medium text-stone-700">Órdenes de salida</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-stone-900">Órdenes de salida</h1>
        <p className="text-sm text-stone-500">
          Despacha producto terminado a un cliente. La orden descuenta el inventario, genera su
          documento y desde ella se puede facturar la venta.
        </p>
      </div>

      <OrdenSalidaClient
        ordenes={ordenes}
        clientes={clientes}
        referencias={referencias}
        saldos={saldos}
        esAdmin={permiso?.mod_usuarios === true}
      />
    </div>
  )
}
