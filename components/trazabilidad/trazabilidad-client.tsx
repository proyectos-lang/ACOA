"use client"

import * as React from "react"
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
} from "lucide-react"
import type { OrdenTraza, LoteTraza } from "@/lib/db/trazabilidad"
import { ETAPAS } from "@/lib/db/trazabilidad"
import { LOTE_ESTADO_COLOR, LOTE_ESTADO_LABEL } from "@/lib/db/lote"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

type Promedio = { etapa: string; label: string; color: string; dias: number; muestras: number }

function padOP(n: number) {
  return `OP-${String(n).padStart(4, "0")}`
}

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

const filtroCls =
  "rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"

function barraAvance(pct: number) {
  if (pct >= 100) return "bg-emerald-500"
  if (pct >= 60) return "bg-teal-500"
  if (pct >= 30) return "bg-amber-500"
  return "bg-stone-400"
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

// ── Detalle de un lote con sus prendas ──
function LoteDetalle({ lote }: { lote: LoteTraza }) {
  const empacadoPct =
    lote.total_contado && lote.total_contado > 0
      ? Math.min(100, Math.round((lote.total_empacado / lote.total_contado) * 100))
      : 0

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-stone-800">{lote.nombre}</span>
          {lote.color && <span className="text-xs text-stone-500">{lote.color}</span>}
          <Badge className={`${LOTE_ESTADO_COLOR[lote.estado] ?? "bg-stone-100 text-stone-700"} border-0`}>
            {LOTE_ESTADO_LABEL[lote.estado] ?? lote.estado}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-stone-600">
          <span className="font-mono">{lote.cantidad_programada.toLocaleString("es-CO")} prog.</span>
          {lote.total_contado != null && (
            <span className="font-mono text-yellow-700">
              {lote.total_contado.toLocaleString("es-CO")} cont.
            </span>
          )}
          {lote.total_empacado > 0 && (
            <span className="font-mono text-green-700">
              {lote.total_empacado.toLocaleString("es-CO")} emp. ({empacadoPct}%)
            </span>
          )}
        </div>
      </div>

      {/* Fechas del lote por etapa */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-stone-500">
        {lote.est_entrega && (
          <span>
            Estampación: <strong className="font-mono">{lote.est_entrega}</strong>
            {lote.est_retorno && <span className="font-mono"> → {lote.est_retorno}</span>}
          </span>
        )}
        {lote.conf_entrega && (
          <span>
            Confección: <strong className="font-mono">{lote.conf_entrega}</strong>
            {lote.conf_retorno && <span className="font-mono"> → {lote.conf_retorno}</span>}
          </span>
        )}
        {lote.fecha_conteo && (
          <span>
            Conteo: <strong className="font-mono">{lote.fecha_conteo}</strong>
          </span>
        )}
      </div>

      {/* Prendas del lote (OPs tipo conjunto) */}
      {lote.prendas.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-stone-200">
          <p className="text-[11px] font-semibold text-stone-500">
            Piezas del lote ({lote.prendas.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {lote.prendas.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5"
              >
                <span className="text-xs font-medium text-stone-800">{p.nombre}</span>
                <Badge
                  className={`${PRENDA_COLOR[p.estado] ?? "bg-stone-100 text-stone-700"} border-0 text-[10px] px-1.5 py-0`}
                >
                  {p.estado}
                </Badge>
                {p.estampador && (
                  <span className="text-[10px] text-stone-500">Est: {p.estampador}</span>
                )}
                {p.confeccionista && (
                  <span className="text-[10px] text-stone-500">Conf: {p.confeccionista}</span>
                )}
                {p.contadas != null && (
                  <span className="text-[10px] font-mono text-stone-600">
                    {p.contadas.toLocaleString("es-CO")} ud
                  </span>
                )}
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
          {orden.tipo_prenda === "conjunto" ? (
            <Badge variant="outline" className="text-[10px] border-purple-200 text-purple-700">
              Conjunto
            </Badge>
          ) : (
            <span className="text-xs text-stone-400">Prenda</span>
          )}
        </td>
        <td className="px-3 py-3 text-center font-mono text-stone-600">{orden.total_lotes}</td>
        <td className="px-3 py-3 text-right font-mono text-stone-700">
          {orden.total_unidades.toLocaleString("es-CO")}
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
          <td colSpan={9} className="px-5 py-4">
            <div className="space-y-4">
              <LineaTiempo orden={orden} />

              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Lotes y piezas ({orden.lotes.length})
                </h3>
                {orden.lotes.length === 0 ? (
                  <p className="text-sm text-stone-400 py-2">
                    Esta orden aún no tiene lotes generados en corte.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {orden.lotes.map((l) => (
                      <LoteDetalle key={l.id} lote={l} />
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
      {/* ── Indicadores ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 flex items-center gap-4">
          <div className="rounded-xl bg-blue-50 p-3">
            <Layers className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-stone-500">Órdenes en curso</p>
            <p className="text-2xl font-bold text-stone-900">{abiertas.length}</p>
            <p className="text-[11px] text-stone-400">{cerradas.length} terminadas</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="rounded-xl bg-teal-50 p-3">
            <Package className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <p className="text-xs text-stone-500">Unidades programadas</p>
            <p className="text-2xl font-bold text-stone-900 font-mono">
              {unidades.toLocaleString("es-CO")}
            </p>
            <p className="text-[11px] text-stone-400">
              {filtradas.reduce((s, o) => s + o.total_lotes, 0)} lotes
            </p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="rounded-xl bg-emerald-50 p-3">
            <Timer className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-stone-500">Lead time promedio</p>
            <p className="text-2xl font-bold text-emerald-700 font-mono">{leadPromedio} d</p>
            <p className="text-[11px] text-stone-400">órdenes terminadas</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
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
        </Card>
      </div>

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
      <Card className="p-4 flex flex-wrap items-end gap-3">
        <div className="space-y-0.5">
          <label className="text-[11px] font-medium text-stone-500">OP / Referencia</label>
          <input
            type="text"
            value={fOP}
            onChange={(e) => setFOP(e.target.value)}
            className={`${filtroCls} w-44`}
            placeholder="OP-0001"
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-[11px] font-medium text-stone-500">Etapa</label>
          <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} className={filtroCls}>
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
          <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} className={filtroCls}>
            <option value="">Todos</option>
            <option value="prenda">Prenda</option>
            <option value="conjunto">Conjunto</option>
          </select>
        </div>
        {(fOP || fEstado || fTipo) && (
          <button
            type="button"
            onClick={() => {
              setFOP("")
              setFEstado("")
              setFTipo("")
            }}
            className="rounded-xl px-3 py-2 text-xs font-medium border border-stone-200 text-stone-500 hover:bg-stone-50"
          >
            Limpiar filtros
          </button>
        )}
        <span className="ml-auto text-xs text-stone-400">
          {filtradas.length} de {ordenes.length} órdenes
        </span>
      </Card>

      {/* ── Tabla de órdenes ─────────────────────────────────── */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
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
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-stone-400">
                    No hay órdenes con los filtros actuales.
                  </td>
                </tr>
              ) : (
                filtradas.map((o) => <FilaOrden key={o.id} orden={o} />)
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-stone-400">
        Haz clic en una orden para ver su línea de tiempo, sus lotes y el estado de cada pieza.
      </p>
    </div>
  )
}
