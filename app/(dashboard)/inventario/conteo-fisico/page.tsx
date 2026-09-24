import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { requirePermiso } from "@/lib/auth/require-permiso"
import { getPermiso } from "@/lib/db/permiso"
import {
  listConteosFisicos,
  getReferenciasParaConteo,
} from "@/lib/db/conteo-fisico"
import { ConteoFisicoClient } from "@/components/inventario/conteo-fisico-client"

export const dynamic = "force-dynamic"

export default async function ConteoFisicoPage() {
  const { session } = await requirePermiso("mod_empaque")

  const [conteos, referencias, permiso] = await Promise.all([
    listConteosFisicos(),
    getReferenciasParaConteo(),
    getPermiso(session.userId),
  ])

  // Solo puede haber un conteo abierto a la vez
  const abierto = conteos.find((c) => c.estado === "abierto") ?? null

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
        <span className="text-sm font-medium text-stone-700">Conteo físico</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-stone-900">Conteo físico</h1>
        <p className="text-sm text-stone-500">
          Cuenta el inventario real, compáralo con lo que dice el sistema y cuadra las
          diferencias.
        </p>
      </div>

      <ConteoFisicoClient
        conteos={conteos}
        referencias={referencias}
        abierto={abierto}
        esAdmin={permiso?.mod_usuarios === true}
      />
    </div>
  )
}
