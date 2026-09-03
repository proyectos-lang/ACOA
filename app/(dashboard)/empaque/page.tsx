import { requirePermiso } from "@/lib/auth/require-permiso"
import { getLotesEnEmpaque } from "@/lib/db/empaque-registro"
import { EmpaqueListaClient } from "@/components/empaque/empaque-lista-client"

export default async function EmpaquePage() {
  await requirePermiso("mod_empaque")
  const lotes = await getLotesEnEmpaque()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Empaque</h1>
        <p className="text-sm text-stone-500">Lotes en proceso de empaque</p>
      </div>

      <EmpaqueListaClient lotes={lotes} />
    </div>
  )
}
