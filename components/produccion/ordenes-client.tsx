"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Plus, Eye, AlertTriangle, CheckCircle2, FileText, Trash2 } from "lucide-react"
import type { OrdenProduccionRow } from "@/lib/db/orden-produccion"
import { ESTADO_OP_LABEL, ESTADO_OP_COLOR } from "@/lib/db/orden-produccion"
import { crearOrdenAction, eliminarOrdenAction } from "@/app/(dashboard)/produccion/actions"
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
  ordenes: OrdenProduccionRow[]
}

const ESTADOS = Object.entries(ESTADO_OP_LABEL) as Array<[string, string]>

function padOP(n: number) {
  return `OP-${String(n).padStart(4, "0")}`
}

function OrdenForm({ onSuccess }: { onSuccess: (id: number) => void }) {
  const [error, setError] = React.useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = React.useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await crearOrdenAction(fd)
      if (res.error) {
        setError(res.error)
      } else if (res.id) {
        onSuccess(res.id)
      }
    })
  }

  const fieldCls =
    "w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium text-stone-700">Referencia *</label>
        <input type="text" name="referencia" required placeholder="REF-001" className={fieldCls} />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-stone-700">Descripción</label>
        <textarea
          name="descripcion"
          rows={2}
          className={`${fieldCls} resize-none`}
          placeholder="Descripción de la prenda…"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-stone-700">Fecha programación</label>
          <input type="date" name="fecha_programacion" className={fieldCls} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-stone-700">Tipo</label>
          <select name="tipo_prenda" defaultValue="prenda" className={fieldCls}>
            <option value="prenda">Prenda</option>
            <option value="conjunto">Conjunto</option>
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-stone-700">Archivo de molde</label>
        <input
          type="file"
          name="url_molde"
          accept=".pdf,.dxf,.ai,.png,.jpg,.jpeg"
          className="w-full text-sm text-stone-500 file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-1.5 file:text-xs file:font-medium file:bg-stone-100 file:text-stone-600 hover:file:bg-stone-200"
        />
      </div>

      <p className="text-xs text-stone-400">
        Los lotes, colores y capas se gestionan en la pestaña Curva de la OP.
      </p>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
        style={{ backgroundColor: "#344966" }}
      >
        {isPending ? "Creando…" : "Crear orden"}
      </button>
    </form>
  )
}

export function OrdenesClient({ ordenes }: Props) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [filtroEstado, setFiltroEstado] = React.useState("todos")
  const [busqueda, setBusqueda] = React.useState("")
  const [toast, setToast] = React.useState<string | null>(null)
  const [deleteId, setDeleteId] = React.useState<number | null>(null)
  const [isPendingDelete, startDelete] = useTransition()

  function handleEliminarOrden() {
    if (!deleteId) return
    startDelete(async () => {
      const res = await eliminarOrdenAction(deleteId)
      setDeleteId(null)
      setToast(res.error ? `Error: ${res.error}` : "Orden eliminada con todos sus lotes y operaciones")
      setTimeout(() => setToast(null), 4000)
      router.refresh()
    })
  }

  const filtered = ordenes.filter((o) => {
    const b = busqueda.trim().toLowerCase()
    const matchEst = filtroEstado === "todos" || o.estado === filtroEstado
    const matchBusq =
      !b ||
      o.referencia.toLowerCase().includes(b) ||
      (o.descripcion ?? "").toLowerCase().includes(b) ||
      String(o.numero_op).includes(b)
    return matchEst && matchBusq
  })

  function handleSuccess(id: number) {
    setDialogOpen(false)
    setToast("Orden creada exitosamente")
    setTimeout(() => setToast(null), 3000)
    router.push(`/produccion/${id}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Buscar por OP, referencia…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="rounded-xl border border-stone-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#344966] w-60"
        />
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="rounded-xl border border-stone-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
        >
          <option value="todos">Todos los estados</option>
          {ESTADOS.map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button
          onClick={() => setDialogOpen(true)}
          className="ml-auto flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: "#344966" }}
        >
          <Plus className="h-4 w-4" />
          Nueva OP
        </button>
      </div>

      {toast && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium bg-green-50 text-green-800 border border-green-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {toast}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
          <FileText className="h-10 w-10 mx-auto mb-3 text-stone-300" />
          <p className="text-stone-400 text-sm">
            {ordenes.length === 0
              ? 'No hay órdenes. Usa "Nueva OP" para crear la primera.'
              : "Ninguna orden coincide con el filtro."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  {["OP", "Referencia", "Fecha prog.", "Estado", ""].map((h) => (
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
                {filtered.map((op) => (
                  <tr
                    key={op.id}
                    className="border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/produccion/${op.id}`)}
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-stone-700">
                      {padOP(op.numero_op)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-stone-800">{op.referencia}</p>
                      {op.descripcion && (
                        <p className="text-xs text-stone-400 truncate max-w-xs">{op.descripcion}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-stone-600">
                      {op.fecha_programacion ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${ESTADO_OP_COLOR[op.estado]}`}
                      >
                        {ESTADO_OP_LABEL[op.estado]}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => router.push(`/produccion/${op.id}`)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-stone-100 transition-colors text-stone-500"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Ver
                        </button>
                        <button
                          onClick={() => setDeleteId(op.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors"
                          title="Eliminar orden (borra lotes y operaciones)"
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

      {/* Confirmar eliminación de la OP */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar orden de producción?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la orden con TODOS sus lotes y todas sus operaciones
              asociadas (curva, materiales, corte, estampación, confección, conteo,
              empaque, costos y diseño). Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEliminarOrden}
              disabled={isPendingDelete}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              {isPendingDelete ? "Eliminando…" : "Eliminar todo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nueva Orden de Producción</DialogTitle>
          </DialogHeader>
          <OrdenForm onSuccess={handleSuccess} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
