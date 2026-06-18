"use client"

import * as React from "react"
import { useActionState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react"
import type { MaterialRow } from "@/lib/db/material"
import {
  crearMaterialAction,
  editarMaterialAction,
  eliminarMaterialAction,
  type MaterialActionResult,
} from "@/app/(dashboard)/materiales/actions"
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
  materiales: MaterialRow[]
  tiposExistentes: string[]
  unidadesExistentes: string[]
}

const INICIAL: MaterialActionResult = {}

function cop(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n)
}

function MaterialForm({
  defaultValues,
  action,
  tiposExistentes,
  unidadesExistentes,
  onSuccess,
}: {
  defaultValues?: MaterialRow
  action: (prev: MaterialActionResult, fd: FormData) => Promise<MaterialActionResult>
  tiposExistentes: string[]
  unidadesExistentes: string[]
  onSuccess: () => void
}) {
  const [state, formAction, pending] = useActionState(action, INICIAL)
  const done = React.useRef(false)

  React.useEffect(() => {
    if (state.success && !done.current) {
      done.current = true
      onSuccess()
    }
  }, [state.success, onSuccess])

  const fieldCls =
    "w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"

  return (
    <form action={formAction} className="space-y-4">
      {defaultValues?.id && (
        <input type="hidden" name="id" value={defaultValues.id} />
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-stone-700">Tipo</label>
          <input
            list="tipos-list"
            name="tipo"
            defaultValue={defaultValues?.tipo ?? ""}
            placeholder="ej: tela"
            className={fieldCls}
          />
          <datalist id="tipos-list">
            {tiposExistentes.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-stone-700">Unidad de medida</label>
          <input
            list="unidades-list"
            name="unidad_medida"
            defaultValue={defaultValues?.unidad_medida ?? ""}
            placeholder="ej: metro"
            className={fieldCls}
          />
          <datalist id="unidades-list">
            {unidadesExistentes.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-stone-700">Nombre</label>
        <input
          type="text"
          name="nombre"
          defaultValue={defaultValues?.nombre ?? ""}
          placeholder="Nombre del material"
          className={fieldCls}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-stone-700">Valor unitario (COP)</label>
          <input
            type="number"
            name="valor_unitario"
            min="0"
            step="0.0001"
            defaultValue={defaultValues?.valor_unitario ?? 0}
            className={fieldCls}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-stone-700">Estado</label>
          <select
            name="activo"
            defaultValue={defaultValues?.activo !== false ? "true" : "false"}
            className={fieldCls}
          >
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>
        </div>
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

export function MaterialesClient({
  materiales: inicial,
  tiposExistentes,
  unidadesExistentes,
}: Props) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editRow, setEditRow] = React.useState<MaterialRow | null>(null)
  const [deleteId, setDeleteId] = React.useState<number | null>(null)
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)

  // Filtros locales
  const [filtroBusqueda, setFiltroBusqueda] = React.useState("")
  const [filtroActivo, setFiltroActivo] = React.useState<"todos" | "true" | "false">("todos")

  const materiales = inicial.filter((m) => {
    const b = filtroBusqueda.trim().toLowerCase()
    const matchBusqueda =
      !b || m.nombre.toLowerCase().includes(b) || m.tipo.toLowerCase().includes(b)
    const matchActivo =
      filtroActivo === "todos" ||
      (filtroActivo === "true" ? m.activo : !m.activo)
    return matchBusqueda && matchActivo
  })

  function showToast(tipo: "ok" | "error", msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 3000)
  }

  function handleSuccess() {
    setDialogOpen(false)
    setEditRow(null)
    showToast("ok", editRow ? "Material actualizado" : "Material creado")
    router.refresh()
  }

  async function handleDelete() {
    if (!deleteId) return
    const res = await eliminarMaterialAction(deleteId)
    setDeleteId(null)
    if (res.error) showToast("error", res.error)
    else { showToast("ok", "Material eliminado"); router.refresh() }
  }

  return (
    <div className="space-y-4">
      {/* Barra */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Buscar por nombre o tipo…"
          value={filtroBusqueda}
          onChange={(e) => setFiltroBusqueda(e.target.value)}
          className="rounded-xl border border-stone-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#344966] w-64"
        />
        <select
          value={filtroActivo}
          onChange={(e) => setFiltroActivo(e.target.value as "todos" | "true" | "false")}
          className="rounded-xl border border-stone-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
        >
          <option value="todos">Todos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
        <button
          onClick={() => { setEditRow(null); setDialogOpen(true) }}
          className="ml-auto flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: "#344966" }}
        >
          <Plus className="h-4 w-4" />
          Nuevo material
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
          {toast.tipo === "ok" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Tabla */}
      {materiales.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
          <p className="text-stone-400 text-sm">No hay materiales que coincidan</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  {["Tipo", "Nombre", "Unidad", "Valor unitario", "Estado", ""].map((h) => (
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
                {materiales.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-stone-100 text-stone-600">
                        {m.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-stone-800">{m.nombre}</td>
                    <td className="px-4 py-3 text-stone-500 text-xs">{m.unidad_medida}</td>
                    <td className="px-4 py-3 font-mono text-stone-700">{cop(Number(m.valor_unitario))}</td>
                    <td className="px-4 py-3">
                      {m.activo ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-stone-100 text-stone-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setEditRow(m); setDialogOpen(true) }}
                          className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(m.id)}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editRow ? "Editar material" : "Nuevo material"}</DialogTitle>
          </DialogHeader>
          <MaterialForm
            defaultValues={editRow ?? undefined}
            action={editRow ? editarMaterialAction : crearMaterialAction}
            tiposExistentes={tiposExistentes}
            unidadesExistentes={unidadesExistentes}
            onSuccess={handleSuccess}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar material?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
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
