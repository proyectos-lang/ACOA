import { getSession } from "@/lib/auth/session"
import { getPermiso } from "@/lib/db/permiso"
import { redirect } from "next/navigation"
import { LayoutDashboard, ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { NAV_GRUPOS, itemsVisibles } from "@/lib/nav"

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const permiso = await getPermiso(session.userId)

  // Los mismos grupos y colores del menu lateral, sin la propia portada
  const grupos = NAV_GRUPOS.map((grupo) => ({
    grupo,
    items: itemsVisibles(grupo, permiso).filter((i) => i.href !== "/"),
  })).filter((g) => g.items.length > 0)

  const totalModulos = grupos.reduce((s, g) => s + g.items.length, 0)

  // "martes, 6 de octubre de 2026" -> solo la primera letra en mayuscula
  const fechaLarga = new Date().toLocaleDateString("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Bogota",
  })
  const fecha = fechaLarga.charAt(0).toUpperCase() + fechaLarga.slice(1)

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#0D1821" }}>
            Bienvenido, {session.nombreCompleto}
          </h1>
          <p className="mt-1 text-sm text-stone-500">{fecha}</p>
        </div>
        <p className="text-xs text-stone-400">
          {totalModulos} {totalModulos === 1 ? "módulo habilitado" : "módulos habilitados"} en{" "}
          {grupos.length} {grupos.length === 1 ? "área" : "áreas"}
        </p>
      </div>

      {grupos.length > 0 ? (
        grupos.map(({ grupo, items }) => (
          <section key={grupo.key} className="space-y-3">
            <div className="flex items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: grupo.color, boxShadow: `0 0 0 4px ${grupo.colorSuave}` }}
              />
              <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: grupo.color }}>
                {grupo.label}
              </h2>
              <span className="hidden text-xs text-stone-400 sm:inline">— {grupo.descripcion}</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group relative flex items-start gap-3.5 overflow-hidden rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md"
                  >
                    <span
                      className="absolute inset-y-0 left-0 w-1 opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ backgroundColor: grupo.color }}
                    />
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: grupo.colorSuave }}
                    >
                      <Icon className="h-5 w-5" style={{ color: grupo.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 font-semibold text-stone-800 group-hover:text-stone-900">
                        <span className="truncate">{item.nombre}</span>
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-stone-300 transition-colors group-hover:text-stone-500" />
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-stone-500">{item.descripcion}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        ))
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <LayoutDashboard className="mb-4 h-12 w-12 text-stone-300" />
          <p className="font-medium text-stone-500">No tienes módulos habilitados</p>
          <p className="mt-1 text-sm text-stone-400">Contacta al administrador para obtener acceso</p>
        </div>
      )}
    </div>
  )
}
