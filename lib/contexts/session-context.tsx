"use client"

import * as React from "react"
import type { SessionPayload } from "@/lib/auth/session"
import type { PermisoRow } from "@/lib/db/permiso"

interface SessionContextValue {
  session: SessionPayload
  permiso: PermisoRow | null
}

const SessionContext = React.createContext<SessionContextValue | undefined>(undefined)

export function SessionProvider({
  session,
  permiso,
  children,
}: {
  session: SessionPayload
  permiso: PermisoRow | null
  children: React.ReactNode
}) {
  const value = React.useMemo(() => ({ session, permiso }), [session, permiso])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const ctx = React.useContext(SessionContext)
  if (!ctx) throw new Error("useSession debe usarse dentro de SessionProvider")
  return ctx
}
