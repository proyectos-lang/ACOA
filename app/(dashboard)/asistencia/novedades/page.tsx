import { requirePermiso } from "@/lib/auth/require-permiso"
import { listNovedades } from "@/lib/db/novedad"
import { listPersonas } from "@/lib/db/persona"
import { NovedadesClient } from "@/components/novedades/novedades-client"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function NovedadesPage() {
  await requirePermiso("mod_asistencia")

  const [novedades, personas] = await Promise.all([
    listNovedades(),
    listPersonas({ estado: "activo" }),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link
          href="/asistencia"
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-stone-500 hover:bg-stone-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Asistencia
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#0D1821" }}>
            Novedades
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Faltas, incapacidades, licencias y permisos
          </p>
        </div>
      </div>

      <NovedadesClient novedades={novedades} personas={personas} />
    </div>
  )
}
