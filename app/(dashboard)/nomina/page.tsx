import { requirePermiso } from "@/lib/auth/require-permiso"
import { listPeriodos } from "@/lib/db/periodo-nomina"
import { PeriodosClient } from "@/components/nomina/periodos-client"

export default async function NominaPage() {
  await requirePermiso("mod_nomina")

  const periodos = await listPeriodos()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#0D1821" }}>
          Nómina
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Períodos quincenales y liquidación devengada
        </p>
      </div>

      <PeriodosClient periodos={periodos} />
    </div>
  )
}
