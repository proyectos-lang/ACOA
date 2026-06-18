"use client"

import * as React from "react"
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, TrendingUp, TrendingDown, History, AlertTriangle, CheckCircle2 } from "lucide-react"
import type { VStockMaterialRow, MovimientoRow } from "@/lib/db/inventario"
import { getMovimientosAction, crearMovimientoAction } from "@/app/(dashboard)/materiales/inventario/actions"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// ── Helpers ────────────────────────────────────────────────────────────────────

function cop(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 2,
  }).format(n)
}

function fmtCant(n: number, unidad: string) {
  return `${Number(n).toLocaleString("es-CO", { maximumFractionDigits: 4 })} ${unidad}`
}

function fmtFecha(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

const CONCEPTO_LABEL: Record<string, string> = {
  compra:     "Compra",
  ajuste:     "Ajuste",
  devolucion: "Devolución",
  op_consumo: "Consumo OP",
  otro:       "Otro",
}

const fieldCls =
  "w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"

// ── Movement Dialog ────────────────────────────────────────────────────────────

function MovimientoDialog({
  material,
  tipoInicial,
  open,
  onClose,
  onSuccess,
}: {
  material: VStockMaterialRow
  tipoInicial: "entrada" | "salida"
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [tipo, setTipo] = React.useState<"entrada" | "salida">(tipoInicial)
  const [isPending, startTransition] = useTransition()
  const [err, setErr] = React.useState<string | null>(null)
  const formRef = React.useRef<HTMLFormElement>(null)

  React.useEffect(() => { setTipo(tipoInicial); setErr(null) }, [tipoInicial, open])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set("tipo", tipo)
    startTransition(async () => {
      const res = await crearMovimientoAction(material.material_id, fd)
      if (res.error) { setErr(res.error) }
      else { onClose(); onSuccess(); formRef.current?.reset() }
    })
  }

  const todaySv = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Bogota" })

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>
            {tipo === "entrada" ? "Registrar entrada" : "Registrar salida"} — {material.nombre}
          </DialogTitle>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
          {/* Tipo toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTipo("entrada")}
              className={`rounded-xl py-2 text-sm font-semibold border transition-colors ${
                tipo === "entrada"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "border-stone-200 text-stone-600 hover:bg-stone-50"
              }`}
            >
              <TrendingUp className="h-4 w-4 inline mr-1.5" />
              Entrada
            </button>
            <button
              type="button"
              onClick={() => setTipo("salida")}
              className={`rounded-xl py-2 text-sm font-semibold border transition-colors ${
                tipo === "salida"
                  ? "bg-red-600 text-white border-red-600"
                  : "border-stone-200 text-stone-600 hover:bg-stone-50"
              }`}
            >
              <TrendingDown className="h-4 w-4 inline mr-1.5" />
              Salida
            </button>
          </div>

          {/* Concepto */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-stone-700">Concepto</label>
            <select name="concepto" className={fieldCls} defaultValue={tipo === "entrada" ? "compra" : "otro"}>
              {tipo === "entrada" ? (
                <>
                  <option value="compra">Compra</option>
                  <option value="devolucion">Devolución</option>
                  <option value="ajuste">Ajuste</option>
                  <option value="otro">Otro</option>
                </>
              ) : (
                <>
                  <option value="op_consumo">Consumo OP</option>
                  <option value="ajuste">Ajuste</option>
                  <option value="otro">Otro</option>
                </>
              )}
            </select>
          </div>

          {/* Cantidad */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-stone-700">
              Cantidad ({material.unidad_medida})
            </label>
            <input
              type="number"
              name="cantidad"
              min="0.0001"
              step="0.0001"
              required
              className={fieldCls}
              placeholder="0.0000"
              autoFocus
            />
          </div>

          {/* Fecha */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-stone-700">Fecha</label>
            <input type="date" name="fecha" defaultValue={todaySv} className={fieldCls} />
          </div>

          {/* Observación */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-stone-700">Observación (opcional)</label>
            <input type="text" name="observacion" className={fieldCls} placeholder="Ej: Factura #123..." />
          </div>

          {err && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className={`w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60 transition-colors ${
              tipo === "entrada" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {isPending ? "Registrando…" : `Registrar ${tipo}`}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Movement History Panel ─────────────────────────────────────────────────────

function MovimientosPanel({ material }: { material: VStockMaterialRow }) {
  const [movimientos, setMovimientos] = React.useState<MovimientoRow[] | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    setLoading(true)
    getMovimientosAction(material.material_id)
      .then(setMovimientos)
      .finally(() => setLoading(false))
  }, [material.material_id])

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
        <History className="h-4 w-4 text-stone-400" />
        Movimientos — {material.nombre}
      </h3>

      {loading ? (
        <div className="py-8 flex justify-center">
          <div className="h-5 w-5 rounded-full border-2 border-stone-200 border-t-[#344966] animate-spin" />
        </div>
      ) : !movimientos || movimientos.length === 0 ? (
        <p className="text-xs text-stone-400 py-6 text-center">Sin movimientos registrados.</p>
      ) : (
        <div className="overflow-y-auto max-h-[480px] rounded-xl border border-stone-200 divide-y divide-stone-100">
          {movimientos.map((m) => (
            <div key={m.id} className="px-3 py-2.5 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      m.tipo === "entrada"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {m.tipo === "entrada" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {CONCEPTO_LABEL[m.concepto] ?? m.concepto}
                  </span>
                  <span className="text-xs text-stone-400">{fmtFecha(m.fecha)}</span>
                </div>
                {m.observacion && (
                  <p className="text-xs text-stone-500 mt-0.5 truncate">{m.observacion}</p>
                )}
              </div>
              <span
                className={`font-mono text-sm font-semibold whitespace-nowrap ${
                  m.tipo === "entrada" ? "text-emerald-700" : "text-red-600"
                }`}
              >
                {m.tipo === "entrada" ? "+" : "−"}{fmtCant(m.cantidad, material.unidad_medida)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface Props {
  stock: VStockMaterialRow[]
}

export function InventarioClient({ stock }: Props) {
  const router = useRouter()
  const [selectedMat, setSelectedMat] = React.useState<VStockMaterialRow | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [dialogTipo, setDialogTipo] = React.useState<"entrada" | "salida">("entrada")
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)
  const [panelKey, setPanelKey] = React.useState(0)

  function showToast(tipo: "ok" | "error", msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 3500)
  }

  function openDialog(mat: VStockMaterialRow, tipo: "entrada" | "salida") {
    setSelectedMat(mat)
    setDialogTipo(tipo)
    setDialogOpen(true)
  }

  function handleSuccess() {
    showToast("ok", "Movimiento registrado")
    router.refresh()
    setPanelKey((k) => k + 1)
  }

  const totalMateriales = stock.length
  const conStock = stock.filter((m) => m.existencias > 0).length
  const sinStock = stock.filter((m) => m.existencias <= 0 && m.activo).length

  return (
    <div className="space-y-4">
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

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total materiales", value: totalMateriales, color: "text-stone-700" },
          { label: "Con stock", value: conStock, color: "text-emerald-700" },
          { label: "Sin stock (activos)", value: sinStock, color: sinStock > 0 ? "text-red-600" : "text-stone-400" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-center shadow-sm">
            <p className={`text-2xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
            <p className="text-xs text-stone-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Layout: table + panel */}
      <div className={`grid gap-4 ${selectedMat ? "lg:grid-cols-[1fr_340px]" : "grid-cols-1"}`}>
        {/* Stock table */}
        <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-700">Stock actual</h2>
            <span className="text-xs text-stone-400">{stock.length} materiales</span>
          </div>

          {stock.length === 0 ? (
            <p className="py-12 text-center text-sm text-stone-400">Sin materiales en el maestro.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50">
                    {["Material", "Tipo", "Unidad", "Entradas", "Salidas", "Existencias", ""].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-stone-500 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stock.map((m) => {
                    const isSelected = selectedMat?.material_id === m.material_id
                    const bajo = m.activo && m.existencias <= 0
                    return (
                      <tr
                        key={m.material_id}
                        onClick={() => setSelectedMat(isSelected ? null : m)}
                        className={`border-b border-stone-100 last:border-0 cursor-pointer transition-colors ${
                          isSelected ? "bg-[#344966]/5" : bajo ? "bg-red-50/50 hover:bg-red-50" : "hover:bg-stone-50"
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-stone-800">{m.nombre}</p>
                          {!m.activo && (
                            <span className="text-xs text-stone-400">inactivo</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                            {m.tipo}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-stone-500 text-xs">{m.unidad_medida}</td>
                        <td className="px-4 py-2.5 font-mono text-emerald-700 text-xs">
                          +{Number(m.total_entradas).toLocaleString("es-CO", { maximumFractionDigits: 4 })}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-red-600 text-xs">
                          −{Number(m.total_salidas).toLocaleString("es-CO", { maximumFractionDigits: 4 })}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`font-mono font-semibold text-sm ${
                              Number(m.existencias) > 0 ? "text-stone-900" : "text-red-600"
                            }`}
                          >
                            {Number(m.existencias).toLocaleString("es-CO", { maximumFractionDigits: 4 })}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => openDialog(m, "entrada")}
                              className="flex items-center gap-0.5 rounded-lg px-2 py-1 text-xs font-medium border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors"
                            >
                              <Plus className="h-3 w-3" /> Entrada
                            </button>
                            <button
                              onClick={() => openDialog(m, "salida")}
                              className="flex items-center gap-0.5 rounded-lg px-2 py-1 text-xs font-medium border border-red-200 text-red-700 hover:bg-red-50 transition-colors"
                            >
                              <Plus className="h-3 w-3" /> Salida
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Movements panel */}
        {selectedMat && (
          <div className="rounded-2xl border border-stone-200 bg-white shadow-sm p-4 self-start sticky top-20">
            <MovimientosPanel key={`${selectedMat.material_id}-${panelKey}`} material={selectedMat} />
          </div>
        )}
      </div>

      {/* Floating button */}
      {selectedMat && (
        <div className="fixed bottom-6 right-6 flex gap-2 lg:hidden">
          <button
            onClick={() => openDialog(selectedMat, "entrada")}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 shadow-lg"
          >
            <TrendingUp className="h-4 w-4" /> Entrada
          </button>
          <button
            onClick={() => openDialog(selectedMat, "salida")}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-red-600 shadow-lg"
          >
            <TrendingDown className="h-4 w-4" /> Salida
          </button>
        </div>
      )}

      {/* Dialog */}
      {selectedMat && (
        <MovimientoDialog
          material={selectedMat}
          tipoInicial={dialogTipo}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}
