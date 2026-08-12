import { requirePermiso } from "@/lib/auth/require-permiso"
import { getConfigCostos } from "@/lib/db/config-costos"
import { ConfigCostosClient } from "@/components/costos/config-costos-client"

export default async function ConfiguracionCostosPage() {
  await requirePermiso("ver_costos")
  const config = await getConfigCostos()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Configuración de costos</h1>
        <p className="text-sm text-stone-500">
          Costos estándar de los conceptos fijos. Se cargan automáticamente en la pestaña
          Materiales de cada orden de producción; allí el usuario los modifica solo si aplica.
        </p>
      </div>

      <ConfigCostosClient config={config} />
    </div>
  )
}
