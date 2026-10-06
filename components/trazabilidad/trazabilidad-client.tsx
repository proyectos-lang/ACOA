"use client"

import * as React from "react"
import { TablaInteractiva } from "@/components/ui/tabla-interactiva"
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Package,
  Layers,
  TrendingUp,
  CheckCircle2,
  CircleDot,
  AlertTriangle,
  Timer,
  FileSpreadsheet,
  Scale,
} from "lucide-react"
import type { OrdenTraza, LoteTraza, RealEtapas, FilaControl } from "@/lib/db/trazabilidad"
import { ETAPAS, filasControl } from "@/lib/db/trazabilidad"
import { LOTE_ESTADO_COLOR, LOTE_ESTADO_LABEL } from "@/lib/db/lote"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type Promedio = { etapa: string; label: string; color: string; dias: number; muestras: number }

function padOP(n: number) {
  return `OP-${String(n).padStart(4, "0")}`
}
const fmt = (n: number) => n.toLocaleString("es-CO")

const ESTADO_OP_COLOR: Record<string, string> = {
  borrador: "bg-stone-100 text-stone-700",
  diseno: "bg-purple-100 text-purple-800",
  corte: "bg-amber-100 text-amber-800",
  estampacion: "bg-pink-100 text-pink-800",
  confeccion: "bg-teal-100 text-teal-800",
  conteo: "bg-yellow-100 text-yellow-800",
  empaque: "bg-green-100 text-green-800",
  terminada: "bg-emerald-100 text-emerald-800",
}

const PRENDA_COLOR: Record<string, string> = {
  estampacion: "bg-pink-100 text-pink-800",
  confeccion: "bg-teal-100 text-teal-800",
  conteo: "bg-yellow-100 text-yellow-800",
  completado: "bg-emerald-100 text-emerald-800",
}

const ETAPA_LABEL: Record<string, string> = {
  corte: "Corte",
  estampacion: "Estampación",
  confeccion: "Confección",
  conteo: "Conteo",
  empaque: "Empaque",
}

const filtroCls =
  "rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"

function barraAvance(pct: number) {
  if (pct >= 100) return "bg-emerald-500"
  if (pct >= 60) return "bg-teal-500"
  if (pct >= 30) return "bg-amber-500"
  return "bg-stone-400"
}

// ── Programado vs real ─────────────────────────────────────────────

// Una celda de etapa: el valor real y, debajo, su diferencia frente a lo
// programado. Rojo si falta, verde si sobra, gris si aun no hay dato.
function CeldaReal({
  valor,
  programado,
  imperfectos = 0,
}: {
  valor: number | null
  programado: number
  imperfectos?: number
}) {
  if (valor == null) {
    return <td className="px-2 py-1.5 text-right font-mono text-xs text-stone-300">—</td>
  }
  const d = valor - programado
  const cls = d === 0 ? "text-stone-700" : d < 0 ? "text-red-600" : "text-emerald-600"
  return (
    <td className="px-2 py-1.5 text-right font-mono text-xs leading-tight">
      <span className={`font-semibold ${cls}`}>{fmt(valor)}</span>
      {d !== 0 && (
        <span className={`block text-[10px] ${cls}`}>
          {d > 0 ? "+" : ""}
          {fmt(d)}
        </span>
      )}
      {imperfectos > 0 && <span className="block text-[10px] text-red-500">{fmt(imperfectos)} imp.</span>}
    </td>
  )
}

function CabeceraEtapas({ primera }: { primera: string }) {
  const th = "px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-stone-500"
  return (
    <thead>
      <tr className="bg-stone-50 border-b border-stone-200">
        <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-stone-500">
          {primera}
        </th>
        <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-stone-500">
          Estado
        </th>
        <th className={th}>Prog.</th>
        <th className={th}>Cortado</th>
        <th className={th}>Estamp.</th>
        <th className={th}>Confec.</th>
        <th className={th}>Contado</th>
        <th className={th}>Empacado</th>
      </tr>
    </thead>
  )
}

function CeldasEtapas({ real }: { real: RealEtapas }) {
  return (
    <>
      <td className="px-2 py-1.5 text-right font-mono text-xs text-stone-600">{fmt(real.programado)}</td>
      <CeldaReal valor={real.cortado} programado={real.programado} />
      <CeldaReal valor={real.est_recibido} programado={real.programado} />
      <CeldaReal valor={real.conf_recibido} programado={real.programado} />
      <CeldaReal valor={real.contado} programado={real.programado} imperfectos={real.imperfectos_conteo} />
      <CeldaReal valor={real.empacado} programado={real.programado} imperfectos={real.imperfectos_empaque} />
    </>
  )
}

// Tabla de un lote: una fila por pieza en los conjuntos, una sola en OPs
// de una prenda
function ProgramadoVsRealLote({ lote, esConjunto }: { lote: LoteTraza; esConjunto: boolean }) {
  const porPieza = esConjunto && lote.prendas.length > 0
  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
      <table className="w-full text-xs">
        <CabeceraEtapas primera={porPieza ? "Pieza" : "Lote"} />
        <tbody>
          {porPieza ? (
            lote.prendas.map((p) => (
              <tr key={p.id} className="border-b border-stone-100 last:border-0">
                <td className="px-2 py-1.5 font-semibold text-stone-800">{p.nombre}</td>
                <td className="px-2 py-1.5">
                  <Badge className={`${PRENDA_COLOR[p.estado] ?? "bg-stone-100 text-stone-700"} border-0 text-[10px] px-1.5 py-0`}>
                    {p.estado}
                  </Badge>
                </td>
                <CeldasEtapas real={p.real} />
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-2 py-1.5 font-semibold text-stone-800">{lote.nombre}</td>
              <td className="px-2 py-1.5">
                <Badge className={`${LOTE_ESTADO_COLOR[lote.estado] ?? "bg-stone-100 text-stone-700"} border-0 text-[10px] px-1.5 py-0`}>
                  {LOTE_ESTADO_LABEL[lote.estado] ?? lote.estado}
                </Badge>
              </td>
              <CeldasEtapas real={lote.real} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// Exportacion a Excel: tabla HTML con BOM, el mismo patron del resto del ERP
function exportarControl(filas: FilaControl[]) {
  const esc = (s: unknown) =>
    String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  const head = [
    "OP", "Referencia", "Tipo", "Lote", "Pieza", "Estado",
    "Programado", "Cortado", "Recibido estampación", "Recibido confección",
    "Contado", "Imperfectos conteo", "Empacado", "Imperfectos empaque",
    "Último real", "Etapa del último real", "Desviación",
  ]
  const rows = filas.map((f) => [
    padOP(f.numero_op), f.referencia, f.tipo_prenda, f.lote, f.pieza ?? "", f.estado,
    f.real.programado, f.real.cortado ?? "", f.real.est_recibido ?? "", f.real.conf_recibido ?? "",
    f.real.contado ?? "", f.real.imperfectos_conteo, f.real.empacado ?? "", f.real.imperfectos_empaque,
    f.ultimo?.valor ?? "", f.ultimo ? ETAPA_LABEL[f.ultimo.etapa] ?? f.ultimo.etapa : "", f.desviacion ?? "",
  ])
  const html =
    `<html><head><meta charset="utf-8"></head><body><table border="1">` +
    `<thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>` +
    `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>` +
    `</table></body></html>`
  const blob = new Blob(["﻿" + html], { type: "application/vnd.ms-excel" })
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `programado-vs-real-${hoy}.xls`
  a.click()
  URL.revokeObjectURL(a.href)
}

// Tabla de control: todas las filas (lote, o pieza en los conjuntos) de las
// ordenes filtradas, con lo programado y lo real de cada etapa lado a lado
function ControlSection({ filas }: { filas: FilaControl[] }) {
  const [soloDesviadas, setSoloDesviadas] = React.useState(false)
  const [etapa, setEtapa] = React.useState("")

  const visibles = filas.filter((f) => {
    if (soloDesviadas && !(f.desviacion != null && f.desviacion !== 0)) return false
    if (etapa && f.ultimo?.etapa !== etapa) return false
    return true
  })

  const programado = visibles.reduce((s, f) => s + f.real.programado, 0)
  const conDato = visibles.filter((f) => f.ultimo)
  const real = conDato.reduce((s, f) => s + (f.ultimo?.valor ?? 0), 0)
  const programadoConDato = conDato.reduce((s, f) => s + f.real.programado, 0)
  const faltantes = visibles.filter((f) => (f.desviacion ?? 0) < 0)
  const sobrantes = visibles.filter((f) => (f.desviacion ?? 0) > 0)
  const unidadesFaltan = faltantes.reduce((s, f) => s + Math.abs(f.desviacion ?? 0), 0)
  const cumplimiento = programadoConDato > 0 ? Math.round((real / programadoConDato) * 1000) / 10 : null

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-stone-500" />
          <h2 className="text-sm font-semibold text-stone-700">Programado vs real</h2>
          <span className="text-xs text-stone-400">
            {visibles.length} {visibles.length === 1 ? "fila" : "filas"} · cada fila es un lote, o
            una pieza en los conjuntos
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-stone-600 select-none">
            <input
              type="checkbox"
              checked={soloDesviadas}
              onChange={(e) => setSoloDesviadas(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-stone-300 accent-[#344966]"
            />
            Solo con desviación
          </label>
          <select value={etapa} onChange={(e) => setEtapa(e.target.value)} className={`${filtroCls} py-1.5 text-xs`}>
            <option value="">Último real en cualquier etapa</option>
            {Object.entries(ETAPA_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                Último real en {v}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => exportarControl(visibles)}
            disabled={visibles.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </button>
        </div>
      </div>

      {/* Resumen de lo visible */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-stone-100 border-b border-stone-100 text-center">
        <div className="px-3 py-3">
          <p className="text-[11px] text-stone-500">Programado</p>
          <p className="text-lg font-bold font-mono text-stone-800">{fmt(programado)}</p>
        </div>
        <div className="px-3 py-3">
          <p className="text-[11px] text-stone-500">Último real registrado</p>
          <p className="text-lg font-bold font-mono text-stone-800">{fmt(real)}</p>
          <p className="text-[10px] text-stone-400">{conDato.length} con dato</p>
        </div>
        <div className="px-3 py-3">
          <p className="text-[11px] text-stone-500">Cumplimiento</p>
          <p
            className={`text-lg font-bold font-mono ${
              cumplimiento == null ? "text-stone-400" : cumplimiento < 97 ? "text-red-600" : "text-emerald-700"
            }`}
          >
            {cumplimiento == null ? "—" : `${cumplimiento}%`}
          </p>
          <p className="text-[10px] text-stone-400">real / programado, filas con dato</p>
        </div>
        <div className="px-3 py-3">
          <p className="text-[11px] text-stone-500">Faltantes</p>
          <p className={`text-lg font-bold font-mono ${faltantes.length > 0 ? "text-red-600" : "text-stone-800"}`}>
            {faltantes.length}
          </p>
          <p className="text-[10px] text-stone-400">
            {unidadesFaltan > 0 ? `${fmt(unidadesFaltan)} uds por debajo` : "sin faltantes"}
            {sobrantes.length > 0 && ` · ${sobrantes.length} por encima`}
          </p>
        </div>
      </div>

      <TablaInteractiva>
      <div className="overflow-auto max-h-[480px]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-stone-50 border-b border-stone-200">
              {["OP", "Referencia", "Lote", "Pieza", "Estado"].map((h) => (
                <th key={h} className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap">
                  {h}
                </th>
              ))}
              {["Prog.", "Cortado", "Estamp.", "Confec.", "Contado", "Empacado", "Desv."].map((h) => (
                <th key={h} className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-sm text-stone-400">
                  No hay filas con los filtros actuales.
                </td>
              </tr>
            ) : (
              visibles.map((f) => {
                const d = f.desviacion
                const clsD = d == null ? "text-stone-300" : d === 0 ? "text-stone-400" : d < 0 ? "text-red-600" : "text-emerald-600"
                const colorEstado = f.pieza ? PRENDA_COLOR[f.estado] : LOTE_ESTADO_COLOR[f.estado]
                const labelEstado = f.pieza ? f.estado : (LOTE_ESTADO_LABEL[f.estado] ?? f.estado)
                return (
                  <tr key={`${f.lote_id}-${f.pieza ?? "l"}`} className={`border-b border-stone-100 last:border-0 ${d != null && d < 0 ? "bg-red-50/40" : ""}`}>
                    <td className="px-2 py-1.5 font-mono font-semibold text-stone-700 whitespace-nowrap">{padOP(f.numero_op)}</td>
                    <td className="px-2 py-1.5 text-stone-700 whitespace-nowrap">{f.referencia}</td>
                    <td className="px-2 py-1.5 text-stone-700 whitespace-nowrap">{f.lote}</td>
                    <td className="px-2 py-1.5 text-stone-600 whitespace-nowrap">{f.pieza ?? <span className="text-stone-300">—</span>}</td>
                    <td className="px-2 py-1.5">
                      <Badge className={`${colorEstado ?? "bg-stone-100 text-stone-700"} border-0 text-[10px] px-1.5 py-0 whitespace-nowrap`}>
                        {labelEstado}
                      </Badge>
                    </td>
                    <CeldasEtapas real={f.real} />
                    <td className={`px-2 py-1.5 text-right font-mono text-xs font-bold ${clsD}`}>
                      {d == null ? "—" : `${d > 0 ? "+" : ""}${fmt(d)}`}
                      {f.ultimo && (
                        <span className="block text-[9px] font-normal text-stone-400">
                          {ETAPA_LABEL[f.ultimo.etapa] ?? f.ultimo.etapa}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      </TablaInteractiva>
      <p className="px-5 py-2.5 text-[11px] text-stone-400 border-t border-stone-100">
        Debajo de cada valor real va su diferencia frente a lo programado en la OP. La desviación
        final compara el último dato real disponible (empacado, si no contado, y así hacia atrás).
      </p>
    </Card>
  )
}

// ── Línea de tiempo de una orden: una etapa por hito, con sus fechas ──
function LineaTiempo({ orden }: { orden: OrdenTraza }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-4">
        Línea de tiempo por etapa
      </h3>
      <div className="relative">
        {/* Riel */}
        <div className="absolute left-0 right-0 top-3 h-0.5 bg-stone-200" />
        <div className="relative grid grid-cols-6 gap-2">
          {orden.hitos.map((h) => {
            const enCurso = !h.completada && !!h.inicio
            return (
              <div key={h.etapa} className="flex flex-col items-center text-center">
                <div
                  className="h-6 w-6 rounded-full border-2 bg-white flex items-center justify-center z-10"
                  style={{ borderColor: h.completada || enCurso ? h.color : "#d6d3d1" }}
                >
                  {h.completada ? (
                    <CheckCircle2 className="h-3.5 w-3.5" style={{ color: h.color }} />
                  ) : enCurso ? (
                    <CircleDot className="h-3.5 w-3.5" style={{ color: h.color }} />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-stone-200" />
                  )}
                </div>
                <p
                  className="mt-2 text-[11px] font-semibold"
                  style={{ color: h.completada || enCurso ? h.color : "#a8a29e" }}
                >
                  {h.label}
                </p>
                <p className="text-[10px] text-stone-500 font-mono leading-tight mt-0.5">
                  {h.inicio ?? "—"}
                </p>
                {h.fin && h.fin !== h.inicio && (
                  <p className="text-[10px] text-stone-400 font-mono leading-tight">→ {h.fin}</p>
                )}
                {h.dias != null && (h.completada || enCurso) && (
                  <Badge
                    variant="secondary"
                    className="mt-1 text-[10px] px-1.5 py-0 font-mono bg-stone-100 text-stone-600"
                  >
                    {h.dias} d
                  </Badge>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Detalle de un lote: programado vs real y sus piezas ──
function LoteDetalle({ lote, esConjunto }: { lote: LoteTraza; esConjunto: boolean }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-stone-800">{lote.nombre}</span>
          {lote.color && <span className="text-xs text-stone-500">{lote.color}</span>}
          <Badge className={`${LOTE_ESTADO_COLOR[lote.estado] ?? "bg-stone-100 text-stone-700"} border-0`}>
            {LOTE_ESTADO_LABEL[lote.estado] ?? lote.estado}
          </Badge>
          {lote.dias_total != null && (
            <Badge variant="outline" className="border-stone-300 text-stone-600 text-[10px] gap-1">
              <Timer className="h-3 w-3" /> {lote.dias_total} d en proceso
            </Badge>
          )}
        </div>
        <span className="text-xs text-stone-500 font-mono">
          {fmt(lote.real.programado)} programadas
        </span>
      </div>

      <ProgramadoVsRealLote lote={lote} esConjunto={esConjunto} />

      {/* Fechas del lote por etapa */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-stone-500">
        {lote.est_entrega && (
          <span>
            Estampación: <strong className="font-mono">{lote.est_entrega}</strong>
            {lote.est_retorno && <span className="font-mono"> → {lote.est_retorno}</span>}
            {lote.est_dias != null && (
              <strong className="text-pink-700"> ({lote.est_dias} d)</strong>
            )}
          </span>
        )}
        {lote.conf_entrega && (
          <span>
            Confección: <strong className="font-mono">{lote.conf_entrega}</strong>
            {lote.conf_retorno && <span className="font-mono"> → {lote.conf_retorno}</span>}
            {lote.conf_dias != null && (
              <strong className="text-teal-700"> ({lote.conf_dias} d)</strong>
            )}
          </span>
        )}
        {lote.fecha_conteo && (
          <span>
            Conteo: <strong className="font-mono">{lote.fecha_conteo}</strong>
          </span>
        )}
      </div>

      {/* Responsables y tiempos de cada pieza (OPs tipo conjunto) */}
      {lote.prendas.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-stone-200">
          <p className="text-[11px] font-semibold text-stone-500">
            Responsables y tiempos por pieza
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {lote.prendas.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-stone-200 bg-white px-2.5 py-2 space-y-1"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-stone-800">{p.nombre}</span>
                  <Badge
                    className={`${PRENDA_COLOR[p.estado] ?? "bg-stone-100 text-stone-700"} border-0 text-[10px] px-1.5 py-0`}
                  >
                    {p.estado}
                  </Badge>
                  {p.dias_total != null && (
                    <Badge
                      variant="outline"
                      className="border-stone-300 text-stone-600 text-[10px] px-1.5 py-0 gap-1"
                    >
                      <Timer className="h-2.5 w-2.5" /> {p.dias_total} d
                    </Badge>
                  )}
                  {/* Avance individual de la pieza */}
                  <div className="ml-auto flex items-center gap-1.5">
                    <div className="w-16 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barraAvance(p.avance)}`}
                        style={{ width: `${p.avance}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-stone-500 tabular-nums">
                      {p.avance}%
                    </span>
                  </div>
                </div>

                {/* Tiempos de cada pieza por etapa */}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-stone-500">
                  {p.estampador && (
                    <span>
                      Est: <strong className="text-stone-700">{p.estampador}</strong>
                      {p.est_entrega && (
                        <span className="font-mono">
                          {" "}
                          {p.est_entrega}
                          {p.est_retorno ? ` → ${p.est_retorno}` : ""}
                        </span>
                      )}
                      {p.est_dias != null && (
                        <strong className="text-pink-700"> ({p.est_dias} d)</strong>
                      )}
                    </span>
                  )}
                  {p.confeccionista && (
                    <span>
                      Conf: <strong className="text-stone-700">{p.confeccionista}</strong>
                      {p.conf_entrega && (
                        <span className="font-mono">
                          {" "}
                          {p.conf_entrega}
                          {p.conf_retorno ? ` → ${p.conf_retorno}` : ""}
                        </span>
                      )}
                      {p.conf_dias != null && (
                        <strong className="text-teal-700"> ({p.conf_dias} d)</strong>
                      )}
                    </span>
                  )}
                  {!p.estampador && !p.confeccionista && (
                    <span className="text-stone-400">Sin asignaciones registradas</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Fila de orden, expandible al detalle completo ──
function FilaOrden({ orden }: { orden: OrdenTraza }) {
  const [abierta, setAbierta] = React.useState(false)
  const esConjunto = orden.tipo_prenda === "conjunto"

  // Desviacion de la orden: filas (lote o pieza) por debajo de lo programado
  const filas = React.useMemo(() => filasControl([orden]), [orden])
  const porDebajo = filas.filter((f) => (f.desviacion ?? 0) < 0).length

  return (
    <>
      <tr
        className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer transition-colors"
        onClick={() => setAbierta((a) => !a)}
      >
        <td className="px-3 py-3 text-stone-400">
          {abierta ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </td>
        <td className="px-3 py-3 font-mono font-semibold text-stone-700">{padOP(orden.numero_op)}</td>
        <td className="px-3 py-3">
          <p className="font-medium text-stone-800">{orden.referencia}</p>
          {orden.descripcion && (
            <p className="text-xs text-stone-400 truncate max-w-48">{orden.descripcion}</p>
          )}
        </td>
        <td className="px-3 py-3">
          <Badge className={`${ESTADO_OP_COLOR[orden.estado] ?? "bg-stone-100 text-stone-700"} border-0 capitalize`}>
            {orden.estado}
          </Badge>
        </td>
        <td className="px-3 py-3">
          {esConjunto ? (
            <Badge variant="outline" className="text-[10px] border-purple-200 text-purple-700">
              Conjunto
            </Badge>
          ) : (
            <span className="text-xs text-stone-400">Prenda</span>
          )}
        </td>
        <td className="px-3 py-3 text-center font-mono text-stone-600">{orden.total_lotes}</td>
        <td className="px-3 py-3 text-right font-mono text-stone-700">
          {fmt(orden.total_unidades)}
        </td>
        <td className="px-3 py-3 text-center">
          {porDebajo > 0 ? (
            <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">
              {porDebajo} por debajo
            </Badge>
          ) : (
            <span className="text-xs text-stone-300">—</span>
          )}
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 rounded-full bg-stone-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barraAvance(orden.avance)}`}
                style={{ width: `${orden.avance}%` }}
              />
            </div>
            <span className="text-xs font-mono text-stone-600 tabular-nums w-9">{orden.avance}%</span>
          </div>
        </td>
        <td className="px-3 py-3 text-right">
          <span
            className={`font-mono font-semibold text-sm ${
              orden.cerrada
                ? "text-emerald-700"
                : (orden.lead_time_dias ?? 0) > 30
                  ? "text-red-600"
                  : "text-stone-700"
            }`}
          >
            {orden.lead_time_dias ?? "—"} d
          </span>
        </td>
      </tr>

      {abierta && (
        <tr className="border-b border-stone-100 bg-stone-50/40">
          <td colSpan={10} className="px-5 py-4">
            <div className="space-y-4">
              <LineaTiempo orden={orden} />

              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Lotes y piezas ({orden.lotes.length}) — programado vs real por etapa
                </h3>
                {orden.lotes.length === 0 ? (
                  <p className="text-sm text-stone-400 py-2">
                    Esta orden aún no tiene lotes generados en corte.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {orden.lotes.map((l) => (
                      <LoteDetalle key={l.id} lote={l} esConjunto={esConjunto} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export function TrazabilidadClient({
  ordenes,
  promedios,
}: {
  ordenes: OrdenTraza[]
  promedios: Promedio[]
}) {
  const [fOP, setFOP] = React.useState("")
  const [fEstado, setFEstado] = React.useState("")
  const [fTipo, setFTipo] = React.useState("")

  const filtradas = ordenes.filter((o) => {
    if (fOP) {
      const q = fOP.toLowerCase()
      if (
        !padOP(o.numero_op).toLowerCase().includes(q) &&
        !o.referencia.toLowerCase().includes(q)
      )
        return false
    }
    if (fEstado && o.estado !== fEstado) return false
    if (fTipo && o.tipo_prenda !== fTipo) return false
    return true
  })

  // Filas de control (lote o pieza) de las ordenes filtradas
  const filasCtrl = React.useMemo(() => filasControl(filtradas), [filtradas])

  // ── Indicadores generales ──
  const abiertas = filtradas.filter((o) => !o.cerrada)
  const cerradas = filtradas.filter((o) => o.cerrada)
  const unidades = filtradas.reduce((s, o) => s + o.total_unidades, 0)
  const leadPromedio =
    cerradas.length > 0
      ? Math.round(
          (cerradas.reduce((s, o) => s + (o.lead_time_dias ?? 0), 0) / cerradas.length) * 10
        ) / 10
      : 0
  const leadAbiertas =
    abiertas.length > 0
      ? Math.round(
          (abiertas.reduce((s, o) => s + (o.lead_time_dias ?? 0), 0) / abiertas.length) * 10
        ) / 10
      : 0
  const demoradas = abiertas.filter((o) => (o.lead_time_dias ?? 0) > 30)

  // Distribución por etapa (para las barras de estado)
  const porEstado = ETAPAS.map((e) => ({
    ...e,
    total: filtradas.filter((o) => o.estado === e.key).length,
  }))
  const maxEstado = Math.max(1, ...porEstado.map((p) => p.total))
  const maxDias = Math.max(1, ...promedios.map((p) => p.dias))

  const estadosUnicos = [...new Set(ordenes.map((o) => o.estado))].sort()

  return (
    <div className="space-y-5">
      {/* ── Indicadores: un solo contenedor con divisiones ───── */}
      <Card className="p-0 overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-stone-200">
        <div className="p-5 flex items-center gap-4">
          <div className="rounded-xl bg-blue-50 p-3">
            <Layers className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-stone-500">Órdenes en curso</p>
            <p className="text-2xl font-bold text-stone-900">{abiertas.length}</p>
            <p className="text-[11px] text-stone-400">{cerradas.length} terminadas</p>
          </div>
        </div>
        <div className="p-5 flex items-center gap-4">
          <div className="rounded-xl bg-teal-50 p-3">
            <Package className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <p className="text-xs text-stone-500">Unidades programadas</p>
            <p className="text-2xl font-bold text-stone-900 font-mono">
              {fmt(unidades)}
            </p>
            <p className="text-[11px] text-stone-400">
              {filtradas.reduce((s, o) => s + o.total_lotes, 0)} lotes
            </p>
          </div>
        </div>
        <div className="p-5 flex items-center gap-4">
          <div className="rounded-xl bg-emerald-50 p-3">
            <Timer className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-stone-500">Lead time promedio</p>
            <p className="text-2xl font-bold text-emerald-700 font-mono">{leadPromedio} d</p>
            <p className="text-[11px] text-stone-400">órdenes terminadas</p>
          </div>
        </div>
        <div className="p-5 flex items-center gap-4">
          <div className={`rounded-xl p-3 ${demoradas.length > 0 ? "bg-red-50" : "bg-stone-100"}`}>
            <Clock className={`h-6 w-6 ${demoradas.length > 0 ? "text-red-600" : "text-stone-500"}`} />
          </div>
          <div>
            <p className="text-xs text-stone-500">Antigüedad en curso</p>
            <p
              className={`text-2xl font-bold font-mono ${
                demoradas.length > 0 ? "text-red-700" : "text-stone-900"
              }`}
            >
              {leadAbiertas} d
            </p>
            <p className="text-[11px] text-stone-400">
              {demoradas.length > 0 ? `${demoradas.length} con más de 30 días` : "dentro del rango"}
            </p>
          </div>
        </div>
        </div>
      </Card>

      {/* ── Gráficos: lead time por etapa y distribución ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-stone-500" />
            <h2 className="text-sm font-semibold text-stone-700">
              Tiempo promedio por etapa (días)
            </h2>
          </div>
          <div className="space-y-3">
            {promedios.map((p) => (
              <div key={p.etapa} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-stone-700">{p.label}</span>
                  <span className="font-mono text-stone-600">
                    {p.dias} d
                    <span className="text-stone-400 ml-1.5">
                      ({p.muestras} {p.muestras === 1 ? "orden" : "órdenes"})
                    </span>
                  </span>
                </div>
                <div className="h-3 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(2, (p.dias / maxDias) * 100)}%`,
                      backgroundColor: p.color,
                    }}
                  />
                </div>
              </div>
            ))}
            {promedios.every((p) => p.muestras === 0) && (
              <p className="text-xs text-stone-400 text-center py-4">
                Aún no hay etapas completadas con fechas registradas para calcular promedios.
              </p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <CircleDot className="h-4 w-4 text-stone-500" />
            <h2 className="text-sm font-semibold text-stone-700">Órdenes por etapa actual</h2>
          </div>
          <div className="space-y-3">
            {porEstado.map((p) => (
              <div key={p.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-stone-700">{p.label}</span>
                  <span className="font-mono text-stone-600">{p.total}</span>
                </div>
                <div className="h-3 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(p.total / maxEstado) * 100}%`,
                      backgroundColor: p.color,
                    }}
                  />
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between text-xs pt-2 border-t border-stone-100">
              <span className="font-medium text-emerald-700">Terminadas</span>
              <span className="font-mono text-emerald-700">{cerradas.length}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Alerta de órdenes demoradas ──────────────────────── */}
      {demoradas.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            <strong>{demoradas.length}</strong>{" "}
            {demoradas.length === 1 ? "orden lleva" : "órdenes llevan"} más de 30 días en curso:{" "}
            {demoradas
              .slice(0, 6)
              .map((o) => `${padOP(o.numero_op)} (${o.lead_time_dias} d)`)
              .join(", ")}
            {demoradas.length > 6 && ` y ${demoradas.length - 6} más`}.
          </span>
        </div>
      )}

      {/* ── Filtros ──────────────────────────────────────────── */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <div className="space-y-0.5">
          <label className="text-[11px] font-medium text-stone-500">OP / Referencia</label>
          <input
            type="text"
            value={fOP}
            onChange={(e) => setFOP(e.target.value)}
            className={`${filtroCls} w-full`}
            placeholder="OP-0001"
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-[11px] font-medium text-stone-500">Etapa</label>
          <select
            value={fEstado}
            onChange={(e) => setFEstado(e.target.value)}
            className={`${filtroCls} w-full`}
          >
            <option value="">Todas</option>
            {estadosUnicos.map((e) => (
              <option key={e} value={e} className="capitalize">
                {e}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-0.5">
          <label className="text-[11px] font-medium text-stone-500">Tipo</label>
          <select
            value={fTipo}
            onChange={(e) => setFTipo(e.target.value)}
            className={`${filtroCls} w-full`}
          >
            <option value="">Todos</option>
            <option value="prenda">Prenda</option>
            <option value="conjunto">Conjunto</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          {(fOP || fEstado || fTipo) && (
            <button
              type="button"
              onClick={() => {
                setFOP("")
                setFEstado("")
                setFTipo("")
              }}
              className="rounded-xl px-3 py-2 text-xs font-medium border border-stone-200 text-stone-500 hover:bg-stone-50 whitespace-nowrap"
            >
              Limpiar filtros
            </button>
          )}
          <span className="text-xs text-stone-400 whitespace-nowrap">
            {filtradas.length} de {ordenes.length} órdenes
          </span>
        </div>
        </div>
      </Card>

      {/* ── Programado vs real: la tabla de control ──────────── */}
      <ControlSection filas={filasCtrl} />

      {/* ── Tabla de órdenes ─────────────────────────────────── */}
      <Card className="overflow-hidden p-0">
        <TablaInteractiva>
        <div className="overflow-auto max-h-[600px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-stone-50 border-b border-stone-100">
                <th className="w-8" />
                <th className="px-3 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wide">
                  OP
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wide">
                  Referencia
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wide">
                  Etapa
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wide">
                  Tipo
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wide">
                  Lotes
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wide">
                  Unidades
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wide">
                  Real vs prog.
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wide">
                  Avance
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wide">
                  Lead time
                </th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-sm text-stone-400">
                    No hay órdenes con los filtros actuales.
                  </td>
                </tr>
              ) : (
                filtradas.map((o) => <FilaOrden key={o.id} orden={o} />)
              )}
            </tbody>
          </table>
        </div>
        </TablaInteractiva>
      </Card>

      <p className="text-xs text-stone-400">
        Haz clic en una orden para ver su línea de tiempo y, lote por lote y pieza por pieza, lo
        programado frente a lo real de cada etapa.
      </p>
    </div>
  )
}
