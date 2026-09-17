import { requirePermiso } from "@/lib/auth/require-permiso"
import { getLotesEnEmpaque, getLotesFinalizados } from "@/lib/db/empaque-registro"
import { getPermiso } from "@/lib/db/permiso"
import { EmpaqueListaClient } from "@/components/empaque/empaque-lista-client"

export const dynamic = "force-dynamic"

export default async function EmpaquePage() {
  const { session } = await requirePermiso("mod_empaque")

  const [lotes, finalizados, permiso] = await Promise.all([
    getLotesEnEmpaque(),
    getLotesFinalizados(),
    getPermiso(session.userId),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Empaque</h1>
        <p className="text-sm text-stone-500">
          Lotes en proceso de empaque e historial de los ya terminados
        </p>
      </div>

      <EmpaqueListaClient
        lotes={lotes}
        finalizados={finalizados}
        esAdmin={permiso?.mod_usuarios === true}
      />
    </div>
  )
}
