"use client"

import * as React from "react"
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  AlertTriangle,
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  Trash2,
  RefreshCw,
  FileSpreadsheet,
  Layers,
} from "lucide-react"
import type { SaldoInventario, InventransRow } from "@/lib/db/inventario-producto"
import { MOTIVOS_SALIDA } from "@/lib/db/inventario-producto"
import {
  registrarMovimientoAction,
  eliminarMovimientoAction,
  sincronizarInventarioAction,
} from "@/app/(dashboard)/inventario/actions"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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

function padOP(n: number | null) {
  return n ? `OP-${String(n).padStart(4, "0")}` : "—"
}
function hoyBogota() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
}

const filtroCls =
  "rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"

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

export function InventarioClient({
  saldos,
  movimientos,
}: {
  saldos: SaldoInventario[]
  movimientos: InventransRow[]
}) {
  const router = useRouter()
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [vista, setVista] = React.useState<"saldos" | "movimientos">("saldos")

  const [fRef, setFRef] = React.useState("")
  const [fLote, setFLote] = React.useState("")
  const [fTalla, setFTalla] = React.useState("")
  const [soloDisponible, setSoloDisponible] = React.useState(true)

  // Formulario de salida
  const [salidaLote, setSalidaLote] = React.useState<SaldoInventario | null>(null)
  const [salidaCantidad, setSalidaCantidad] = React.useState("")
  const [salidaMotivo, setSalidaMotivo] = React.useState<string>(MOTIVOS_SALIDA[0])
  const [salidaFecha, setSalidaFecha] = React.useState(hoyBogota())
  const [salidaObs, setSalidaObs] = React.useState("")

  function showToast(tipo: "ok" | "error", msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const filtrados = saldos.filter((s) => {
    if (soloDisponible && s.disponible <= 0) return false
    if (fRef) {
      const q = fRef.toLowerCase()
      if (
        !(s.referencia ?? "").toLowerCase().includes(q) &&
        !padOP(s.numero_op).toLowerCase().includes(q)
      )
        return false
    }
    if (fLote && !(s.lote_nombre ?? "").toLowerCase().includes(fLote.toLowerCase())) return false
    if (fTalla && !s.talla.toLowerCase().includes(fTalla.toLowerCase())) return false
    return true
  })

  const totalDisponible = filtrados.reduce((s, r) => s + r.disponible, 0)
  const totalEntradas = filtrados.reduce((s, r) => s + r.total_entradas, 0)
  const totalSalidas = filtrados.reduce((s, r) => s + r.total_salidas, 0)
  const referenciasUnicas = new Set(filtrados.map((s) => s.referencia ?? "")).size

  function registrarSalida() {
    if (!salidaLote) return
    const cant = parseInt(salidaCantidad, 10)
    if (!(cant > 0)) return showToast("error", "Ingresa la cantidad a dar de baja")
    if (cant > salidaLote.disponible) {
      return showToast(
        "error",
        `Solo hay ${salidaLote.disponible} unidades disponibles de esa talla`
      )
    }

    startTransition(async () => {
      const res = await registrarMovimientoAction({
        tipo: "salida",
        motivo: salidaMotivo,
        lote_id: salidaLote.lote_id,
        prenda_nombre: salidaLote.prenda_nombre ?? undefined,
        talla: salidaLote.talla,
        cantidad: cant,
        fecha: salidaFecha || hoyBogota(),
        observacion: salidaObs.trim() || undefined,
      })
      if (res.error) showToast("error", res.error)
      else {
        showToast("ok", `Salida de ${cant} ud. registrada`)
        setSalidaLote(null)
        setSalidaCantidad("")
        setSalidaObs("")
        router.refresh()
      }
    })
  }

  function quitarMovimiento(id: number) {
    startTransition(async () => {
      const res = await eliminarMovimientoAction(id)
      if (res.error) showToast("error", res.error)
      else {
        showToast("ok", "Movimiento eliminado")
        router.refresh()
      }
    })
  }

  function sincronizar() {
    startTransition(async () => {
      const res = await sincronizarInventarioAction()
      if (res.error) showToast("error", res.error)
      else {
        showToast(
          "ok",
          res.count
            ? `${res.count} entrada${res.count !== 1 ? "s" : ""} de empaque cargada${res.count !== 1 ? "s" : ""} al inventario`
            : "El inventario ya estaba al día"
        )
        router.refresh()
      }
    })
  }

  function exportarExcel() {
    const esc = (t: unknown) =>
      String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    const filas = filtrados
      .map(
        (s) =>
          `<tr><td>${padOP(s.numero_op)}</td><td>${esc(s.referencia)}</td><td>${esc(
            s.lote_nombre
          )}</td><td>${esc(s.prenda_nombre)}</td><td>${esc(s.talla)}</td><td>${
            s.total_entradas
          }</td><td>${s.total_salidas}</td><td>${s.disponible}</td><td>${esc(
            s.ultimo_movimiento
          )}</td></tr>`
      )
      .join("")
    const tabla = `<html><head><meta charset="utf-8"></head><body><table border="1"><tr><th>OP</th><th>Referencia</th><th>Lote</th><th>Prenda</th><th>Talla</th><th>Entradas</th><th>Salidas</th><th>Disponible</th><th>Último mov.</th></tr>${filas}</table></body></html>`
    const blob = new Blob(["﻿" + tabla], { type: "application/vnd.ms-excel" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `inventario-${hoyBogota()}.xls`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const cardCls = "p-5 flex items-center gap-4"

  return (
    <div className="space-y-4">
      {toast && <Toast tipo={toast.tipo} msg={toast.msg} />}

      {/* ── Totales ─────────────────────────────────────────── */}
      <Card className="p-0 overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-stone-200">
          <div className={cardCls}>
            <div className="rounded-xl bg-teal-50 p-3">
              <Boxes className="h-6 w-6 text-teal-600" />
            </div>
            <div>
              <p className="text-xs text-stone-500">Disponible</p>
              <p className="text-2xl font-bold text-teal-700 font-mono">
                {totalDisponible.toLocaleString("es-CO")}
              </p>
              <p className="text-[11px] text-stone-400">{filtrados.length} combinaciones</p>
            </div>
          </div>
          <div className={cardCls}>
            <div className="rounded-xl bg-emerald-50 p-3">
              <ArrowDownToLine className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-stone-500">Entradas</p>
              <p className="text-2xl font-bold text-emerald-700 font-mono">
                {totalEntradas.toLocaleString("es-CO")}
              </p>
              <p className="text-[11px] text-stone-400">desde empaque</p>
            </div>
          </div>
          <div className={cardCls}>
            <div className="rounded-xl bg-amber-50 p-3">
              <ArrowUpFromLine className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-stone-500">Salidas</p>
              <p className="text-2xl font-bold text-amber-700 font-mono">
                {totalSalidas.toLocaleString("es-CO")}
              </p>
            </div>
          </div>
          <div className={cardCls}>
            <div className="rounded-xl bg-blue-50 p-3">
              <Layers className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-stone-500">Referencias</p>
              <p className="text-2xl font-bold text-stone-900">{referenciasUnicas}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Filtros ─────────────────────────────────────────── */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div className="space-y-0.5">
            <label className="text-[11px] font-medium text-stone-500">OP / Referencia</label>
            <input
              type="text"
              value={fRef}
              onChange={(e) => setFRef(e.target.value)}
              className={`${filtroCls} w-full`}
              placeholder="OP-0001"
            />
          </div>
          <div className="space-y-0.5">
            <label className="text-[11px] font-medium text-stone-500">Lote</label>
            <input
              type="text"
              value={fLote}
              onChange={(e) => setFLote(e.target.value)}
              className={`${filtroCls} w-full`}
              placeholder="Lote 1"
            />
          </div>
          <div className="space-y-0.5">
            <label className="text-[11px] font-medium text-stone-500">Talla</label>
            <input
              type="text"
              value={fTalla}
              onChange={(e) => setFTalla(e.target.value)}
              className={`${filtroCls} w-full`}
              placeholder="M"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-stone-600 pb-2">
            <input
              type="checkbox"
              checked={soloDisponible}
              onChange={(e) => setSoloDisponible(e.target.checked)}
              className="rounded border-stone-300"
            />
            Solo con existencias
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={sincronizar}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              title="Carga al inventario los empaques que aún no tienen entrada"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Sincronizar
            </button>
            <button
              type="button"
              onClick={exportarExcel}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white"
              style={{ backgroundColor: "#0f766e" }}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </button>
          </div>
        </div>

        {/* Selector de vista */}
        <div className="mt-3 flex rounded-xl border border-stone-200 overflow-hidden w-fit">
          <button
            type="button"
            onClick={() => setVista("saldos")}
            className={`px-4 py-2 text-xs font-semibold ${
              vista === "saldos" ? "bg-[#344966] text-white" : "bg-white text-stone-600"
            }`}
          >
            Inventario
          </button>
          <button
            type="button"
            onClick={() => setVista("movimientos")}
            className={`px-4 py-2 text-xs font-semibold ${
              vista === "movimientos" ? "bg-[#344966] text-white" : "bg-white text-stone-600"
            }`}
          >
            Movimientos ({movimientos.length})
          </button>
        </div>
      </Card>

      {/* ── Vista de saldos ─────────────────────────────────── */}
      {vista === "saldos" && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-stone-50 border-b border-stone-100">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-stone-500 uppercase">OP</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-stone-500 uppercase">Referencia</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-stone-500 uppercase">Lote</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-stone-500 uppercase">Prenda</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-stone-500 uppercase">Talla</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-stone-500 uppercase">Entradas</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-stone-500 uppercase">Salidas</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-stone-500 uppercase">Disponible</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-stone-500 uppercase">Últ. mov.</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-sm text-stone-400">
                      No hay inventario con los filtros actuales. Si ya registraste empaque, usa
                      &quot;Sincronizar&quot; para cargarlo.
                    </td>
                  </tr>
                ) : (
                  filtrados.map((s) => (
                    <tr
                      key={`${s.lote_id}_${s.prenda_nombre ?? ""}_${s.talla}`}
                      className="border-b border-stone-100 last:border-0 hover:bg-stone-50"
                    >
                      <td className="px-3 py-2 font-mono text-xs text-stone-600">
                        {padOP(s.numero_op)}
                      </td>
                      <td className="px-3 py-2 text-stone-800">{s.referencia ?? "—"}</td>
                      <td className="px-3 py-2 text-stone-700">{s.lote_nombre ?? "—"}</td>
                      <td className="px-3 py-2 text-stone-600">
                        {s.prenda_nombre ? (
                          <Badge variant="outline" className="text-[10px] border-purple-200 text-purple-700">
                            {s.prenda_nombre}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 font-semibold text-stone-800">{s.talla}</td>
                      <td className="px-3 py-2 text-right font-mono text-emerald-700">
                        {s.total_entradas.toLocaleString("es-CO")}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-amber-700">
                        {s.total_salidas.toLocaleString("es-CO")}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className={`font-mono font-bold ${
                            s.disponible > 0 ? "text-teal-700" : "text-stone-400"
                          }`}
                        >
                          {s.disponible.toLocaleString("es-CO")}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-stone-500">
                        {s.ultimo_movimiento ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        {s.disponible > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSalidaLote(s)
                              setSalidaCantidad("")
                            }}
                            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-white"
                            style={{ backgroundColor: "#b45309" }}
                          >
                            <ArrowUpFromLine className="h-3 w-3" /> Salida
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Vista de movimientos (kardex) ───────────────────── */}
      {vista === "movimientos" && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-stone-50 border-b border-stone-100">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-stone-500 uppercase">Fecha</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-stone-500 uppercase">Tipo</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-stone-500 uppercase">Motivo</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-stone-500 uppercase">OP / Lote</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-stone-500 uppercase">Talla</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-stone-500 uppercase">Cantidad</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-stone-500 uppercase">Observación</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {movimientos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-stone-400">
                      Aún no hay movimientos de inventario.
                    </td>
                  </tr>
                ) : (
                  movimientos.map((m) => (
                    <tr key={m.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                      <td className="px-3 py-2 font-mono text-xs text-stone-600">{m.fecha}</td>
                      <td className="px-3 py-2">
                        <Badge
                          className={`border-0 text-[10px] ${
                            m.tipo === "entrada"
                              ? "bg-emerald-100 text-emerald-800"
                              : m.tipo === "salida"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-stone-100 text-stone-700"
                          }`}
                        >
                          {m.tipo}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-xs text-stone-600">{m.motivo}</td>
                      <td className="px-3 py-2 text-xs text-stone-700">
                        <span className="font-mono">{padOP(m.numero_op)}</span>
                        {m.lote_nombre && <span> · {m.lote_nombre}</span>}
                        {m.prenda_nombre && (
                          <span className="text-stone-400"> · {m.prenda_nombre}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-semibold text-stone-800">{m.talla}</td>
                      <td
                        className={`px-3 py-2 text-right font-mono font-semibold ${
                          m.tipo === "entrada" ? "text-emerald-700" : "text-amber-700"
                        }`}
                      >
                        {m.tipo === "salida" ? "−" : "+"}
                        {m.cantidad.toLocaleString("es-CO")}
                      </td>
                      <td className="px-3 py-2 text-xs text-stone-500">{m.observacion ?? ""}</td>
                      <td className="px-3 py-2">
                        {/* Las entradas de empaque se revierten borrando el registro de empaque */}
                        {!m.empaque_registro_id && (
                          <button
                            type="button"
                            onClick={() => quitarMovimiento(m.id)}
                            disabled={isPending}
                            className="p-1 rounded hover:bg-red-50 text-stone-400 hover:text-red-500"
                            title="Eliminar movimiento"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Diálogo de salida ───────────────────────────────── */}
      <AlertDialog open={salidaLote != null} onOpenChange={(o) => !o && setSalidaLote(null)}>
        <AlertDialogContent className="max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Registrar salida de inventario</AlertDialogTitle>
            <AlertDialogDescription>
              {salidaLote && (
                <>
                  {padOP(salidaLote.numero_op)} · {salidaLote.referencia} ·{" "}
                  {salidaLote.lote_nombre} · Talla{" "}
                  <strong className="text-stone-800">{salidaLote.talla}</strong>. Disponible:{" "}
                  <strong className="text-teal-700">{salidaLote.disponible}</strong> unidades.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-600">Cantidad</label>
                <input
                  type="number"
                  min="1"
                  max={salidaLote?.disponible ?? undefined}
                  value={salidaCantidad}
                  onChange={(e) => setSalidaCantidad(e.target.value)}
                  className={`${filtroCls} w-full`}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-600">Fecha</label>
                <input
                  type="date"
                  value={salidaFecha}
                  onChange={(e) => setSalidaFecha(e.target.value)}
                  className={`${filtroCls} w-full`}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-600">Motivo</label>
              <select
                value={salidaMotivo}
                onChange={(e) => setSalidaMotivo(e.target.value)}
                className={`${filtroCls} w-full`}
              >
                {MOTIVOS_SALIDA.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-600">Observación</label>
              <input
                type="text"
                value={salidaObs}
                onChange={(e) => setSalidaObs(e.target.value)}
                className={`${filtroCls} w-full`}
                placeholder="Cliente, remisión, detalle…"
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={registrarSalida}
              disabled={isPending}
              className="rounded-xl"
              style={{ backgroundColor: "#b45309" }}
            >
              Registrar salida
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
