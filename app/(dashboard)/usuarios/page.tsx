import { requirePermiso } from "@/lib/auth/require-permiso"
import { listUsuarios } from "@/lib/db/usuario"
import { UsuariosClient } from "@/components/usuarios/usuarios-client"

export default async function UsuariosPage() {
  const { session } = await requirePermiso("mod_usuarios")
  const usuarios = await listUsuarios()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#0D1821" }}>
          Usuarios
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Gestión de usuarios y permisos del sistema
        </p>
      </div>
      <UsuariosClient usuarios={usuarios} sessionUserId={session.userId} />
    </div>
  )
}
