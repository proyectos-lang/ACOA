"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import {
  Plus, Pencil, Trash2, ExternalLink, CheckCircle2, AlertTriangle, Cake,
} from "lucide-react"
import type { ConfeccionistaRow } from "@/lib/db/confeccionista"
import {
  crearConfeccionistaAction,
  editarConfeccionistaAction,
  toggleConfeccionistaActivoAction,
  eliminarConfeccionistaAction,
} from "@/app/(dashboard)/confeccionistas/actions"
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

const fieldCls =
  "w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"

function esCumpleanosHoy(fechaNacimiento: string | null): boolean {
  if (!fechaNacimiento) return false
  const hoy = new Date()
  const [, mes, dia] = fechaNacimiento.split("-").map(Number)
  return hoy.getMonth() + 1 === mes && hoy.getDate() === dia
}

function ConfeccionistaForm({
  inicial,
  onSubmit,
  isPending,
}: {
  inicial: ConfeccionistaRow | null
  onSubmit: (fd: FormData) => void
  isPending: boolean
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(new FormData(e.currentTarget))
      }}
      className="space-y-3"
    >
      <div className="space-y-1">
        <label className="text-sm font-medium text-stone-700">Nombre completo *</label>
        <input
          type="text"
          name="nombre_completo"
          required
          defaultValue={inicial?.nombre_completo ?? ""}
          className={fieldCls}
          placeholder="Nombre y apellidos"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-stone-700">Teléfono</label>
          <input
            type="tel"
            name="telefono"
            defaultValue={inicial?.telefono ?? ""}
            className={fieldCls}
            placeholder="Fijo"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-stone-700">Celular</label>
          <input
            type="tel"
            name="celular"
            defaultValue={inicial?.celular ?? ""}
            className={fieldCls}
            placeholder="Móvil"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-stone-700">Dirección</label>
          <input
            type="text"
            name="direccion"
            defaultValue={inicial?.direccion ?? ""}
            className={fieldCls}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-stone-700">Barrio</label>
          <input
            type="text"
            name="barrio"
            defaultValue={inicial?.barrio ?? ""}
            className={fieldCls}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-stone-700">Fecha de nacimiento</label>
        <input
          type="date"
          name="fecha_nacimiento"
          defaultValue={inicial?.fecha_nacimiento ?? ""}
          className={fieldCls}
        />
        <p className="text-xs text-stone-400">Se usará para las alertas de cumpleaños</p>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-stone-700">Foto de la cédula</label>
        {inicial?.url_foto_cedula && (
          <a
            href={inicial.url_foto_cedula}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-1 flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> Ver cédula actual
          </a>
        )}
        <input
          type="file"
          name="foto_cedula"
          accept="image/*,.pdf"
          className="w-full text-sm text-stone-500 file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-1.5 file:text-xs file:font-medium file:bg-stone-100 file:text-stone-600 hover:file:bg-stone-200"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        style={{ backgroundColor: "#344966" }}
      >
        {isPending ? "Guardando…" : inicial ? "Guardar cambios" : "Crear confeccionista"}
      </button>
    </form>
  )
}

export function ConfeccionistasClient({ confeccionistas }: { confeccionistas: ConfeccionistaRow[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [editRow, setEditRow] = React.useState<ConfeccionistaRow | null>(null)
  const [deleteId, setDeleteId] = React.useState<number | null>(null)

  function showToast(tipo: "ok" | "error", msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 3500)
  }

  function handleCrear(fd: FormData) {
    startTransition(async () => {
      const res = await crearConfeccionistaAction(fd)
      if (res.error) showToast("error", res.error)
      else {
        setCreateOpen(false)
        showToast("ok", "Confeccionista creado")
        router.refresh()
      }
    })
  }

  function handleEditar(fd: FormData) {
    if (!editRow) return
    startTransition(async () => {
      const res = await editarConfeccionistaAction(editRow.id, fd)
      if (res.error) showToast("error", res.error)
      else {
        setEditRow(null)
        showToast("ok", "Confeccionista actualizado")
        router.refresh()
      }
    })
  }

  function handleToggleActivo(row: ConfeccionistaRow) {
    startTransition(async () => {
      const res = await toggleConfeccionistaActivoAction(row.id, !row.activo)
      if (res.error) showToast("error", res.error)
      else {
        showToast("ok", row.activo ? "Confeccionista desactivado" : "Confeccionista activado")
        router.refresh()
      }
    })
  }

  function handleEliminar() {
    if (!deleteId) return
    startTransition(async () => {
      const res = await eliminarConfeccionistaAction(deleteId)
      setDeleteId(null)
      if (res.error) showToast("error", res.error)
      else {
        showToast("ok", "Confeccionista eliminado")
        router.refresh()
      }
    })
  }

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
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: "#344966" }}
        >
          <Plus className="h-4 w-4" />
          Nuevo confeccionista
        </button>
      </div>

      {confeccionistas.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
          <p className="text-stone-400 text-sm">
            No hay confeccionistas registrados. Crea el primero con "Nuevo confeccionista".
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  {["Nombre", "Celular", "Teléfono", "Barrio", "Nacimiento", "Cédula", "Estado", ""].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide text-left"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {confeccionistas.map((e) => (
                  <tr key={e.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-stone-800 inline-flex items-center gap-1.5">
                        {e.nombre_completo}
                        {esCumpleanosHoy(e.fecha_nacimiento) && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-pink-100 text-pink-700 px-2 py-0.5 text-xs font-semibold"
                            title="¡Hoy es su cumpleaños!"
                          >
                            <Cake className="h-3 w-3" /> Cumpleaños
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-stone-600">{e.celular ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-stone-600">{e.telefono ?? "—"}</td>
                    <td className="px-4 py-3 text-stone-600 text-xs">{e.barrio ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-stone-600">{e.fecha_nacimiento ?? "—"}</td>
                    <td className="px-4 py-3">
                      {e.url_foto_cedula ? (
                        <a
                          href={e.url_foto_cedula}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> Ver
                        </a>
                      ) : (
                        <span className="text-xs text-stone-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActivo(e)}
                        disabled={isPending}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                          e.activo
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                        }`}
                        title="Clic para cambiar"
                      >
                        {e.activo ? "Activo" : "Inactivo"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditRow(e)}
                          className="p-1 rounded hover:bg-stone-100 text-stone-400 hover:text-stone-600"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteId(e.id)}
                          className="p-1 rounded hover:bg-red-50 text-stone-400 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      {/* Dialog crear */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo confeccionista</DialogTitle>
          </DialogHeader>
          <ConfeccionistaForm inicial={null} onSubmit={handleCrear} isPending={isPending} />
        </DialogContent>
      </Dialog>

      {/* Dialog editar */}
      <Dialog open={editRow !== null} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar confeccionista</DialogTitle>
          </DialogHeader>
          <ConfeccionistaForm inicial={editRow} onSubmit={handleEditar} isPending={isPending} />
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminar */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar confeccionista?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Si el confeccionista tiene historial, considera
              desactivarlo en lugar de eliminarlo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEliminar}
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
