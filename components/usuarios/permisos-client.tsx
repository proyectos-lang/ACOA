"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { actualizarPermisosAction } from "@/app/(dashboard)/usuarios/actions"
import type { PermisoRow, PermisoKey } from "@/lib/db/permiso"

type ModuloConfig = { key: PermisoKey; label: string }

export function PermisosClient({
  usuarioId,
  permiso,
  modulos,
}: {
  usuarioId: number
  permiso: PermisoRow | null
  modulos: readonly ModuloConfig[]
}) {
  const { toast } = useToast()
  const [estado, setEstado] = React.useState<Record<PermisoKey, boolean>>(
    () => Object.fromEntries(modulos.map((m) => [m.key, permiso?.[m.key] ?? false])) as Record<PermisoKey, boolean>
  )
  const [pending, setPending] = React.useState(false)

  function toggle(key: PermisoKey) {
    setEstado((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  async function guardar() {
    setPending(true)
    const res = await actualizarPermisosAction(usuarioId, estado)
    setPending(false)
    if (res.error) {
      toast({ title: "Error", description: res.error, variant: "destructive" })
    } else {
      toast({ title: "Permisos guardados" })
    }
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <div className="p-5 border-b border-stone-100">
        <p className="text-sm text-stone-500">
          Activa o desactiva los módulos a los que este usuario puede acceder.
        </p>
      </div>

      <div className="divide-y divide-stone-100">
        {modulos.map((m) => (
          <div key={m.key} className="flex items-center justify-between px-5 py-4">
            <span className="text-sm font-medium text-stone-800">{m.label}</span>
            <Switch
              checked={estado[m.key]}
              onCheckedChange={() => toggle(m.key)}
            />
          </div>
        ))}
      </div>

      <div className="p-5 border-t border-stone-100 flex justify-end">
        <Button
          onClick={guardar}
          disabled={pending}
          style={{ backgroundColor: "#344966" }}
          className="text-white hover:opacity-90"
        >
          {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Guardar permisos
        </Button>
      </div>
    </div>
  )
}
