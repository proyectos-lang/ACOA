"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown } from "lucide-react"
import { useSession } from "@/lib/contexts/session-context"
import { NAV_GRUPOS, grupoDeRuta, itemsVisibles, esRutaActiva } from "@/lib/nav"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
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

// Los grupos que la persona contrae se recuerdan en este navegador. Se
// guardan los cerrados (no los abiertos) para que un grupo nuevo aparezca
// abierto por defecto.
const CLAVE_CERRADOS = "acoa.nav.cerrados"

function getInitials(name: string): string {
  if (!name) return "U"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function ERPSidebar() {
  const pathname = usePathname()
  const { session, permiso } = useSession()
  const ubicacion = grupoDeRuta(pathname)

  const [cerrados, setCerrados] = React.useState<Set<string>>(new Set())
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(CLAVE_CERRADOS)
      if (raw) setCerrados(new Set(JSON.parse(raw) as string[]))
    } catch {
      // Sin almacenamiento disponible: todos los grupos quedan abiertos
    }
  }, [])

  function alternar(key: string) {
    setCerrados((prev) => {
      const siguiente = new Set(prev)
      if (siguiente.has(key)) siguiente.delete(key)
      else siguiente.add(key)
      try {
        localStorage.setItem(CLAVE_CERRADOS, JSON.stringify([...siguiente]))
      } catch {
        // Si no se puede guardar, igual se aplica en esta sesion
      }
      return siguiente
    })
  }

  // El grupo de la ruta activa siempre se ve abierto: nadie debe perder de
  // vista donde esta parado
  const estaAbierto = (key: string) => !cerrados.has(key) || ubicacion?.grupo.key === key

  const grupos = NAV_GRUPOS.map((grupo) => ({ grupo, items: itemsVisibles(grupo, permiso) })).filter(
    (g) => g.items.length > 0
  )

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black tracking-tight text-white shadow-sm"
            style={{ backgroundColor: "#344966" }}
          >
            A
          </div>
          <div className="min-w-0 leading-tight">
            <span className="block text-lg font-bold tracking-tight" style={{ color: "#0D1821" }}>
              ACOA
            </span>
            <span className="block text-[11px] text-stone-400">Sistema de gestión</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0 py-1">
        {grupos.map(({ grupo, items }) => {
          const abierto = estaAbierto(grupo.key)
          const esGrupoActivo = ubicacion?.grupo.key === grupo.key
          return (
            <Collapsible key={grupo.key} open={abierto} onOpenChange={() => alternar(grupo.key)}>
              <SidebarGroup className="py-1.5">
                <CollapsibleTrigger
                  className="group/trigger flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                  title={grupo.descripcion}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: grupo.color, boxShadow: `0 0 0 3px ${grupo.colorSuave}` }}
                  />
                  <span
                    className="truncate text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: esGrupoActivo ? grupo.color : "#57534e" }}
                  >
                    {grupo.label}
                  </span>
                  <span className="ml-auto rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-stone-500">
                    {items.length}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-stone-400 transition-transform duration-200 group-data-[state=open]/trigger:rotate-180" />
                </CollapsibleTrigger>

                <CollapsibleContent className="data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0">
                  <SidebarGroupContent className="pt-1">
                    <SidebarMenu className="gap-0.5">
                      {items.map((item) => {
                        const Icon = item.icon
                        const activo = esRutaActiva(item.href, pathname) && ubicacion?.item.href === item.href
                        return (
                          <SidebarMenuItem key={item.href}>
                            <SidebarMenuButton
                              asChild
                              isActive={activo}
                              tooltip={item.descripcion}
                              className="h-9 rounded-lg px-2.5 data-[active=true]:font-semibold"
                              style={
                                activo
                                  ? {
                                      backgroundColor: grupo.colorSuave,
                                      boxShadow: `inset 3px 0 0 ${grupo.color}`,
                                      color: "#0D1821",
                                    }
                                  : undefined
                              }
                            >
                              <Link href={item.href} className="flex items-center gap-2.5">
                                <Icon className="h-4 w-4 shrink-0" style={{ color: grupo.color }} />
                                <span className="truncate">{item.nombre}</span>
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
          )
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
            style={{ backgroundColor: "#abcde0", color: "#0D1821" }}
          >
            {getInitials(session.nombreCompleto)}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-xs font-medium text-sidebar-foreground">{session.nombreCompleto}</span>
            <span className="truncate text-xs text-muted-foreground">@{session.nombreUsuario}</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
