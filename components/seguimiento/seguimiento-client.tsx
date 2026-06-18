"use client"

import React, { useState, useMemo } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Package,
  TrendingUp,
} from "lucide-react"
import type { VSeguimientoLote, VPipelineProduccion } from "@/lib/db/seguimiento"
import type { DetalleOPData } from "@/app/(dashboard)/seguimiento/actions"
import { getDetalleOPAction } from "@/app/(dashboard)/seguimiento/actions"
import { VALORES_FIJOS } from "@/lib/db/hoja-costos"

// ── Constants ──────────────────────────────────────────────────────────────────

const STAGES_ORDERED = [
  "programada",
  "diseno",
  "corte",
  "estampacion",
  "confeccion",
  "conteo",
  "empaque",
  "terminada",
] as const

type Stage = (typeof STAGES_ORDERED)[number]

const STAGE_META: Record<
  Stage,
  { label: string; bg: string; text: string; border: string; hex: string; pipelineHex: string }
> = {
  programada:  { label: "Programada",  bg: "bg-slate-100",   text: "text-slate-700",   border: "border-slate-300",   hex: "#64748b", pipelineHex: "#94a3b8" },
  diseno:      { label: "Diseño",      bg: "bg-violet-100",  text: "text-violet-700",  border: "border-violet-300",  hex: "#7c3aed", pipelineHex: "#a78bfa" },
  corte:       { label: "Corte",       bg: "bg-orange-100",  text: "text-orange-700",  border: "border-orange-300",  hex: "#ea580c", pipelineHex: "#fb923c" },
  estampacion: { label: "Estampación", bg: "bg-amber-100",   text: "text-amber-700",   border: "border-amber-300",   hex: "#d97706", pipelineHex: "#fbbf24" },
  confeccion:  { label: "Confección",  bg: "bg-green-100",   text: "text-green-700",   border: "border-green-300",   hex: "#16a34a", pipelineHex: "#4ade80" },
  conteo:      { label: "Conteo",      bg: "bg-teal-100",    text: "text-teal-700",    border: "border-teal-300",    hex: "#0d9488", pipelineHex: "#2dd4bf" },
  empaque:     { label: "Empaque",     bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-300", hex: "#059669", pipelineHex: "#34d399" },
  terminada:   { label: "Terminada",   bg: "bg-blue-100",    text: "text-blue-700",    border: "border-blue-300",    hex: "#2563eb", pipelineHex: "#60a5fa" },
}

const PIPELINE_STAGES: Stage[] = ["programada", "diseno", "corte", "estampacion", "confeccion", "conteo", "empaque"]

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 2,
})

// ── Helpers ────────────────────────────────────────────────────────────────────

function padOP(n: number) {
  return `OP-${String(n).padStart(4, "0")}`
}

function padLote(n: number) {
  return `LOTE-${String(n).padStart(4, "0")}`
}

function stageIndex(estado: string): number {
  return STAGES_ORDERED.indexOf(estado as Stage)
}


function formatDate(d: string | null): string {
  if (!d) return "—"
  return new Date(d + "T00:00:00").toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

// ── Progress Bubbles ───────────────────────────────────────────────────────────

function ProgressBubbles({ estado }: { estado: string }) {
  const currentIdx = stageIndex(estado)
  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex items-center gap-0.5">
        {STAGES_ORDERED.map((stage, i) => {
          const meta = STAGE_META[stage]
          const isCompleted = i < currentIdx
          const isCurrent = i === currentIdx
          const isFuture = i > currentIdx

          const bubbleClass = isCompleted
            ? "bg-green-500 border-green-500 text-white"
            : isCurrent
            ? `border-2 text-white animate-pulse`
            : "bg-stone-100 border-stone-200 border-dashed text-stone-300"

          return (
            <React.Fragment key={stage}>
              {i > 0 && (
                <div
                  className={`h-px w-3 shrink-0 ${i <= currentIdx ? "bg-green-400" : "bg-stone-200"}`}
                />
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`h-6 w-6 rounded-full border flex items-center justify-center shrink-0 text-xs font-bold cursor-default transition-all ${bubbleClass}`}
                    style={isCurrent ? { backgroundColor: meta.hex, borderColor: meta.hex } : undefined}
                  >
                    {isCompleted ? "✓" : isFuture ? "" : ""}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">{meta.label}</p>
                </TooltipContent>
              </Tooltip>
            </React.Fragment>
          )
        })}
      </div>
    </TooltipProvider>
  )
}

// ── Estado Badge ───────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: string }) {
  const meta = STAGE_META[estado as Stage] ?? { bg: "bg-stone-100", text: "text-stone-600", label: estado }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.bg} ${meta.text}`}>
      {meta.label}
    </span>
  )
}

// ── KPI Section ────────────────────────────────────────────────────────────────

interface KPIProps {
  lotes: VSeguimientoLote[]
}

function KPISection({ lotes }: KPIProps) {
  const active = lotes.filter((l) => !["finalizado", "completado"].includes(l.estado_lote))
  const cantLotes = active.length
  const unidades = active.reduce((s, l) => s + l.cantidad_programada, 0)
  const empacadas = lotes.reduce((s, l) => s + l.total_empacado, 0)
  const ordenesActivas = new Set(active.map((l) => l.orden_id)).size

  const cards = [
    {
      label: "Lotes activos",
      value: cantLotes.toLocaleString("es-CO"),
      sub: `${ordenesActivas} órdenes en proceso`,
      icon: Activity,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      label: "Unidades en producción",
      value: unidades.toLocaleString("es-CO"),
      sub: "Prendas programadas",
      icon: TrendingUp,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Unidades empacadas",
      value: empacadas.toLocaleString("es-CO"),
      sub: "Listas para despacho",
      icon: Package,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Lotes completados",
      value: lotes.filter((l) => ["completado", "finalizado"].includes(l.estado_lote)).length.toLocaleString("es-CO"),
      sub: "Procesados",
      icon: Clock,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => {
        const Icon = c.icon
        return (
          <div key={c.label} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl ${c.bg}`}>
              <Icon className={`h-5 w-5 ${c.color}`} />
            </div>
            <p className={`text-2xl font-bold ${c.color} tabular-nums`}>{c.value}</p>
            <p className="mt-1 text-xs text-stone-500">{c.label}</p>
            <p className="text-xs text-stone-400">{c.sub}</p>
          </div>
        )
      })}
    </div>
  )
}

// ── Pipeline Visual ────────────────────────────────────────────────────────────

function PipelineSection({ pipeline }: { pipeline: VPipelineProduccion[] }) {
  const pipelineMap = new Map(pipeline.map((p) => [p.estado, p]))
  const maxOrdenes = Math.max(1, ...pipeline.map((p) => p.cantidad_ordenes))

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-sm font-semibold text-stone-700 uppercase tracking-wide">
        Pipeline de producción
      </h2>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 overflow-x-auto pb-2">
        {PIPELINE_STAGES.map((stage, i) => {
          const meta = STAGE_META[stage]
          const entry = pipelineMap.get(stage)
          const ordenes = entry?.cantidad_ordenes ?? 0
          const unidades = entry?.total_unidades ?? 0
          const intensity = ordenes === 0 ? 0 : Math.max(0.15, ordenes / maxOrdenes)

          return (
            <React.Fragment key={stage}>
              {i > 0 && (
                <div className="hidden sm:flex items-center justify-center text-stone-300 shrink-0">
                  <ChevronRight className="h-5 w-5" />
                </div>
              )}
              <div
                className="flex-1 min-w-[110px] rounded-xl p-4 text-center transition-all"
                style={{
                  backgroundColor: ordenes === 0 ? "#f5f5f4" : `${meta.pipelineHex}${Math.round(intensity * 40 + 20).toString(16).padStart(2, "0")}`,
                  border: `1.5px solid ${ordenes === 0 ? "#e7e5e4" : meta.hex}33`,
                }}
              >
                <p
                  className="text-xs font-semibold uppercase tracking-wide mb-1"
                  style={{ color: ordenes === 0 ? "#a8a29e" : meta.hex }}
                >
                  {meta.label}
                </p>
                <p
                  className="text-3xl font-bold tabular-nums"
                  style={{ color: ordenes === 0 ? "#d6d3d1" : meta.hex }}
                >
                  {ordenes}
                </p>
                <p className="text-xs mt-0.5" style={{ color: ordenes === 0 ? "#d6d3d1" : meta.hex }}>
                  {unidades.toLocaleString("es-CO")} ud.
                </p>
              </div>
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

// ── Alerts Section ─────────────────────────────────────────────────────────────

interface AlertasProps {
  lotes: VSeguimientoLote[]
  pipeline: VPipelineProduccion[]
}

function AlertasSection({ lotes, pipeline }: AlertasProps) {
  const cuello = pipeline
    .filter((p) => p.cantidad_ordenes > 0)
    .sort((a, b) => b.cantidad_ordenes - a.cantidad_ordenes)[0]

  const diffConteo = lotes.filter(
    (l) => l.total_contado !== null && l.total_contado > 0 && l.total_contado !== l.cantidad_programada
  )

  const hayAlertas = diffConteo.length > 0

  if (!hayAlertas && !cuello) return null

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
      <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        Alertas y cuellos de botella
      </h2>

      <div className="grid gap-3 sm:grid-cols-2">
        {cuello && cuello.cantidad_ordenes > 1 && (
          <AlertCard
            color="amber"
            titulo="Cuello de botella"
            items={[
              `${STAGE_META[cuello.estado as Stage]?.label ?? cuello.estado} tiene ${cuello.cantidad_ordenes} órdenes acumuladas (${cuello.total_unidades.toLocaleString("es-CO")} unidades)`,
            ]}
          />
        )}

        {diffConteo.length > 0 && (
          <AlertCard
            color="orange"
            titulo="Diferencias en conteo"
            items={diffConteo.map((l) => {
              const diff = (l.total_contado ?? 0) - l.cantidad_programada
              return `${padLote(l.numero_lote)} (${l.referencia}): ${diff > 0 ? "+" : ""}${diff} ud.`
            })}
          />
        )}
      </div>
    </div>
  )
}

function AlertCard({
  color,
  titulo,
  items,
}: {
  color: "red" | "orange" | "amber" | "yellow"
  titulo: string
  items: string[]
}) {
  const colorMap = {
    red:    { border: "border-red-200",    bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-400"    },
    orange: { border: "border-orange-200", bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-400" },
    amber:  { border: "border-amber-200",  bg: "bg-amber-50",  text: "text-amber-700",  dot: "bg-amber-400"  },
    yellow: { border: "border-yellow-200", bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-400" },
  }
  const c = colorMap[color]
  return (
    <div className={`rounded-xl border p-4 ${c.border} ${c.bg}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${c.text}`}>{titulo}</p>
      <ul className="space-y-1">
        {items.slice(0, 5).map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-stone-600">
            <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${c.dot}`} />
            {item}
          </li>
        ))}
        {items.length > 5 && (
          <li className={`text-xs ${c.text} font-medium`}>+{items.length - 5} más</li>
        )}
      </ul>
    </div>
  )
}

// ── OP Detail Sheet ────────────────────────────────────────────────────────────

interface SheetProps {
  lote: VSeguimientoLote | null
  open: boolean
  onClose: () => void
  detalle: DetalleOPData | null
  loading: boolean
  verCostos: boolean
}

function OPDetailSheet({ lote, open, onClose, detalle, loading, verCostos }: SheetProps) {
  if (!lote) return null

  const currentIdx = stageIndex(lote.estado_op)

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-stone-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-mono text-stone-400 mb-1">{padOP(lote.numero_op)}</p>
              <SheetTitle className="text-lg font-bold text-stone-900">{lote.referencia}</SheetTitle>
            </div>
            <EstadoBadge estado={lote.estado_op} />
          </div>
          {lote.op_descripcion && (
            <p className="text-sm text-stone-500 mt-1">{lote.op_descripcion}</p>
          )}
          <p className="text-xs text-stone-400 mt-0.5">
            {padLote(lote.numero_lote)}{lote.lote_descripcion ? ` — ${lote.lote_descripcion}` : ""}
          </p>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 rounded-full border-2 border-stone-200 border-t-[#344966] animate-spin" />
          </div>
        ) : (
          <Tabs defaultValue="resumen" className="flex-1">
            <TabsList className="w-full rounded-none border-b border-stone-100 bg-white px-6 justify-start gap-2 h-auto py-0">
              <TabsTrigger value="resumen" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#344966] data-[state=active]:text-[#344966] py-3 px-1 text-sm">
                Resumen
              </TabsTrigger>
              {verCostos && (
                <TabsTrigger value="costos" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#344966] data-[state=active]:text-[#344966] py-3 px-1 text-sm">
                  Costos
                </TabsTrigger>
              )}
              <TabsTrigger value="trazabilidad" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#344966] data-[state=active]:text-[#344966] py-3 px-1 text-sm">
                Trazabilidad
              </TabsTrigger>
            </TabsList>

            {/* ── Tab Resumen ── */}
            <TabsContent value="resumen" className="p-6 space-y-6">
              {/* Info general del lote */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-stone-400 mb-0.5">Lote</p>
                  <p className="font-mono font-semibold">{padLote(lote.numero_lote)}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400 mb-0.5">Estado lote</p>
                  <EstadoBadge estado={lote.estado_lote} />
                </div>
                <div>
                  <p className="text-xs text-stone-400 mb-0.5">Cantidad programada</p>
                  <p className="font-medium">{lote.cantidad_programada.toLocaleString("es-CO")} ud.</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400 mb-0.5">Empacado</p>
                  <p className="font-medium">{lote.total_empacado.toLocaleString("es-CO")} ud.</p>
                </div>
              </div>

              {/* Progreso del lote */}
              <div>
                {(() => {
                  const pct = lote.cantidad_programada > 0
                    ? Math.min(100, Math.round((lote.total_empacado / lote.cantidad_programada) * 100))
                    : 0
                  return (
                    <>
                      <div className="flex justify-between text-xs text-stone-500 mb-2">
                        <span>Empaque</span>
                        <span className="font-semibold">{pct}%</span>
                      </div>
                      <div className="h-3 rounded-full bg-stone-100 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-stone-400 mt-1">
                        {lote.total_empacado.toLocaleString("es-CO")} / {lote.cantidad_programada.toLocaleString("es-CO")} unidades empacadas
                      </p>
                    </>
                  )
                })()}
              </div>

              {/* Curva de tallas */}
              {detalle && detalle.curva.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Curva de tallas</p>
                  <CurvaTable curva={detalle.curva} />
                </div>
              )}

              {/* Lotes */}
              {detalle && detalle.lotes.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Todos los lotes de la OP</p>
                  <div className="space-y-2">
                    {detalle.lotes.map(({ lote }) => (
                      <div key={lote.id} className="flex items-center justify-between rounded-lg border border-stone-100 px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-stone-500 text-xs">{padLote(lote.numero_lote)}</span>
                          {lote.descripcion && <span className="text-stone-600 text-xs truncate max-w-[120px]">{lote.descripcion}</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-stone-500 text-xs">{lote.cantidad_programada.toLocaleString("es-CO")} ud.</span>
                          <EstadoBadge estado={lote.estado} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── Tab Costos ── */}
            {verCostos && (
              <TabsContent value="costos" className="p-6 space-y-6">
                {!detalle?.costos ? (
                  <p className="text-sm text-stone-400">Sin hoja de costos registrada.</p>
                ) : (
                  <>
                    {detalle.materiales.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Materiales</p>
                        <div className="overflow-x-auto rounded-xl border border-stone-100">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-stone-100 bg-stone-50">
                                {["Material", "Cons. est.", "Cons. real", "Val/prenda"].map((h) => (
                                  <th key={h} className="px-3 py-2 text-left font-semibold text-stone-500 whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {detalle.materiales.map((m) => (
                                <tr key={m.id} className="border-b border-stone-50 last:border-0">
                                  <td className="px-3 py-2 text-stone-800">{m.nombre}</td>
                                  <td className="px-3 py-2 text-stone-500 tabular-nums">{m.consumo_estimado?.toFixed(2) ?? "—"}</td>
                                  <td className="px-3 py-2 text-stone-500 tabular-nums">{m.consumo_real?.toFixed(2) ?? "—"}</td>
                                  <td className="px-3 py-2 tabular-nums">{COP.format(m.valor_por_prenda)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Valores fijos</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {VALORES_FIJOS.map(({ key, label }) => (
                          <div key={key} className="flex justify-between text-xs border-b border-stone-50 pb-1">
                            <span className="text-stone-500">{label}</span>
                            <span className="tabular-nums font-medium">{COP.format(detalle.costos![key] as number)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl bg-stone-50 p-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-stone-500">Costo materiales</span>
                        <span className="tabular-nums">{COP.format(detalle.costos.costo_materiales)}</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span className="text-stone-700">Costo unitario</span>
                        <span className="tabular-nums">{COP.format(detalle.costos.costo_unitario)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-500">Precio de venta</span>
                        <span className="tabular-nums">{detalle.costos.precio_venta != null ? COP.format(detalle.costos.precio_venta) : "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-500">Margen</span>
                        <span className={`tabular-nums font-medium ${detalle.costos.margen >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {COP.format(detalle.costos.margen)}
                        </span>
                      </div>
                      {detalle.costos.total_unidades > 0 && (
                        <div className="border-t border-stone-200 pt-2 mt-2 space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-stone-500">Total unidades</span>
                            <span className="tabular-nums">{detalle.costos.total_unidades.toLocaleString("es-CO")}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-stone-500">Costo total orden</span>
                            <span className="tabular-nums font-semibold">{COP.format(detalle.costos.costo_total)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </TabsContent>
            )}

            {/* ── Tab Trazabilidad ── */}
            <TabsContent value="trazabilidad" className="p-6">
              <TrazabilidadTimeline estadoOP={lote.estado_op} detalle={detalle} currentIdx={currentIdx} />
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ── Curva Table ────────────────────────────────────────────────────────────────

function CurvaTable({ curva }: { curva: Array<{ talla: string }> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {curva.map((r, i) => (
        <span key={i} className="inline-block rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
          {r.talla}
        </span>
      ))}
    </div>
  )
}

// ── Trazabilidad Timeline ──────────────────────────────────────────────────────

function TrazabilidadTimeline({
  estadoOP,
  detalle,
  currentIdx,
}: {
  estadoOP: string
  detalle: DetalleOPData | null
  currentIdx: number
}) {
  const stages: Array<{ stage: Stage; content: React.ReactNode }> = [
    {
      stage: "programada",
      content: (
        <p className="text-xs text-stone-500">—</p>
      ),
    },
    {
      stage: "diseno",
      content: detalle?.diseno ? (
        <div className="text-xs text-stone-500 space-y-0.5">
          <p>Aprobado: <span className="font-medium">{detalle.diseno.aprobado ? "Sí" : "No"}</span></p>
          {detalle.diseno.fecha_aprobacion && (
            <p>Fecha: {formatDate(detalle.diseno.fecha_aprobacion)}</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-stone-400">Sin información de diseño</p>
      ),
    },
    {
      stage: "corte",
      content: detalle?.corte ? (
        <div className="text-xs text-stone-500 space-y-0.5">
          {detalle.corte.consecutivo_corte && (
            <p>Consecutivo: <span className="font-medium">C-{String(detalle.corte.consecutivo_corte).padStart(4, "0")}</span></p>
          )}
          {detalle.corte.fecha_corte && (
            <p>Fecha corte: {formatDate(detalle.corte.fecha_corte)}</p>
          )}
          {detalle.corte.corte_tela.map((t) => (
            <p key={t.id}>{t.nombre_tela}: {t.promedio_consumo?.toFixed(2) ?? "—"} m/prenda</p>
          ))}
        </div>
      ) : (
        <p className="text-xs text-stone-400">Sin información de corte</p>
      ),
    },
    {
      stage: "estampacion",
      content: detalle && detalle.lotes.length > 0 ? (
        <div className="space-y-1">
          {detalle.lotes.map(({ lote, estampacion }) => (
            <div key={lote.id} className="text-xs text-stone-500">
              <span className="font-medium text-stone-700">LOTE-{String(lote.numero_lote).padStart(4, "0")}{lote.descripcion ? ` — ${lote.descripcion}` : ""}</span>
              {estampacion ? (
                <>
                  {estampacion.nombre_estampador && <span> · {estampacion.nombre_estampador}</span>}
                  {estampacion.fecha_entrega_lote && <span>, entrega: {formatDate(estampacion.fecha_entrega_lote)}</span>}
                  {estampacion.fecha_retorno_lote && <span>, retorno: {formatDate(estampacion.fecha_retorno_lote)}</span>}
                </>
              ) : (
                <span className="text-stone-300"> — sin registro</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-stone-400">Sin lotes</p>
      ),
    },
    {
      stage: "confeccion",
      content: detalle && detalle.lotes.length > 0 ? (
        <div className="space-y-1">
          {detalle.lotes.map(({ lote, confeccion }) => (
            <div key={lote.id} className="text-xs text-stone-500">
              <span className="font-medium text-stone-700">LOTE-{String(lote.numero_lote).padStart(4, "0")}</span>
              {confeccion ? (
                <>
                  {confeccion.nombre_confeccionista && <span> — {confeccion.nombre_confeccionista}</span>}
                  {confeccion.cantidad_reconfirmada != null && <span>, {confeccion.cantidad_reconfirmada.toLocaleString("es-CO")} ud.</span>}
                </>
              ) : (
                <span className="text-stone-300"> — sin registro</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-stone-400">Sin lotes</p>
      ),
    },
    {
      stage: "conteo",
      content: detalle && detalle.lotes.length > 0 ? (
        <div className="space-y-1">
          {detalle.lotes.map(({ lote, conteo }) => (
            <div key={lote.id} className="text-xs text-stone-500">
              <span className="font-medium text-stone-700">LOTE-{String(lote.numero_lote).padStart(4, "0")}</span>
              {conteo ? (
                <>
                  <span>: {conteo.total_contado.toLocaleString("es-CO")} ud.</span>
                  {conteo.validado && <span className="text-green-600 ml-1">✓ validado</span>}
                </>
              ) : (
                <span className="text-stone-300"> — sin registro</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-stone-400">Sin lotes</p>
      ),
    },
    {
      stage: "empaque",
      content: detalle && detalle.lotes.length > 0 ? (
        <div className="space-y-1">
          {detalle.lotes.map(({ lote, totalEmpacado, conteo }) => {
            const contado = conteo?.total_contado ?? lote.cantidad_programada
            const pctEmp = contado > 0 ? Math.round((totalEmpacado / contado) * 100) : 0
            return (
              <div key={lote.id} className="text-xs text-stone-500">
                <span className="font-medium text-stone-700">LOTE-{String(lote.numero_lote).padStart(4, "0")}</span>
                <span>: {totalEmpacado.toLocaleString("es-CO")} / {contado.toLocaleString("es-CO")} ud. ({pctEmp}%)</span>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-xs text-stone-400">Sin lotes</p>
      ),
    },
  ]

  return (
    <div className="relative space-y-0">
      {stages.map(({ stage, content }, i) => {
        const idx = stageIndex(stage)
        const isCompleted = currentIdx > idx
        const isCurrent = currentIdx === idx
        const isFuture = currentIdx < idx
        const meta = STAGE_META[stage]
        const isLast = i === stages.length - 1

        return (
          <div key={stage} className="flex gap-4">
            {/* Line + dot */}
            <div className="flex flex-col items-center">
              <div
                className="h-7 w-7 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-bold z-10"
                style={
                  isCompleted
                    ? { backgroundColor: "#22c55e", borderColor: "#22c55e", color: "white" }
                    : isCurrent
                    ? { backgroundColor: meta.hex, borderColor: meta.hex, color: "white" }
                    : { backgroundColor: "#f5f5f4", borderColor: "#e7e5e4", color: "#a8a29e" }
                }
              >
                {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : isCurrent ? "▶" : "○"}
              </div>
              {!isLast && (
                <div
                  className="w-0.5 flex-1 my-1"
                  style={{ backgroundColor: isCompleted ? "#86efac" : "#e7e5e4", minHeight: "24px" }}
                />
              )}
            </div>

            {/* Content */}
            <div className="pb-5 flex-1 min-w-0">
              <p
                className="text-sm font-semibold mb-1"
                style={{ color: isCompleted ? "#22c55e" : isCurrent ? meta.hex : "#a8a29e" }}
              >
                {meta.label}
                {isCurrent && <span className="ml-2 text-xs font-normal opacity-75">en proceso</span>}
              </p>
              <div className={isFuture ? "opacity-40" : ""}>{content}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

const LOTE_ESTADOS = ["cortado", "estampacion", "confeccion", "conteo", "empaque", "completado", "finalizado"]
const LOTE_ESTADO_LABELS: Record<string, string> = {
  cortado: "Cortado", estampacion: "Estampación", confeccion: "Confección",
  conteo: "Conteo", empaque: "Empaque", completado: "Completado", finalizado: "Finalizado",
}

interface Props {
  lotes: VSeguimientoLote[]
  pipeline: VPipelineProduccion[]
  verCostos: boolean
}

export default function SeguimientoClient({ lotes, pipeline, verCostos }: Props) {
  const [searchQuery, setSearchQuery] = useState("")
  const [estadoFiltro, setEstadoFiltro] = useState("activos")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedLote, setSelectedLote] = useState<VSeguimientoLote | null>(null)
  const [detalle, setDetalle] = useState<DetalleOPData | null>(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)

  const filteredLotes = useMemo(() => {
    return lotes.filter((l) => {
      if (estadoFiltro === "activos" && ["completado", "finalizado"].includes(l.estado_lote)) return false
      if (estadoFiltro !== "activos" && estadoFiltro !== "todos" && l.estado_lote !== estadoFiltro) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (
          !l.referencia.toLowerCase().includes(q) &&
          !String(l.numero_op).includes(q) &&
          !String(l.numero_lote).includes(q) &&
          !(l.lote_descripcion ?? "").toLowerCase().includes(q)
        ) return false
      }
      return true
    })
  }, [lotes, estadoFiltro, searchQuery])

  function handleOpenDetalle(lote: VSeguimientoLote) {
    setSelectedLote(lote)
    setSheetOpen(true)
    setDetalle(null)
    setLoadingDetalle(true)
    getDetalleOPAction(lote.orden_id)
      .then((data) => setDetalle(data))
      .finally(() => setLoadingDetalle(false))
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Seguimiento de Producción</h1>
          <p className="text-sm text-stone-500">Estado operacional en tiempo real — vista por lotes</p>
        </div>

        {/* KPIs */}
        <KPISection lotes={lotes} />

        {/* Pipeline */}
        <PipelineSection pipeline={pipeline} />

        {/* Table section */}
        <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
          {/* Filters */}
          <div className="px-5 py-4 border-b border-stone-100 flex flex-wrap gap-3 items-center">
            <input
              type="text"
              placeholder="Buscar por referencia, OP, lote o descripción..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 min-w-[200px] rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
            />
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              className="rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966] bg-white"
            >
              <option value="activos">Activos</option>
              <option value="todos">Todos</option>
              {LOTE_ESTADOS.map((s) => (
                <option key={s} value={s}>{LOTE_ESTADO_LABELS[s] ?? s}</option>
              ))}
            </select>
            <span className="text-xs text-stone-400 ml-auto">{filteredLotes.length} lote{filteredLotes.length !== 1 ? "s" : ""}</span>
          </div>

          {filteredLotes.length === 0 ? (
            <div className="py-16 text-center text-stone-400 text-sm">No hay lotes que coincidan con los filtros.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100">
                    {["Referencia", "OP", "Lote", "Descripción", "Cantidad", "Estado OP", "Estado Lote", ""].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide text-left whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLotes.map((lote) => (
                    <tr
                      key={lote.lote_id}
                      className="border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-stone-800">{lote.referencia}</p>
                        {lote.op_descripcion && (
                          <p className="text-xs text-stone-400 truncate max-w-[140px]">{lote.op_descripcion}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-md bg-stone-100 px-2 py-0.5 text-xs font-mono font-semibold text-stone-600">
                          {padOP(lote.numero_op)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-stone-700 whitespace-nowrap">
                        {padLote(lote.numero_lote)}
                      </td>
                      <td className="px-4 py-3 text-stone-500 max-w-[160px]">
                        <span className="truncate block">{lote.lote_descripcion ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-stone-700 whitespace-nowrap">
                        {lote.cantidad_programada.toLocaleString("es-CO")} ud.
                      </td>
                      <td className="px-4 py-3">
                        <EstadoBadge estado={lote.estado_op} />
                      </td>
                      <td className="px-4 py-3">
                        <EstadoBadge estado={lote.estado_lote} />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleOpenDetalle(lote)}
                          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-100 transition-colors"
                        >
                          Ver →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Alerts */}
        <AlertasSection lotes={lotes} pipeline={pipeline} />

        {/* Sheet */}
        <OPDetailSheet
          lote={selectedLote}
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          detalle={detalle}
          loading={loadingDetalle}
          verCostos={verCostos}
        />
      </div>
    </TooltipProvider>
  )
}
