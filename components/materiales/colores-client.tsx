"use client"

import * as React from "react"
import { Plus, CheckCircle2, AlertTriangle } from "lucide-react"
import type { ColorRow } from "@/lib/db/color"
import { crearColorAction, toggleColorActivoAction } from "@/app/(dashboard)/materiales/colores/actions"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface Props {
  colores: ColorRow[]
}

const fieldCls =
  "w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"

export default function ColoresClient({ colores: inicial }: Props) {
  const [colores, setColores] = React.useState<ColorRow[]>(inicial)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [nombre, setNombre] = React.useState("")
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)
  const [isPending, startTransition] = React.useTransition()

  React.useEffect(() => { setColores(inicial) }, [inicial])

  function showToast(tipo: "ok" | "error", msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 3000)
  }

  function handleCrear() {
    startTransition(async () => {
      const res = await crearColorAction(nombre)
      if (res.error) {
        showToast("error", res.error)
      } else {
        setDialogOpen(false)
        setNombre("")
        showToast("ok", "Color creado")
        // Optimistic: the page will revalidate
      }
    })
  }

  function handleToggle(color: ColorRow) {
    const nuevo = !color.activo
    setColores((prev) => prev.map((c) => c.id === color.id ? { ...c, activo: nuevo } : c))
    startTransition(async () => {
      const res = await toggleColorActivoAction(color.id, nuevo)
      if (res.error) {
        setColores((prev) => prev.map((c) => c.id === color.id ? { ...c, activo: color.activo } : c))
        showToast("error", res.error)
      }
    })
  }

  const activos = colores.filter((c) => c.activo)
  const inactivos = colores.filter((c) => !c.activo)

  return (
    <div className="space-y-4">
      {toast && (
        <div
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
            toast.tipo === "ok"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {toast.tipo === "ok" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          {toast.msg}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => { setNombre(""); setDialogOpen(true) }}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: "#344966" }}
        >
          <Plus className="h-4 w-4" />
          Nuevo color
        </button>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100">
              <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide text-left">Color</th>
              <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide text-left">Estado</th>
              <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide text-left"></th>
            </tr>
          </thead>
          <tbody>
            {[...activos, ...inactivos].map((c) => (
              <tr key={c.id} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-3 font-medium text-stone-800">{c.nombre}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      c.activo ? "bg-green-100 text-green-800" : "bg-stone-100 text-stone-500"
                    }`}
                  >
                    {c.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggle(c)}
                    className="rounded-lg border border-stone-200 px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
                  >
                    {c.activo ? "Desactivar" : "Activar"}
                  </button>
                </td>
              </tr>
            ))}
            {colores.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-stone-400 text-sm">
                  No hay colores registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo color</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">Nombre *</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCrear() }}
                className={fieldCls}
                placeholder="Ej: Azul marino"
                autoFocus
              />
            </div>
            <button
              onClick={handleCrear}
              disabled={isPending || !nombre.trim()}
              className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "#344966" }}
            >
              {isPending ? "Creando…" : "Crear color"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
