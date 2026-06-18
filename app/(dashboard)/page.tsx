import { getSession } from "@/lib/auth/session"
import { getPermiso } from "@/lib/db/permiso"
import { redirect } from "next/navigation"
import { Users, UserCheck, Settings, LayoutDashboard, Calculator } from "lucide-react"
import Link from "next/link"

const MODULOS = [
  { label: "Usuarios",       href: "/usuarios",      icon: Users,       permisoKey: "mod_usuarios"      },
  { label: "Personal",       href: "/personal",      icon: UserCheck,   permisoKey: "mod_personal"      },
  { label: "Nómina",         href: "/nomina",        icon: Calculator,  permisoKey: "mod_nomina"        },
  { label: "Configuración",  href: "/configuracion", icon: Settings,    permisoKey: "mod_configuracion" },
] as const

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const permiso = await getPermiso(session.userId)

  const accesos = MODULOS.filter((m) => permiso?.[m.permisoKey])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#0D1821" }}>
          Bienvenido, {session.nombreCompleto}
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          {new Date().toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {accesos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accesos.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-stone-300 transition-all duration-200"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: "#344966" + "18" }}>
                  <Icon className="h-6 w-6" style={{ color: "#344966" }} />
                </div>
                <div>
                  <p className="font-semibold text-stone-800 group-hover:text-stone-900">{item.label}</p>
                  <p className="text-xs text-stone-400">Acceder al módulo</p>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <LayoutDashboard className="h-12 w-12 text-stone-300 mb-4" />
          <p className="text-stone-500 font-medium">No tienes módulos habilitados</p>
          <p className="text-sm text-stone-400 mt-1">Contacta al administrador para obtener acceso</p>
        </div>
      )}
    </div>
  )
}
