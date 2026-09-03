import { requirePermiso } from "@/lib/auth/require-permiso"
import { getLotesEnConteo } from "@/lib/db/conteo"
import { ConteoListaClient } from "@/components/conteo/conteo-lista-client"

export default async function ConteoPage() {
  await requirePermiso("mod_conteo")
  const lotes = await getLotesEnConteo()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Conteo</h1>
        <p className="text-sm text-stone-500">Lotes en proceso de conteo</p>
      </div>

      <ConteoListaClient lotes={lotes} />
    </div>
  )
}
