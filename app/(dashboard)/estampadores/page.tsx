import { requirePermiso } from "@/lib/auth/require-permiso"
import { listEstampadores } from "@/lib/db/estampador"
import { EstampadoresClient } from "@/components/estampadores/estampadores-client"

export default async function EstampadoresPage() {
  await requirePermiso("mod_personal")
  const estampadores = await listEstampadores()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Estampadores</h1>
        <p className="text-sm text-stone-500">
          Hoja de vida de los estampadores. El nombre se usa como desplegable en las fichas
          de estampación.
        </p>
      </div>

      <EstampadoresClient estampadores={estampadores} />
    </div>
  )
}
