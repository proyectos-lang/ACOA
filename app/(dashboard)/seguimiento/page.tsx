import { requirePermiso } from "@/lib/auth/require-permiso"
import { getSeguimientoLotes, getPipelineProduccion } from "@/lib/db/seguimiento"
import SeguimientoClient from "@/components/seguimiento/seguimiento-client"

export default async function SeguimientoPage() {
  const { permiso } = await requirePermiso("mod_seguimiento")
  const [lotes, pipeline] = await Promise.all([
    getSeguimientoLotes(),
    getPipelineProduccion(),
  ])
  return (
    <SeguimientoClient
      lotes={lotes}
      pipeline={pipeline}
      verCostos={permiso.ver_costos}
    />
  )
}
