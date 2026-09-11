"use client"

import * as React from "react"
import { useTransition } from "react"
import Link from "next/link"
import {
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Scissors,
  Layers,
  Package,
  CalendarDays,
  FileSpreadsheet,
  Printer,
  ExternalLink,
} from "lucide-react"
import type { DiaCorte, CorteEntregado } from "@/lib/db/reporte-corte"
import { cargarReporteCortesAction } from "@/app/(dashboard)/corte/reporte-actions"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

function padOP(n: number) {
  return `OP-${String(n).padStart(4, "0")}`
}
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

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

// Una OP cortada, con su detalle por material, color y lote
function CorteCard({ c }: { c: CorteEntregado }) {
  const [abierto, setAbierto] = React.useState(false)

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 cursor-pointer hover:bg-stone-50"
        onClick={() => setAbierto((a) => !a)}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-stone-400">
            {abierto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-stone-800">
              <span className="font-mono">{padOP(c.numero_op)}</span>
              <span className="ml-2 text-stone-600">{c.referencia}</span>
            </p>
            <p className="text-xs text-stone-500 truncate">
              {c.lotes.length} lote{c.lotes.length !== 1 ? "s" : ""}
              {c.lotes.length > 0 && (
                <span className="text-stone-400"> · {c.lotes.join(", ")}</span>
              )}
              {c.telas.length > 0 && (
                <span className="text-stone-400"> · {c.telas.join(" / ")}</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          {c.cambios > 0 && (
            <Badge className="bg-amber-100 text-amber-800 border-0 text-[10px]">
              {c.cambios} cambio{c.cambios !== 1 ? "s" : ""}
            </Badge>
          )}
          <div className="text-right">
            <p className="text-[11px] text-stone-500">Capas</p>
            <p className="font-mono font-bold text-stone-700">{c.total_capas}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-stone-500">Prendas</p>
            <p className="font-mono font-bold text-teal-700">
              {c.total_prendas.toLocaleString("es-CO")}
            </p>
          </div>
          <Link
            href={`/corte/${c.orden_id}`}
            onClick={(e) => e.stopPropagation()}
            className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100"
            title="Abrir la ficha de corte"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {abierto && (
        <div className="border-t border-stone-100 bg-stone-50/60 px-3 py-3">
          <div className="rounded-lg border border-stone-200 bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100">
                  <th className="px-3 py-1.5 text-left text-xs text-stone-500 font-medium">Mat.</th>
                  <th className="px-3 py-1.5 text-left text-xs text-stone-500 font-medium">Tela</th>
                  <th className="px-3 py-1.5 text-left text-xs text-stone-500 font-medium">Color</th>
                  <th className="px-3 py-1.5 text-left text-xs text-stone-500 font-medium">Lote</th>
                  <th className="px-3 py-1.5 text-right text-xs text-stone-500 font-medium">Prog.</th>
                  <th className="px-3 py-1.5 text-right text-xs text-stone-500 font-medium">Real</th>
                  <th className="px-3 py-1.5 text-left text-xs text-stone-500 font-medium">
                    Comentario
                  </th>
                </tr>
              </thead>
              <tbody>
                {c.detalle.map((d, i) => {
                  const cambio = d.capas_reales !== d.capas_programadas
                  return (
                    <tr
                      key={i}
                      className={`border-b border-stone-100 last:border-0 ${
                        cambio ? "bg-amber-50/60" : ""
                      }`}
                    >
                      <td className="px-3 py-1.5 font-mono text-xs text-stone-500">M{d.slot}</td>
                      <td className="px-3 py-1.5 text-xs text-stone-600">{d.tipo_tela}</td>
                      <td className="px-3 py-1.5 font-medium text-stone-800">{d.color}</td>
                      <td className="px-3 py-1.5 text-stone-700">{d.lote_nombre}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-xs text-stone-500">
                        {d.capas_programadas}
                      </td>
                      <td
                        className={`px-3 py-1.5 text-right font-mono text-xs font-bold ${
                          cambio ? "text-amber-700" : "text-stone-800"
                        }`}
                      >
                        {d.capas_reales}
                      </td>
                      <td className="px-3 py-1.5 text-[11px] text-stone-500">
                        {d.comentario ?? ""}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-stone-400">
            Corte #{c.consecutivo_corte} · {c.tallas} tallas · programado para{" "}
            {c.fecha_programacion ?? "—"}
            {c.cambios > 0 && " · las filas resaltadas cambiaron frente a lo programado"}
          </p>
        </div>
      )}
    </div>
  )
}

export function ReporteCortesClient({
  diasIniciales,
  desdeInicial,
  hastaInicial,
}: {
  diasIniciales: DiaCorte[]
  desdeInicial: string
  hastaInicial: string
}) {
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)
  const [dias, setDias] = React.useState(diasIniciales)
  const [cargando, startCarga] = useTransition()

  const [desde, setDesde] = React.useState(desdeInicial)
  const [hasta, setHasta] = React.useState(hastaInicial)
  const [fOP, setFOP] = React.useState("")

  function showToast(tipo: "ok" | "error", msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 4000)
  }

  function recargar() {
    startCarga(async () => {
      const res = await cargarReporteCortesAction({ desde, hasta })
      if (res.error) showToast("error", res.error)
      else setDias(res.dias ?? [])
    })
  }

  // Filtro por OP o referencia sobre lo cargado
  const visibles = React.useMemo(() => {
    if (!fOP) return dias
    const q = fOP.toLowerCase()
    return dias
      .map((d) => ({
        ...d,
        cortes: d.cortes.filter(
          (c) =>
            padOP(c.numero_op).toLowerCase().includes(q) ||
            c.referencia.toLowerCase().includes(q)
        ),
      }))
      .filter((d) => d.cortes.length > 0)
      .map((d) => ({
        ...d,
        total_capas: d.cortes.reduce((s, c) => s + c.total_capas, 0),
        total_prendas: d.cortes.reduce((s, c) => s + c.total_prendas, 0),
        total_ops: d.cortes.length,
      }))
  }, [dias, fOP])

  const totalCortes = visibles.reduce((s, d) => s + d.total_ops, 0)
  const totalCapas = visibles.reduce((s, d) => s + d.total_capas, 0)
  const totalPrendas = visibles.reduce((s, d) => s + d.total_prendas, 0)

  const esc = (t: unknown) =>
    String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  function exportarExcel() {
    const filas = visibles
      .flatMap((d) =>
        d.cortes.flatMap((c) =>
          c.detalle.map(
            (x) =>
              `<tr><td>${esc(d.fecha)}</td><td>${DIAS[d.dia_semana]}</td><td>${padOP(
                c.numero_op
              )}</td><td>${esc(c.referencia)}</td><td>M${x.slot}</td><td>${esc(
                x.tipo_tela
              )}</td><td>${esc(x.color)}</td><td>${esc(x.lote_nombre)}</td><td>${
                x.capas_programadas
              }</td><td>${x.capas_reales}</td><td>${esc(x.comentario)}</td></tr>`
          )
        )
      )
      .join("")
    const tabla = `<html><head><meta charset="utf-8"></head><body><table border="1"><tr><th>Fecha</th><th>Día</th><th>OP</th><th>Referencia</th><th>Material</th><th>Tela</th><th>Color</th><th>Lote</th><th>Capas prog.</th><th>Capas reales</th><th>Comentario</th></tr>${filas}</table></body></html>`
    const blob = new Blob(["﻿" + tabla], { type: "application/vnd.ms-excel" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `reporte-cortes-${desde}_a_${hasta}.xls`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function imprimir() {
    const secciones = visibles
      .map(
        (d) => `
      <div class="dia">
        <div class="cab">
          <span><strong>${DIAS[d.dia_semana]} ${esc(d.fecha)}</strong></span>
          <span>${d.total_ops} OP · ${d.total_capas} capas · ${d.total_prendas.toLocaleString(
            "es-CO"
          )} prendas</span>
        </div>
        ${d.cortes
          .map(
            (c) => `
        <table>
          <thead>
            <tr><th colspan="6" class="izq op">${padOP(c.numero_op)} · ${esc(
              c.referencia
            )} · ${c.total_capas} capas · ${c.total_prendas.toLocaleString("es-CO")} prendas</th></tr>
            <tr><th>Mat.</th><th class="izq">Tela</th><th class="izq">Color</th><th class="izq">Lote</th><th>Prog.</th><th>Real</th></tr>
          </thead>
          <tbody>
            ${c.detalle
              .map(
                (x) =>
                  `<tr><td>M${x.slot}</td><td class="izq">${esc(x.tipo_tela)}</td><td class="izq">${esc(
                    x.color
                  )}</td><td class="izq">${esc(x.lote_nombre)}</td><td>${
                    x.capas_programadas
                  }</td><td class="${
                    x.capas_reales !== x.capas_programadas ? "cambio" : ""
                  }">${x.capas_reales}</td></tr>`
              )
              .join("")}
          </tbody>
        </table>`
          )
          .join("")}
      </div>`
      )
      .join("")

    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>Reporte de cortes ${esc(desde)} a ${esc(hasta)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: letter; margin: 10mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #111; padding: 14px; }
  .titulo { background: #f2e14c; border: 1.5px solid #111; font-weight: bold; font-size: 12px;
            padding: 5px 8px; display: flex; justify-content: space-between; margin-bottom: 8px; }
  .dia { border: 1px solid #111; margin-bottom: 8px; page-break-inside: avoid; }
  .cab { background: #ddd; padding: 3px 6px; display: flex; justify-content: space-between;
         border-bottom: 1px solid #111; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 2px; }
  th, td { border-bottom: 1px solid #ddd; padding: 2px 6px; font-size: 9px; text-align: center; }
  th { background: #f7f7f7; text-transform: uppercase; font-size: 8px; }
  th.op { background: #eee; text-transform: none; font-size: 9px; }
  .izq { text-align: left; }
  td.cambio { background: #fff3cd; font-weight: bold; }
  tr { page-break-inside: avoid; }
</style></head><body>
  <div class="titulo"><span>REPORTE DE CORTES ENTREGADOS</span><span>${esc(desde)} a ${esc(
    hasta
  )}</span></div>
  ${secciones}
  <div class="titulo"><span>TOTAL · ${totalCortes} cortes · ${totalCapas} capas</span><span>${totalPrendas.toLocaleString(
    "es-CO"
  )} prendas</span></div>
  <script>window.addEventListener("load",function(){setTimeout(function(){window.print()},250)})<\/script>
</body></html>`)
    w.document.close()
    w.focus()
  }

  const cardCls = "p-5 flex items-center gap-4"

  return (
    <div className="space-y-4">
      {toast && <Toast tipo={toast.tipo} msg={toast.msg} />}

      {/* Totales */}
      <Card className="p-0 overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-stone-200">
          <div className={cardCls}>
            <div className="rounded-xl bg-amber-50 p-3">
              <Scissors className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-stone-500">Cortes entregados</p>
              <p className="text-2xl font-bold text-stone-900">{totalCortes}</p>
            </div>
          </div>
          <div className={cardCls}>
            <div className="rounded-xl bg-blue-50 p-3">
              <CalendarDays className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-stone-500">Días con corte</p>
              <p className="text-2xl font-bold text-stone-900">{visibles.length}</p>
            </div>
          </div>
          <div className={cardCls}>
            <div className="rounded-xl bg-stone-100 p-3">
              <Layers className="h-6 w-6 text-stone-600" />
            </div>
            <div>
              <p className="text-xs text-stone-500">Capas cortadas</p>
              <p className="text-2xl font-bold text-stone-900 font-mono">
                {totalCapas.toLocaleString("es-CO")}
              </p>
            </div>
          </div>
          <div className={cardCls}>
            <div className="rounded-xl bg-teal-50 p-3">
              <Package className="h-6 w-6 text-teal-600" />
            </div>
            <div>
              <p className="text-xs text-stone-500">Prendas cortadas</p>
              <p className="text-2xl font-bold text-teal-700 font-mono">
                {totalPrendas.toLocaleString("es-CO")}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div className="space-y-0.5">
            <label className="text-[11px] font-medium text-stone-500">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className={`${filtroCls} w-full`}
            />
          </div>
          <div className="space-y-0.5">
            <label className="text-[11px] font-medium text-stone-500">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className={`${filtroCls} w-full`}
            />
          </div>
          <div className="space-y-0.5">
            <label className="text-[11px] font-medium text-stone-500">OP / Referencia</label>
            <input
              type="text"
              value={fOP}
              onChange={(e) => setFOP(e.target.value)}
              className={`${filtroCls} w-full`}
              placeholder="OP-0001 o 961"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={recargar}
              disabled={cargando}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: "#344966" }}
            >
              {cargando ? "Buscando…" : "Buscar"}
            </button>
            <button
              type="button"
              onClick={imprimir}
              className="flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50"
            >
              <Printer className="h-3.5 w-3.5" /> PDF
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
      </Card>

      {/* Días con sus cortes */}
      {visibles.length === 0 ? (
        <Card className="p-12 text-center">
          <Scissors className="h-10 w-10 mx-auto mb-3 text-stone-300" />
          <p className="text-stone-400 text-sm">
            No hay cortes entregados en este periodo con los filtros actuales.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {visibles.map((d) => (
            <Card key={d.fecha} className="p-0 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-100/70 px-4 py-2.5 border-b border-stone-200">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-stone-500" />
                  <span className="font-semibold text-stone-800 capitalize">
                    {DIAS[d.dia_semana]} {d.fecha}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-stone-600">
                    <strong className="text-stone-800">{d.total_ops}</strong> OP
                  </span>
                  <span className="text-stone-600">
                    <strong className="font-mono text-stone-800">{d.total_capas}</strong> capas
                  </span>
                  <span className="text-stone-600">
                    <strong className="font-mono text-teal-700">
                      {d.total_prendas.toLocaleString("es-CO")}
                    </strong>{" "}
                    prendas
                  </span>
                </div>
              </div>
              <div className="p-3 space-y-2">
                {d.cortes.map((c) => (
                  <CorteCard key={c.corte_id} c={c} />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
