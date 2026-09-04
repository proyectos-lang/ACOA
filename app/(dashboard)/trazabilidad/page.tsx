import { requirePermiso } from "@/lib/auth/require-permiso"
import { getTrazabilidad, promediosPorEtapa } from "@/lib/db/trazabilidad"
import { TrazabilidadClient } from "@/components/trazabilidad/trazabilidad-client"

export default async function TrazabilidadPage() {
  await requirePermiso("mod_seguimiento")

  const ordenes = await getTrazabilidad()
  const promedios = promediosPorEtapa(ordenes)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Dashboard y trazabilidad</h1>
        <p className="text-sm text-stone-500">
          Control 360 de la operación: estado de cada orden, avance por lote y prenda, línea de
          tiempo por etapa y tiempos de proceso.
        </p>
      </div>

      <TrazabilidadClient ordenes={ordenes} promedios={promedios} />
    </div>
  )
}
