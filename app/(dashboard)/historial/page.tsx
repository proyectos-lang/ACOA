import { requirePermiso } from "@/lib/auth/require-permiso"
import { MODULOS, listHistorial } from "@/lib/db/historial"
import { HistorialClient } from "@/components/historial/historial-client"

export default async function HistorialPage() {
  // Exclusivo del administrador: se reutiliza el permiso de Usuarios
  await requirePermiso("mod_usuarios")

  const moduloInicial = MODULOS[0].key
  const registros = await listHistorial(moduloInicial)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Historial de registros</h1>
        <p className="text-sm text-stone-500">
          Todos los registros de cada módulo, incluidos los lotes que ya avanzaron de proceso.
          Como administrador puedes editar cualquier valor línea por línea.
        </p>
      </div>

      <HistorialClient
        modulos={MODULOS}
        moduloInicial={moduloInicial}
        registrosIniciales={registros}
      />
    </div>
  )
}
