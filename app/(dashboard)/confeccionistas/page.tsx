import { requirePermiso } from "@/lib/auth/require-permiso"
import { listConfeccionistas } from "@/lib/db/confeccionista"
import { ConfeccionistasClient } from "@/components/confeccionistas/confeccionistas-client"

export default async function ConfeccionistasPage() {
  await requirePermiso("mod_personal")
  const confeccionistas = await listConfeccionistas()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Confeccionistas</h1>
        <p className="text-sm text-stone-500">
          Hoja de vida de los confeccionistas. El nombre se usa como desplegable en las
          fichas de confección.
        </p>
      </div>

      <ConfeccionistasClient confeccionistas={confeccionistas} />
    </div>
  )
}
