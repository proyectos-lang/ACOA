import { requirePermiso } from "@/lib/auth/require-permiso"
import { listPeriodos } from "@/lib/db/periodo-nomina"
import { listPersonas } from "@/lib/db/persona"
import { getNominaDiaria } from "@/lib/db/nomina-diaria"
import { NominaTabs } from "@/components/nomina/nomina-tabs"

export default async function NominaPage() {
  await requirePermiso("mod_nomina")

  // Por defecto, la quincena en curso
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
  const [y, m, d] = hoy.split("-").map(Number)
  const desde = d <= 15 ? `${y}-${String(m).padStart(2, "0")}-01` : `${y}-${String(m).padStart(2, "0")}-16`

  const [periodos, empleados, nomina] = await Promise.all([
    listPeriodos(),
    listPersonas({ estado: "activo" }),
    getNominaDiaria({ desde, hasta: hoy }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#0D1821" }}>
          Nómina
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Pago diario del personal, períodos quincenales y parámetros de ley
        </p>
      </div>

      <NominaTabs
        periodos={periodos}
        empleados={empleados}
        personasIniciales={nomina.personas}
        configInicial={nomina.config}
        desdeInicial={desde}
        hastaInicial={hoy}
      />
    </div>
  )
}
