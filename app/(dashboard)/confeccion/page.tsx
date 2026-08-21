import { requirePermiso } from "@/lib/auth/require-permiso"
import { getLotesEnConfeccion } from "@/lib/db/confeccion"
import { listConfeccionistas } from "@/lib/db/confeccionista"
import { ConfeccionListaClient } from "@/components/confeccion/confeccion-lista-client"
import { FileText } from "lucide-react"

export default async function ConfeccionPage() {
  await requirePermiso("mod_confeccion")
  const [lotes, confeccionistas] = await Promise.all([
    getLotesEnConfeccion(),
    listConfeccionistas(true),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Confección</h1>
        <p className="text-sm text-stone-500">
          Selecciona lotes para asignar confeccionista o registrar la recepción de forma masiva
        </p>
      </div>

      {lotes.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
          <FileText className="h-10 w-10 mx-auto mb-3 text-stone-300" />
          <p className="text-stone-400 text-sm">No hay lotes en proceso de confección.</p>
        </div>
      ) : (
        <ConfeccionListaClient lotes={lotes} confeccionistas={confeccionistas} />
      )}
    </div>
  )
}
