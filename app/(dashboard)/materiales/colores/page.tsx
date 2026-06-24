import { requirePermiso } from "@/lib/auth/require-permiso"
import { listColores } from "@/lib/db/color"
import ColoresClient from "@/components/materiales/colores-client"

export default async function ColoresPage() {
  await requirePermiso("mod_orden_produccion")
  const colores = await listColores()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#0D1821" }}>
          Catálogo de colores
        </h1>
        <p className="text-sm text-stone-500 mt-1">Colores predefinidos para asignar a telas de OP</p>
      </div>
      <ColoresClient colores={colores} />
    </div>
  )
}
