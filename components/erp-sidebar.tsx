"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "@/lib/contexts/session-context"
import type { PermisoRow } from "@/lib/db/permiso"
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Clock,
  Calculator,
  ClipboardList,
  Palette,
  Scissors,
  Printer,
  Layers,
  Hash,
  Package,
  Settings,
  Database,
  BarChart3,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown } from "lucide-react"

type NavItem = {
  nombre: string
  href: string
  icon: React.ElementType
  permisoKey: keyof PermisoRow | null
}

type NavGroup = {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Administrativo",
    items: [
      { nombre: "Dashboard",     href: "/",              icon: LayoutDashboard, permisoKey: null               },
      { nombre: "Usuarios",      href: "/usuarios",      icon: Users,           permisoKey: "mod_usuarios"     },
      { nombre: "Personal",      href: "/personal",      icon: UserCheck,       permisoKey: "mod_personal"     },
      { nombre: "Asistencia",    href: "/asistencia",    icon: Clock,           permisoKey: "mod_asistencia"   },
      { nombre: "Nómina",        href: "/nomina",        icon: Calculator,      permisoKey: "mod_nomina"       },
      { nombre: "Configuración", href: "/configuracion", icon: Settings,        permisoKey: "mod_configuracion"},
    ],
  },
  {
    label: "Operación",
    items: [
      { nombre: "Seguimiento",      href: "/seguimiento",   icon: BarChart3,     permisoKey: "mod_seguimiento"      },
      { nombre: "Orden Producción", href: "/produccion",    icon: ClipboardList, permisoKey: "mod_orden_produccion" },
      { nombre: "Materiales",       href: "/materiales",    icon: Database,      permisoKey: "mod_orden_produccion" },
      { nombre: "Diseño",           href: "/diseno",        icon: Palette,       permisoKey: "mod_diseno"           },
      { nombre: "Corte",            href: "/corte",         icon: Scissors,      permisoKey: "mod_corte"            },
      { nombre: "Estampación",      href: "/estampacion",   icon: Printer,       permisoKey: "mod_estampacion"      },
      { nombre: "Confección",       href: "/confeccion",    icon: Layers,        permisoKey: "mod_confeccion"       },
      { nombre: "Conteo",           href: "/conteo",        icon: Hash,          permisoKey: "mod_conteo"           },
      { nombre: "Empaque",          href: "/empaque",       icon: Package,       permisoKey: "mod_empaque"          },
    ],
  },
]

function getInitials(name: string): string {
  if (!name) return "U"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function ERPSidebar() {
  const pathname = usePathname()
  const { session, permiso } = useSession()

  const gruposVisibles = NAV_GROUPS.map((grupo) => ({
    ...grupo,
    items: grupo.items.filter((item) => {
      if (!item.permisoKey) return true
      return permiso?.[item.permisoKey] === true
    }),
  })).filter((grupo) => grupo.items.length > 0)

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-5">
        <Link href="/" className="flex items-center justify-center">
          <span className="text-2xl font-bold tracking-tight" style={{ color: "#0D1821" }}>
            ACOA
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {gruposVisibles.map((grupo) => (
          <Collapsible key={grupo.label} defaultOpen className="group/collapsible">
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  {grupo.label}
                  <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {grupo.items.map((item) => {
                      const Icon = item.icon
                      const activo = item.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.href)
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={activo}>
                            <Link href={item.href} className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              <span>{item.nombre}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
            style={{ backgroundColor: "#abcde0", color: "#0D1821" }}
          >
            {getInitials(session.nombreCompleto)}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-sidebar-foreground truncate">{session.nombreCompleto}</span>
            <span className="text-xs text-muted-foreground truncate">@{session.nombreUsuario}</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
