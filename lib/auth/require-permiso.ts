import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import { getPermiso, type PermisoRow, type PermisoKey } from "@/lib/db/permiso"

export async function requireSession() {
  const session = await getSession()
  if (!session) redirect("/login")
  return session
}

export async function requirePermiso(key: PermisoKey) {
  const session = await requireSession()
  const permiso = await getPermiso(session.userId)
  if (!permiso || !permiso[key as keyof PermisoRow]) redirect("/")
  return { session, permiso }
}
