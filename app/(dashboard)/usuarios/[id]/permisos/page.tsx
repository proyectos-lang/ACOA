import { requirePermiso } from "@/lib/auth/require-permiso"
import { getUsuarioById } from "@/lib/db/usuario"
import { getPermiso, PERMISO_MODULOS } from "@/lib/db/permiso"
import { notFound } from "next/navigation"
import { PermisosClient } from "@/components/usuarios/permisos-client"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function PermisosPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermiso("mod_usuarios")

  const { id } = await params
  const usuarioId = Number(id)
  if (isNaN(usuarioId)) notFound()

  const [usuario, permiso] = await Promise.all([
    getUsuarioById(usuarioId),
    getPermiso(usuarioId),
  ])

  if (!usuario) notFound()

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link
          href="/usuarios"
          className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Usuarios
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#0D1821" }}>
          Permisos — {usuario.nombre_completo ?? usuario.nombre_usuario}
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          @{usuario.nombre_usuario} · {usuario.activo ? "Activo" : "Inactivo"}
        </p>
      </div>

      <PermisosClient
        usuarioId={usuarioId}
        permiso={permiso}
        modulos={PERMISO_MODULOS}
      />
    </div>
  )
}
