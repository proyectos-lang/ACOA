import { requirePermiso } from "@/lib/auth/require-permiso"
import { getAsistenciaPorFecha } from "@/lib/db/asistencia-dia"
import { listPersonas } from "@/lib/db/persona"
import { AsistenciaClient } from "@/components/asistencia/asistencia-client"
import { KioscoLink } from "@/components/asistencia/kiosco-link"
import Link from "next/link"
import { CalendarCheck } from "lucide-react"

export default async function AsistenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>
}) {
  await requirePermiso("mod_asistencia")

  const { fecha: fechaParam } = await searchParams
  const fecha =
    fechaParam ??
    new Date().toLocaleDateString("sv-SE", { timeZone: "America/Bogota" })

  const [registros, personas] = await Promise.all([
    getAsistenciaPorFecha(fecha),
    listPersonas({ estado: "activo" }),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#0D1821" }}>
            Asistencia
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Consolidación diaria de marcaciones
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <KioscoLink />
          <Link
            href="/asistencia/novedades"
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium border border-stone-200 bg-white hover:bg-stone-50 transition-colors"
            style={{ color: "#344966" }}
          >
            <CalendarCheck className="h-4 w-4" />
            Novedades
          </Link>
        </div>
      </div>

      <AsistenciaClient fecha={fecha} registros={registros} personas={personas} />
    </div>
  )
}
