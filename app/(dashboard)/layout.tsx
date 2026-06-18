import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import { getPermiso } from "@/lib/db/permiso"
import { DashboardShell } from "./dashboard-shell"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const permiso = await getPermiso(session.userId)

  return (
    <DashboardShell session={session} permiso={permiso}>
      {children}
    </DashboardShell>
  )
}
