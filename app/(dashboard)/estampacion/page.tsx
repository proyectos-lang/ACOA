import { requirePermiso } from "@/lib/auth/require-permiso"
import { getLotesEnEstampacion } from "@/lib/db/lote"
import { listEstampadores } from "@/lib/db/estampador"
import { EstampacionListaClient } from "@/components/estampacion/estampacion-lista-client"
import { FileText } from "lucide-react"

export default async function EstampacionPage() {
  await requirePermiso("mod_estampacion")
  const [lotes, estampadores] = await Promise.all([
    getLotesEnEstampacion(),
    listEstampadores(true),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Estampación</h1>
        <p className="text-sm text-stone-500">
          Selecciona lotes para asignar estampador o registrar la recepción de forma masiva
        </p>
      </div>

      {lotes.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
          <FileText className="h-10 w-10 mx-auto mb-3 text-stone-300" />
          <p className="text-stone-400 text-sm">No hay lotes en proceso de estampación.</p>
        </div>
      ) : (
        <EstampacionListaClient lotes={lotes} estampadores={estampadores} />
      )}
    </div>
  )
}
