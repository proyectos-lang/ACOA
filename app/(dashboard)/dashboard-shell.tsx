"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { LogOut, Loader2 } from "lucide-react"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SessionProvider } from "@/lib/contexts/session-context"
import { logoutAction } from "@/app/login/actions"
import type { SessionPayload } from "@/lib/auth/session"
import type { PermisoRow } from "@/lib/db/permiso"

const ERPSidebar = dynamic(
  () => import("@/components/erp-sidebar").then((m) => ({ default: m.ERPSidebar })),
  {
    ssr: false,
    loading: () => (
      <div className="w-64 border-r border-sidebar-border bg-sidebar flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    ),
  }
)

function getInitials(name: string): string {
  if (!name) return "U"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function DashboardShell({
  session,
  permiso,
  children,
}: {
  session: SessionPayload
  permiso: PermisoRow | null
  children: React.ReactNode
}) {
  return (
    <SessionProvider session={session} permiso={permiso}>
      <SidebarProvider>
        <ERPSidebar />
        <SidebarInset className="bg-stone-50 min-h-screen">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-stone-200/60 bg-white/80 backdrop-blur-sm px-4 md:px-6">
            <SidebarTrigger className="-ml-1 md:-ml-2 rounded-lg hover:bg-stone-100 transition-colors duration-200" />

            {/* Nombre de la empresa */}
            <div className="flex items-center gap-3">
              <span className="font-bold text-xl tracking-tight" style={{ color: "#0D1821" }}>
                ACOA
              </span>
            </div>

            {/* Usuario a la derecha */}
            <div className="ml-auto flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 px-3 py-1.5 rounded-xl hover:bg-stone-100 transition-colors">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-medium text-stone-800 leading-tight">{session.nombreCompleto}</p>
                      <p className="text-xs text-stone-500 leading-tight">@{session.nombreUsuario}</p>
                    </div>
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-full text-white text-xs font-semibold shadow-sm"
                      style={{ backgroundColor: "#abcde0" }}
                    >
                      <span style={{ color: "#0D1821" }}>{getInitials(session.nombreCompleto)}</span>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl">
                  <DropdownMenuLabel>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{session.nombreCompleto}</span>
                      <span className="text-xs text-stone-500 font-normal">@{session.nombreUsuario}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <form action={logoutAction}>
                      <button
                        type="submit"
                        className="flex w-full items-center text-red-600 focus:text-red-700 cursor-pointer"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Cerrar sesión
                      </button>
                    </form>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 md:p-6">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </SessionProvider>
  )
}
