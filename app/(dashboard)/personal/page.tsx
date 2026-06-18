import { requirePermiso } from "@/lib/auth/require-permiso"
import { listPersonas } from "@/lib/db/persona"
import { PersonalClient } from "@/components/personal/personal-client"

export default async function PersonalPage() {
  const { session } = await requirePermiso("mod_personal")
  const personas = await listPersonas()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#0D1821" }}>
          Personal
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Gestión del headcount — empleados y contratistas
        </p>
      </div>
      <PersonalClient personas={personas} sessionUserId={session.userId} />
    </div>
  )
}
