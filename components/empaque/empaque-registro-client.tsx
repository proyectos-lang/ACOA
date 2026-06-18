"use client"

import * as React from "react"
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  PackageCheck,
  ShieldCheck,
} from "lucide-react"
import type { OrdenProduccionRow } from "@/lib/db/orden-produccion"
import type { CurvaTallaRow } from "@/lib/db/curva-talla"
import type { LoteRow } from "@/lib/db/lote"
import { LOTE_ESTADO_COLOR, LOTE_ESTADO_LABEL } from "@/lib/db/lote"
import type { ConteoRow, ConteoDetalleRow } from "@/lib/db/conteo"
import type { EmpaqueRegistroRow } from "@/lib/db/empaque-registro"
import type { PersonaRow } from "@/lib/db/persona"
import {
  crearEmpaqueRegistroAction,
  eliminarEmpaqueRegistroAction,
  finalizarLoteAction,
} from "@/app/(dashboard)/empaque/[id]/actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface Props {
  lote: LoteRow
  orden: OrdenProduccionRow
  curvaTallas: CurvaTallaRow[]
  conteo: ConteoRow | null
  conteoDetalle: ConteoDetalleRow[]
  registros: EmpaqueRegistroRow[]
  empacadoras: PersonaRow[]
}

function padOP(n: number) {
  return `OP-${String(n).padStart(4, "0")}`
}
function padLote(n: number) {
  return `LOTE-${String(n).padStart(4, "0")}`
}
function cop(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 2,
  }).format(n)
}

function Toast({ tipo, msg }: { tipo: "ok" | "error"; msg: string }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
        tipo === "ok"
          ? "bg-green-50 text-green-800 border border-green-200"
          : "bg-red-50 text-red-800 border border-red-200"
      }`}
    >
      {tipo === "ok" ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="h-4 w-4 shrink-0" />
      )}
      {msg}
    </div>
  )
}

export function EmpaqueRegistroClient({
  lote,
  orden,
  curvaTallas,
  conteo,
  conteoDetalle,
  registros,
  empacadoras,
}: Props) {
  const router = useRouter()
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)
  const [isPendingAdd, startAdd] = useTransition()
  const [isPendingDel, startDel] = useTransition()
  const [isPendingFin, startFin] = useTransition()

  const coloresConteo = [...new Set(conteoDetalle.map((d) => d.color))]
  const fechaHoyDefault = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })

  const [personaId, setPersonaId] = React.useState<string>(
    empacadoras[0] ? String(empacadoras[0].id) : ""
  )
  const [color, setColor] = React.useState(coloresConteo[0] ?? lote.color)
  const [talla, setTalla] = React.useState("")
  const [cantidad, setCantidad] = React.useState("")
  const [fecha, setFecha] = React.useState(fechaHoyDefault)

  function showToast(tipo: "ok" | "error", msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const tallasDisponibles = conteoDetalle
    .filter((d) => d.color.toLowerCase() === color.toLowerCase())
    .map((d) => d.talla)

  // Progreso: todas las filas del conteo con lo empacado calculado
  const progreso = conteoDetalle.map((d) => {
    const empacado = registros
      .filter((r) => r.color === d.color && r.talla === d.talla)
      .reduce((s, r) => s + r.cantidad, 0)
    return { color: d.color, talla: d.talla, contado: d.cantidad_contada, empacado, pendiente: d.cantidad_contada - empacado }
  })
  const todoEmpacado = progreso.length > 0 && progreso.every((p) => p.pendiente <= 0)

  const totalEmpacado = registros.reduce((s, r) => s + r.cantidad, 0)
  const totalContado = conteo?.total_contado ?? 0
  const pct = totalContado > 0 ? Math.min(100, Math.round((totalEmpacado / totalContado) * 100)) : 0

  // Disponible por talla (conteo - ya empacado)
  function disponibleParaTalla(c: string, t: string): number {
    const det = conteoDetalle.find(
      (d) => d.color.toLowerCase() === c.toLowerCase() && d.talla.toLowerCase() === t.toLowerCase()
    )
    if (!det) return 0
    const empacado = registros
      .filter((r) => r.color === c && r.talla === t)
      .reduce((s, r) => s + r.cantidad, 0)
    return Math.max(0, det.cantidad_contada - empacado)
  }

  // ── Registrar empaque ──────────────────────────────────────────
  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const cant = parseInt(cantidad, 10)
    if (!cant || cant <= 0) return showToast("error", "Ingrese una cantidad válida")
    if (!personaId) return showToast("error", "Seleccione la empacadora")
    if (!talla) return showToast("error", "Seleccione la talla")

    startAdd(async () => {
      const res = await crearEmpaqueRegistroAction({
        lote_id: lote.id,
        persona_id: parseInt(personaId, 10),
        color,
        talla,
        cantidad: cant,
        fecha: fecha || undefined,
      })
      if (res.error) showToast("error", res.error)
      else {
        showToast("ok", "Registro de empaque guardado")
        setCantidad("")
        router.refresh()
      }
    })
  }

  // ── Eliminar registro ──────────────────────────────────────────
  function handleDelete(id: number) {
    startDel(async () => {
      const res = await eliminarEmpaqueRegistroAction(id, lote.id)
      if (res.error) showToast("error", res.error)
      else {
        showToast("ok", "Registro eliminado")
        router.refresh()
      }
    })
  }

  // ── Finalizar lote ─────────────────────────────────────────────
  function handleFinalizar() {
    startFin(async () => {
      const res = await finalizarLoteAction(lote.id)
      if (res.error) showToast("error", res.error)
      else {
        showToast("ok", "Lote finalizado correctamente")
        router.refresh()
      }
    })
  }

  const loteActivo = lote.estado === "empaque"
  const fieldCls =
    "w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"

  return (
    <div className="space-y-6">
      {toast && <Toast tipo={toast.tipo} msg={toast.msg} />}

      {/* ── Alerta conteo no validado ────────────────────────── */}
      {!conteo?.validado && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          El conteo no está validado. No se puede registrar empaque.
        </div>
      )}

      {/* ── Cabecera ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-stone-500">Lote</p>
            <p className="font-mono font-bold text-stone-800 text-lg">{padLote(lote.numero_lote)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">OP</p>
            <p className="font-mono font-semibold text-stone-700">{padOP(orden.numero_op)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Referencia</p>
            <p className="font-medium text-stone-800">{orden.referencia}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Color</p>
            <p className="font-medium text-stone-800">{lote.color}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Total contado</p>
            <p className="font-mono font-semibold text-stone-700">
              {totalContado.toLocaleString("es-CO")} uds
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Total empacado</p>
            <p className="font-mono font-semibold text-teal-700">
              {totalEmpacado.toLocaleString("es-CO")} uds
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Avance</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-20 h-2 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    pct >= 100 ? "bg-green-500" : "bg-teal-400"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-stone-600 font-mono">{pct}%</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-stone-500">Estado lote</p>
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                LOTE_ESTADO_COLOR[lote.estado] ?? "bg-stone-100 text-stone-700"
              }`}
            >
              {LOTE_ESTADO_LABEL[lote.estado] ?? lote.estado}
            </span>
          </div>
        </div>

        {/* Precio empaque/ud */}
        <div className="mt-3 flex items-center gap-1.5 text-xs text-stone-500">
          <ShieldCheck className="h-3.5 w-3.5" />
          Precio empaque: <strong className="text-stone-700 font-mono">{cop(Number(lote.precio_empaque_unidad))}</strong>/ud
          (snapshot al momento del registro)
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Formulario nuevo registro ─────────────────────── */}
        {loteActivo && conteo?.validado && (
          <form onSubmit={handleAdd}>
            <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4 h-full">
              <h2 className="text-sm font-semibold text-stone-700 border-b border-stone-100 pb-2">
                Registrar empaque
              </h2>

              <div className="space-y-1">
                <label className="text-sm font-medium text-stone-700">Empacadora *</label>
                <select
                  value={personaId}
                  onChange={(e) => setPersonaId(e.target.value)}
                  required
                  className={fieldCls}
                >
                  <option value="">Seleccionar empacadora…</option>
                  {empacadoras.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-stone-700">Color *</label>
                  {coloresConteo.length > 0 ? (
                    <select
                      value={color}
                      onChange={(e) => { setColor(e.target.value); setTalla("") }}
                      required
                      className={fieldCls}
                    >
                      {coloresConteo.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className={fieldCls}
                      placeholder="Color"
                    />
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-stone-700">Talla *</label>
                  <select
                    value={talla}
                    onChange={(e) => setTalla(e.target.value)}
                    required
                    className={fieldCls}
                  >
                    <option value="">Seleccionar talla…</option>
                    {tallasDisponibles.map((t) => {
                      const disp = disponibleParaTalla(color, t)
                      return (
                        <option key={t} value={t} disabled={disp === 0}>
                          {t} (disp: {disp.toLocaleString("es-CO")})
                        </option>
                      )
                    })}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-stone-700">Fecha *</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  required
                  className={fieldCls}
                />
              </div>

              {talla && (
                <p className="text-xs text-stone-500">
                  Disponible para <strong>{color} / {talla}</strong>:{" "}
                  <strong className="text-teal-700">
                    {disponibleParaTalla(color, talla).toLocaleString("es-CO")} uds
                  </strong>
                </p>
              )}

              <div className="space-y-1">
                <label className="text-sm font-medium text-stone-700">Cantidad *</label>
                <input
                  type="number"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  min="1"
                  max={talla ? disponibleParaTalla(color, talla) : undefined}
                  required
                  className={fieldCls}
                  placeholder="0"
                />
              </div>

              <button
                type="submit"
                disabled={isPendingAdd}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 w-full justify-center"
                style={{ backgroundColor: "#344966" }}
              >
                <Plus className="h-4 w-4" />
                {isPendingAdd ? "Registrando…" : "Registrar"}
              </button>
            </div>
          </form>
        )}

        {/* ── Finalizar lote (fuera del form) ──────────────────── */}
        {loteActivo && todoEmpacado && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                disabled={isPendingFin}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 w-full justify-center"
                style={{ backgroundColor: "#065f46" }}
              >
                <PackageCheck className="h-4 w-4" />
                {isPendingFin ? "Finalizando…" : "Finalizar lote"}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>¿Finalizar el lote?</AlertDialogTitle>
                <AlertDialogDescription>
                  El lote <strong>{padLote(lote.numero_lote)}</strong> pasará a estado{" "}
                  <strong>Finalizado</strong>. Si es el último lote de la OP, la orden se
                  marcará como <strong>Terminada</strong>. Esta acción no se puede revertir.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleFinalizar}
                  className="rounded-xl"
                  style={{ backgroundColor: "#065f46" }}
                >
                  Finalizar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* ── Progreso del empaque ─────────────────────────── */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-stone-700 border-b border-stone-100 pb-2">
            Progreso del empaque
          </h2>
          {progreso.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-4">Sin detalle de conteo.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left py-2 text-xs text-stone-500 font-medium">Color</th>
                  <th className="text-left py-2 text-xs text-stone-500 font-medium">Talla</th>
                  <th className="text-right py-2 text-xs text-stone-500 font-medium">Contado</th>
                  <th className="text-right py-2 text-xs text-stone-500 font-medium">Empacado</th>
                  <th className="text-right py-2 text-xs text-stone-500 font-medium">Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {progreso.map((p) => (
                  <tr
                    key={`${p.color}||${p.talla}`}
                    className={`border-b border-stone-100 last:border-0 ${p.pendiente <= 0 ? "bg-green-50" : ""}`}
                  >
                    <td className="py-2 text-stone-700">{p.color}</td>
                    <td className="py-2 font-medium text-stone-800">{p.talla}</td>
                    <td className="py-2 text-right font-mono text-stone-600">
                      {p.contado.toLocaleString("es-CO")}
                    </td>
                    <td className="py-2 text-right font-mono text-teal-700 font-semibold">
                      {p.empacado.toLocaleString("es-CO")}
                    </td>
                    <td className={`py-2 text-right font-mono font-semibold ${p.pendiente <= 0 ? "text-green-600" : "text-stone-700"}`}>
                      {p.pendiente <= 0 ? "✓" : p.pendiente.toLocaleString("es-CO")}
                    </td>
                  </tr>
                ))}
                <tr className="bg-stone-50">
                  <td colSpan={2} className="py-2 text-xs font-semibold text-stone-700">Total</td>
                  <td className="py-2 text-right font-mono font-semibold text-stone-800 text-xs">
                    {progreso.reduce((s, p) => s + p.contado, 0).toLocaleString("es-CO")}
                  </td>
                  <td className="py-2 text-right font-mono font-semibold text-teal-700 text-xs">
                    {progreso.reduce((s, p) => s + p.empacado, 0).toLocaleString("es-CO")}
                  </td>
                  <td className="py-2 text-right font-mono font-semibold text-stone-800 text-xs">
                    {Math.max(0, progreso.reduce((s, p) => s + p.pendiente, 0)).toLocaleString("es-CO")}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Historial de registros ───────────────────────────────── */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-stone-700 border-b border-stone-100 pb-2">
          Historial de registros
        </h2>
        {registros.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-4">Sin registros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  {["Fecha", "Empacadora", "Color", "Talla", "Cantidad", "Precio/ud", "Valor", ""].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left text-xs text-stone-500 font-medium first:pl-0 last:pr-0"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => {
                  const empacadora = empacadoras.find((p) => p.id === r.persona_id)
                  return (
                    <tr key={r.id} className="border-b border-stone-100 last:border-0">
                      <td className="px-3 py-2 text-stone-600 text-xs first:pl-0">{r.fecha}</td>
                      <td className="px-3 py-2 text-stone-700">
                        {empacadora?.nombre ?? `#${r.persona_id}`}
                      </td>
                      <td className="px-3 py-2 text-stone-600">{r.color}</td>
                      <td className="px-3 py-2 font-medium text-stone-800">{r.talla}</td>
                      <td className="px-3 py-2 font-mono text-stone-700">
                        {r.cantidad.toLocaleString("es-CO")}
                      </td>
                      <td className="px-3 py-2 font-mono text-stone-600 text-xs">
                        {cop(Number(r.precio_unidad))}
                      </td>
                      <td className="px-3 py-2 font-mono text-stone-700 text-xs">
                        {cop(Number(r.valor_total))}
                      </td>
                      <td className="px-3 py-2 last:pr-0">
                        {loteActivo && (
                          <button
                            type="button"
                            onClick={() => handleDelete(r.id)}
                            disabled={isPendingDel}
                            className="p-1 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
