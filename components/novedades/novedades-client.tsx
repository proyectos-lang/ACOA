"use client"

import * as React from "react"
import { useActionState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react"
import type { NovedadConPersona, TipoNovedad } from "@/lib/db/novedad"
import { TIPO_NOVEDAD_LABEL } from "@/lib/db/novedad"
import type { PersonaRow } from "@/lib/db/persona"
import {
  crearNovedadAction,
  editarNovedadAction,
  eliminarNovedadAction,
  type NovedadActionResult,
} from "@/app/(dashboard)/asistencia/novedades/actions"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Props {
  novedades: NovedadConPersona[]
  personas: PersonaRow[]
}

const TIPO_COLORS: Record<TipoNovedad, string> = {
  falta_justificada:   "bg-yellow-100 text-yellow-800",
  falta_injustificada: "bg-red-100 text-red-800",
  incapacidad:         "bg-orange-100 text-orange-800",
  licencia:            "bg-blue-100 text-blue-800",
  permiso:             "bg-purple-100 text-purple-800",
  vacaciones:          "bg-green-100 text-green-800",
}

const INICIAL: NovedadActionResult = {}

function NovedadForm({
  personas,
  defaultValues,
  action,
  onSuccess,
}: {
  personas: PersonaRow[]
  defaultValues?: Partial<NovedadConPersona>
  action: (prev: NovedadActionResult, fd: FormData) => Promise<NovedadActionResult>
  onSuccess: () => void
}) {
  const [state, formAction, pending] = useActionState(action, INICIAL)
  const prevSuccess = React.useRef(false)

  React.useEffect(() => {
    if (state.success && !prevSuccess.current) {
      prevSuccess.current = true
      onSuccess()
    }
  }, [state.success, onSuccess])

  return (
    <form action={formAction} className="space-y-4">
      {defaultValues?.id && (
        <input type="hidden" name="id" value={defaultValues.id} />
      )}

      <div className="space-y-1">
        <label className="text-sm font-medium text-stone-700">Persona</label>
        <select
          name="persona_id"
          defaultValue={defaultValues?.persona_id ?? ""}
          disabled={!!defaultValues?.id}
          className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966] disabled:bg-stone-50"
        >
          <option value="">Seleccionar…</option>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} ({p.documento})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-stone-700">Tipo</label>
        <select
          name="tipo"
          defaultValue={defaultValues?.tipo ?? ""}
          className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
        >
          <option value="">Seleccionar…</option>
          {(Object.keys(TIPO_NOVEDAD_LABEL) as TipoNovedad[]).map((t) => (
            <option key={t} value={t}>
              {TIPO_NOVEDAD_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-stone-700">Fecha inicio</label>
          <input
            type="date"
            name="fecha_inicio"
            defaultValue={defaultValues?.fecha_inicio ?? ""}
            className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-stone-700">Fecha fin</label>
          <input
            type="date"
            name="fecha_fin"
            defaultValue={defaultValues?.fecha_fin ?? ""}
            className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-stone-700">Observación</label>
        <textarea
          name="observacion"
          defaultValue={defaultValues?.observacion ?? ""}
          rows={2}
          className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966] resize-none"
          placeholder="Opcional…"
        />
      </div>

      {state.error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
        style={{ backgroundColor: "#344966" }}
      >
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  )
}

export function NovedadesClient({ novedades: novedadesInicial, personas }: Props) {
  const router = useRouter()
  const [novedades] = React.useState(novedadesInicial)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editRow, setEditRow] = React.useState<NovedadConPersona | null>(null)
  const [deleteId, setDeleteId] = React.useState<number | null>(null)
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)

  function showToast(tipo: "ok" | "error", msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 3500)
  }

  function handleSuccess() {
    setDialogOpen(false)
    setEditRow(null)
    showToast("ok", editRow ? "Novedad actualizada" : "Novedad creada")
    router.refresh()
  }

  async function handleDelete() {
    if (!deleteId) return
    const res = await eliminarNovedadAction(deleteId)
    setDeleteId(null)
    if (res.error) {
      showToast("error", res.error)
    } else {
      showToast("ok", "Novedad eliminada")
      router.refresh()
    }
  }

  function formatDate(d: string) {
    return new Date(`${d}T12:00:00Z`).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }

  return (
    <div className="space-y-4">
      {/* Acciones */}
      <div className="flex justify-end">
        <button
          onClick={() => { setEditRow(null); setDialogOpen(true) }}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: "#344966" }}
        >
          <Plus className="h-4 w-4" />
          Nueva novedad
        </button>
      </div>

      {/* Toast */}
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

      {/* Tabla */}
      {novedades.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
          <p className="text-stone-400 text-sm">No hay novedades registradas</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                    Persona
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                    Tipo
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                    Inicio
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                    Fin
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                    Observación
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {novedades.map((nov) => (
                  <tr key={nov.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-stone-800">{nov.persona?.nombre ?? "—"}</p>
                      <p className="text-xs text-stone-400">{nov.persona?.documento ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${TIPO_COLORS[nov.tipo]}`}>
                        {TIPO_NOVEDAD_LABEL[nov.tipo]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-stone-600 font-mono text-xs">
                      {formatDate(nov.fecha_inicio)}
                    </td>
                    <td className="px-4 py-3 text-center text-stone-600 font-mono text-xs">
                      {formatDate(nov.fecha_fin)}
                    </td>
                    <td className="px-4 py-3 text-stone-500 text-xs max-w-xs truncate">
                      {nov.observacion ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => { setEditRow(nov); setDialogOpen(true) }}
                          className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(nov.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dialog crear/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editRow ? "Editar novedad" : "Nueva novedad"}</DialogTitle>
          </DialogHeader>
          <NovedadForm
            personas={personas}
            defaultValues={editRow ?? undefined}
            action={editRow ? editarNovedadAction : crearNovedadAction}
            onSuccess={handleSuccess}
          />
        </DialogContent>
      </Dialog>

      {/* Confirm eliminar */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar novedad?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
