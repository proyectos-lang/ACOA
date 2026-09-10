"use client"

import * as React from "react"
import { useTransition } from "react"
import {
  CheckCircle2,
  AlertTriangle,
  Package,
  Wallet,
  Users,
  Layers,
  FileSpreadsheet,
  Printer,
} from "lucide-react"
import type { LineaProduccion } from "@/lib/db/nomina-diaria"
import type { PersonaRow } from "@/lib/db/persona"
import { cargarNominaProduccionAction } from "@/app/(dashboard)/nomina/diaria-actions"
import { Card } from "@/components/ui/card"

function cop(n: number) {
  return `$${Math.round(Number(n)).toLocaleString("es-CO")}`
}
function padOP(n: number | null) {
  return n ? `OP-${String(n).padStart(4, "0")}` : "—"
}
const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

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

// Nómina pagada por producción: por cada día y persona, qué referencias
// empacó, cuántas prendas de cada una y cuánto se le paga por ellas.
export function NominaProduccionClient({
  lineasIniciales,
  valorPrendaInicial,
  empleados,
  desdeInicial,
  hastaInicial,
}: {
  lineasIniciales: LineaProduccion[]
  valorPrendaInicial: number
  empleados: PersonaRow[]
  desdeInicial: string
  hastaInicial: string
}) {
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)
  const [lineas, setLineas] = React.useState(lineasIniciales)
  const [valorPrenda, setValorPrenda] = React.useState(valorPrendaInicial)
  const [cargando, startCarga] = useTransition()

  const [desde, setDesde] = React.useState(desdeInicial)
  const [hasta, setHasta] = React.useState(hastaInicial)
  const [personaId, setPersonaId] = React.useState("")
  const [fRef, setFRef] = React.useState("")

  function showToast(tipo: "ok" | "error", msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 4000)
  }

  function recargar() {
    startCarga(async () => {
      const res = await cargarNominaProduccionAction({
        desde,
        hasta,
        personaId: personaId ? parseInt(personaId, 10) : null,
      })
      if (res.error) showToast("error", res.error)
      else {
        setLineas(res.lineas ?? [])
        if (res.valorPrenda != null) setValorPrenda(res.valorPrenda)
      }
    })
  }

  const visibles = lineas.filter((l) => {
    if (fRef) {
      const q = fRef.toLowerCase()
      if (
        !l.referencia.toLowerCase().includes(q) &&
        !padOP(l.numero_op).toLowerCase().includes(q)
      )
        return false
    }
    return true
  })

  const totalUnidades = visibles.reduce((s, l) => s + l.unidades, 0)
  const totalPagar = visibles.reduce((s, l) => s + l.valor_total, 0)
  const personasUnicas = new Set(visibles.map((l) => l.persona_id)).size
  const refsUnicas = new Set(visibles.map((l) => l.referencia)).size

  // Subtotales por día + persona, para separar visualmente los bloques
  const grupos = React.useMemo(() => {
    const out: Array<{
      clave: string
      fecha: string
      dia_semana: number
      persona: string
      documento: string
      filas: LineaProduccion[]
      unidades: number
      total: number
    }> = []
    for (const l of visibles) {
      const clave = `${l.fecha}|${l.persona_id}`
      let g = out.find((x) => x.clave === clave)
      if (!g) {
        g = {
          clave,
          fecha: l.fecha,
          dia_semana: l.dia_semana,
          persona: l.persona_nombre,
          documento: l.persona_documento,
          filas: [],
          unidades: 0,
          total: 0,
        }
        out.push(g)
      }
      g.filas.push(l)
      g.unidades += l.unidades
      g.total += l.valor_total
    }
    return out
  }, [visibles])

  // Resumen por referencia del periodo
  const porReferencia = React.useMemo(() => {
    const map = new Map<string, { referencia: string; unidades: number; total: number }>()
    for (const l of visibles) {
      const r = map.get(l.referencia) ?? { referencia: l.referencia, unidades: 0, total: 0 }
      r.unidades += l.unidades
      r.total += l.valor_total
      map.set(l.referencia, r)
    }
    return [...map.values()].sort((a, b) => b.unidades - a.unidades)
  }, [visibles])

  const esc = (t: unknown) =>
    String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  function exportarExcel() {
    const filas = visibles
      .map(
        (l) =>
          `<tr><td>${esc(l.fecha)}</td><td>${DIAS[l.dia_semana]}</td><td>${esc(
            l.persona_nombre
          )}</td><td>${esc(l.persona_documento)}</td><td>${padOP(l.numero_op)}</td><td>${esc(
            l.referencia
          )}</td><td>${esc(l.lote_nombre)}</td><td>${l.unidades}</td><td>${
            l.valor_unitario
          }</td><td>${l.valor_total}</td></tr>`
      )
      .join("")
    const tabla = `<html><head><meta charset="utf-8"></head><body><table border="1"><tr><th>Fecha</th><th>Día</th><th>Persona</th><th>Documento</th><th>OP</th><th>Referencia</th><th>Lote</th><th>Prendas</th><th>Valor unitario</th><th>A pagar</th></tr>${filas}</table></body></html>`
    const blob = new Blob(["﻿" + tabla], { type: "application/vnd.ms-excel" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `nomina-produccion-${desde}_a_${hasta}.xls`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function imprimir() {
    const cuerpo = grupos
      .map(
        (g) =>
          `<tr class="grupo"><td colspan="4">${esc(g.fecha)} · ${DIAS[g.dia_semana]} · <strong>${esc(
            g.persona
          )}</strong></td><td>${cop(g.total)}</td></tr>` +
          g.filas
            .map(
              (l) =>
                `<tr><td class="izq">${padOP(l.numero_op)}</td><td class="izq">${esc(
                  l.referencia
                )}</td><td class="izq">${esc(l.lote_nombre)}</td><td>${l.unidades}</td><td>${cop(
                  l.valor_total
                )}</td></tr>`
            )
            .join("")
      )
      .join("")

    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>Nómina por producción ${esc(desde)} a ${esc(hasta)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: letter; margin: 10mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #111; padding: 14px; }
  .titulo { background: #f2e14c; border: 1.5px solid #111; font-weight: bold; font-size: 12px;
            padding: 5px 8px; display: flex; justify-content: space-between; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border-bottom: 1px solid #ddd; padding: 2px 6px; font-size: 9px; text-align: center; }
  th { background: #eee; text-transform: uppercase; font-size: 8px; }
  .izq { text-align: left; }
  tr.grupo td { background: #f0f0f0; font-weight: bold; text-align: left; border-top: 1px solid #111; }
  tr.grupo td:last-child { text-align: right; }
  tr { page-break-inside: avoid; }
</style></head><body>
  <div class="titulo"><span>NÓMINA POR PRODUCCIÓN</span><span>${esc(desde)} a ${esc(hasta)}</span></div>
  <table>
    <thead><tr><th class="izq">OP</th><th class="izq">Referencia</th><th class="izq">Lote</th><th>Prendas</th><th>A pagar</th></tr></thead>
    <tbody>${cuerpo}</tbody>
  </table>
  <div class="titulo" style="margin-top:8px"><span>TOTAL · ${totalUnidades.toLocaleString(
    "es-CO"
  )} prendas</span><span>${cop(totalPagar)}</span></div>
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
            <div className="rounded-xl bg-blue-50 p-3">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-stone-500">Personas</p>
              <p className="text-2xl font-bold text-stone-900">{personasUnicas}</p>
            </div>
          </div>
          <div className={cardCls}>
            <div className="rounded-xl bg-teal-50 p-3">
              <Package className="h-6 w-6 text-teal-600" />
            </div>
            <div>
              <p className="text-xs text-stone-500">Prendas empacadas</p>
              <p className="text-2xl font-bold text-teal-700 font-mono">
                {totalUnidades.toLocaleString("es-CO")}
              </p>
            </div>
          </div>
          <div className={cardCls}>
            <div className="rounded-xl bg-purple-50 p-3">
              <Layers className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-stone-500">Referencias</p>
              <p className="text-2xl font-bold text-stone-900">{refsUnicas}</p>
              <p className="text-[11px] text-stone-400">{cop(valorPrenda)} por prenda</p>
            </div>
          </div>
          <div className={cardCls}>
            <div className="rounded-xl bg-emerald-50 p-3">
              <Wallet className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-stone-500">Total a pagar</p>
              <p className="text-2xl font-bold text-emerald-700 font-mono">{cop(totalPagar)}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
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
            <label className="text-[11px] font-medium text-stone-500">Persona</label>
            <select
              value={personaId}
              onChange={(e) => setPersonaId(e.target.value)}
              className={`${filtroCls} w-full`}
            >
              <option value="">Todas</option>
              {empleados.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-0.5">
            <label className="text-[11px] font-medium text-stone-500">OP / Referencia</label>
            <input
              type="text"
              value={fRef}
              onChange={(e) => setFRef(e.target.value)}
              className={`${filtroCls} w-full`}
              placeholder="961"
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
        {valorPrenda === 0 && (
          <p className="mt-3 text-xs text-amber-600">
            El valor por prenda empacada está en $0. Configúralo en la pestaña Configuración
            para que la producción se liquide.
          </p>
        )}
      </Card>

      {/* Tabla por día, persona y referencia */}
      {grupos.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="h-10 w-10 mx-auto mb-3 text-stone-300" />
          <p className="text-stone-400 text-sm">
            No hay empaque registrado en este periodo con los filtros actuales.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-stone-50 border-b border-stone-100">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-stone-500 uppercase">
                    Fecha
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-stone-500 uppercase">
                    Trabajador
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-stone-500 uppercase">
                    OP
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-stone-500 uppercase">
                    Referencia
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-stone-500 uppercase">
                    Lote
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-stone-500 uppercase">
                    Prendas
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-stone-500 uppercase">
                    Valor unit.
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-stone-500 uppercase">
                    A pagar
                  </th>
                </tr>
              </thead>
              <tbody>
                {grupos.map((g) => (
                  <React.Fragment key={g.clave}>
                    {g.filas.map((l, i) => (
                      <tr
                        key={`${g.clave}_${i}`}
                        className="border-b border-stone-100 hover:bg-stone-50"
                      >
                        {i === 0 ? (
                          <>
                            <td
                              rowSpan={g.filas.length}
                              className="px-3 py-2 align-top whitespace-nowrap border-r border-stone-100"
                            >
                              <span className="font-mono text-xs text-stone-700">{g.fecha}</span>
                              <span
                                className={`block text-[11px] ${
                                  g.dia_semana === 0
                                    ? "font-semibold text-amber-700"
                                    : "text-stone-400"
                                }`}
                              >
                                {DIAS[g.dia_semana]}
                              </span>
                            </td>
                            <td
                              rowSpan={g.filas.length}
                              className="px-3 py-2 align-top border-r border-stone-100"
                            >
                              <span className="font-medium text-stone-800">{g.persona}</span>
                              <span className="block text-[11px] text-stone-400 font-mono">
                                {g.documento}
                              </span>
                            </td>
                          </>
                        ) : null}
                        <td className="px-3 py-2 font-mono text-xs text-stone-600">
                          {padOP(l.numero_op)}
                        </td>
                        <td className="px-3 py-2 font-semibold text-stone-800">{l.referencia}</td>
                        <td className="px-3 py-2 text-xs text-stone-600">{l.lote_nombre}</td>
                        <td className="px-3 py-2 text-right font-mono text-teal-700">
                          {l.unidades.toLocaleString("es-CO")}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-stone-500">
                          {cop(l.valor_unitario)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-stone-900">
                          {cop(l.valor_total)}
                        </td>
                      </tr>
                    ))}
                    {/* Subtotal del día para esa persona */}
                    <tr className="border-b-2 border-stone-200 bg-stone-50">
                      <td colSpan={5} className="px-3 py-1.5 text-right text-xs font-semibold text-stone-600">
                        Total del día · {g.persona}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-xs font-bold text-teal-700">
                        {g.unidades.toLocaleString("es-CO")}
                      </td>
                      <td />
                      <td className="px-3 py-1.5 text-right font-mono text-sm font-bold text-stone-900">
                        {cop(g.total)}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
                <tr className="bg-stone-100 sticky bottom-0">
                  <td colSpan={5} className="px-3 py-2 text-xs font-bold text-stone-700">
                    Total del periodo
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-sm font-bold text-teal-700">
                    {totalUnidades.toLocaleString("es-CO")}
                  </td>
                  <td />
                  <td className="px-3 py-2 text-right font-mono text-sm font-bold text-stone-900">
                    {cop(totalPagar)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Resumen por referencia */}
      {porReferencia.length > 0 && (
        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-stone-700 border-b border-stone-100 pb-2">
            Resumen por referencia
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left py-2 text-xs text-stone-500 font-medium">Referencia</th>
                  <th className="text-right py-2 text-xs text-stone-500 font-medium">Prendas</th>
                  <th className="text-right py-2 text-xs text-stone-500 font-medium">A pagar</th>
                </tr>
              </thead>
              <tbody>
                {porReferencia.map((r) => (
                  <tr key={r.referencia} className="border-b border-stone-100 last:border-0">
                    <td className="py-2 font-medium text-stone-800">{r.referencia}</td>
                    <td className="py-2 text-right font-mono text-teal-700">
                      {r.unidades.toLocaleString("es-CO")}
                    </td>
                    <td className="py-2 text-right font-mono font-semibold text-stone-900">
                      {cop(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
