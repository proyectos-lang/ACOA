"use client"

import * as React from "react"
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Palette, Plus, Trash2, Save, X } from "lucide-react"
import type { TelaColorRow } from "@/lib/db/tela-color"
import {
  cargarGamaTelaAction,
  agregarColorTelaAction,
  eliminarColorTelaAction,
  reemplazarGamaTelaAction,
} from "@/app/(dashboard)/materiales/gama-actions"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

// Gestiona la gama de colores preestablecida de una tela. Estos colores se
// cargan automáticamente en la Curva de la OP al seleccionar la tela.
export function GamaColoresDialog({
  materialId,
  nombreTela,
  onMsg,
}: {
  materialId: number
  nombreTela: string
  onMsg: (tipo: "ok" | "error", msg: string) => void
}) {
  const router = useRouter()
  const [abierto, setAbierto] = React.useState(false)
  const [colores, setColores] = React.useState<TelaColorRow[]>([])
  const [nuevo, setNuevo] = React.useState("")
  const [pegado, setPegado] = React.useState("")
  const [modoPegar, setModoPegar] = React.useState(false)
  const [isPending, startTransition] = useTransition()

  const cargar = React.useCallback(() => {
    startTransition(async () => {
      const res = await cargarGamaTelaAction(materialId)
      if (res.error) onMsg("error", res.error)
      else setColores(res.colores ?? [])
    })
  }, [materialId, onMsg])

  React.useEffect(() => {
    if (abierto) cargar()
  }, [abierto, cargar])

  function agregar() {
    const color = nuevo.trim()
    if (!color) return
    startTransition(async () => {
      const res = await agregarColorTelaAction(materialId, color)
      if (res.error) onMsg("error", res.error)
      else {
        setNuevo("")
        cargar()
        router.refresh()
      }
    })
  }

  function quitar(id: number) {
    startTransition(async () => {
      const res = await eliminarColorTelaAction(id)
      if (res.error) onMsg("error", res.error)
      else {
        cargar()
        router.refresh()
      }
    })
  }

  function guardarPegado() {
    // Acepta separados por salto de línea, coma o pipe
    const lista = pegado
      .split(/[\n,|]/)
      .map((c) => c.trim())
      .filter(Boolean)
    if (lista.length === 0) return onMsg("error", "Escribe al menos un color")

    startTransition(async () => {
      const res = await reemplazarGamaTelaAction(materialId, lista)
      if (res.error) onMsg("error", res.error)
      else {
        onMsg("ok", `Gama de ${nombreTela} actualizada (${lista.length} colores)`)
        setPegado("")
        setModoPegar(false)
        cargar()
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-purple-600 transition-colors"
          title="Gama de colores de esta tela"
        >
          <Palette className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-purple-600" />
            Gama de colores — {nombreTela}
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-stone-500">
          Estos colores se cargan automáticamente en la Curva de la orden al seleccionar esta
          tela.
        </p>

        {modoPegar ? (
          <div className="space-y-2">
            <label className="text-xs font-medium text-stone-600">
              Pega la lista de colores (uno por línea, o separados por coma)
            </label>
            <textarea
              value={pegado}
              onChange={(e) => setPegado(e.target.value)}
              rows={8}
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966] resize-none"
              placeholder={"NEGRO\nBLANCO\nARENA\nAPT"}
            />
            <p className="text-[11px] text-amber-600">
              Al guardar se reemplaza la gama completa de esta tela.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={guardarPegado}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: "#344966" }}
              >
                <Save className="h-3.5 w-3.5" /> Guardar gama
              </button>
              <button
                type="button"
                onClick={() => setModoPegar(false)}
                className="flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50"
              >
                <X className="h-3.5 w-3.5" /> Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nuevo}
                onChange={(e) => setNuevo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    agregar()
                  }
                }}
                className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
                placeholder="Nombre del color (ej: NEGRO)"
              />
              <button
                type="button"
                onClick={agregar}
                disabled={isPending || !nuevo.trim()}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 shrink-0"
                style={{ backgroundColor: "#344966" }}
              >
                <Plus className="h-3.5 w-3.5" /> Agregar
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1">
              {colores.length === 0 ? (
                <p className="text-sm text-stone-400 text-center py-6">
                  {isPending ? "Cargando…" : "Esta tela aún no tiene gama de colores."}
                </p>
              ) : (
                colores.map((c, i) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5"
                  >
                    <span className="flex items-center gap-2 text-sm text-stone-800">
                      <span className="font-mono text-[11px] text-stone-400 w-6">{i + 1}</span>
                      {c.color}
                    </span>
                    <button
                      type="button"
                      onClick={() => quitar(c.id)}
                      disabled={isPending}
                      className="p-1 rounded hover:bg-red-50 text-stone-400 hover:text-red-500"
                      title="Quitar color"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-stone-400">
                {colores.length} color{colores.length !== 1 ? "es" : ""} en la gama
              </span>
              <button
                type="button"
                onClick={() => {
                  setPegado(colores.map((c) => c.color).join("\n"))
                  setModoPegar(true)
                }}
                className="text-xs text-stone-500 hover:text-stone-700 underline"
              >
                Editar la lista completa
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
