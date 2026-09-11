import { requirePermiso } from "@/lib/auth/require-permiso"
import { listOPsEnCorte } from "@/lib/db/corte"
import { getReporteCortes } from "@/lib/db/reporte-corte"
import { CorteTabs } from "@/components/corte/corte-tabs"

export default async function CortePage() {
  await requirePermiso("mod_corte")

  // Reporte: por defecto el último mes
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
  const hace30 = new Date(Date.now() - 30 * 86400000).toLocaleDateString("en-CA", {
    timeZone: "America/Bogota",
  })

  const [ops, diasReporte] = await Promise.all([
    listOPsEnCorte(),
    getReporteCortes({ desde: hace30, hasta: hoy }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Corte</h1>
        <p className="text-sm text-stone-500">
          Órdenes en proceso de corte y reporte de lo entregado día a día
        </p>
      </div>

      <CorteTabs
        ops={ops}
        diasReporte={diasReporte}
        desdeInicial={hace30}
        hastaInicial={hoy}
      />
    </div>
  )
}
