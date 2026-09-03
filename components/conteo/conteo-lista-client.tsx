"use client"

import * as React from "react"
import Link from "next/link"
import { FileText } from "lucide-react"
import { LOTE_ESTADO_COLOR, LOTE_ESTADO_LABEL } from "@/lib/db/lote"
import type { LoteConConteo } from "@/lib/db/conteo"

function padLote(n: number) {
  return `LOTE-${String(n).padStart(4, "0")}`
}
function padOP(n: number) {
  return `OP-${String(n).padStart(4, "0")}`
}

const filtroCls =
  "rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"

export function ConteoListaClient({ lotes }: { lotes: LoteConConteo[] }) {
  const [fLote, setFLote] = React.useState("")
  const [fOP, setFOP] = React.useState("")
  const [fDesde, setFDesde] = React.useState("")
  const [fHasta, setFHasta] = React.useState("")

  const hayFiltros = fLote || fOP || fDesde || fHasta

  const filtrados = lotes.filter((lote) => {
    const nombreLote = (lote.descripcion ?? padLote(lote.numero_lote)).toLowerCase()
    if (fLote && !nombreLote.includes(fLote.toLowerCase())) return false
    if (fOP) {
      const q = fOP.toLowerCase()
      const coincideOP =
        padOP(lote.orden.numero_op).toLowerCase().includes(q) ||
        lote.orden.referencia.toLowerCase().includes(q)
      if (!coincideOP) return false
    }
    if (fDesde || fHasta) {
      const fecha = lote.conteo?.fecha_conteo
      if (!fecha) return false
      if (fDesde && fecha < fDesde) return false
      if (fHasta && fecha > fHasta) return false
    }
    return true
  })

  return (
    <div className="space-y-4">
      {/* ── Filtros ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 flex flex-wrap items-end gap-3">
        <div className="space-y-0.5">
          <label className="text-[11px] font-medium text-stone-500">Lote</label>
          <input
            type="text"
            value={fLote}
            onChange={(e) => setFLote(e.target.value)}
            className={`${filtroCls} w-36`}
            placeholder="Lote 1"
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-[11px] font-medium text-stone-500">OP / Referencia</label>
          <input
            type="text"
            value={fOP}
            onChange={(e) => setFOP(e.target.value)}
            className={`${filtroCls} w-40`}
            placeholder="OP-0001"
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-[11px] font-medium text-stone-500">Fecha conteo desde</label>
          <input
            type="date"
            value={fDesde}
            onChange={(e) => setFDesde(e.target.value)}
            className={filtroCls}
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-[11px] font-medium text-stone-500">Hasta</label>
          <input
            type="date"
            value={fHasta}
            onChange={(e) => setFHasta(e.target.value)}
            className={filtroCls}
          />
        </div>
        {hayFiltros && (
          <button
            type="button"
            onClick={() => {
              setFLote("")
              setFOP("")
              setFDesde("")
              setFHasta("")
            }}
            className="rounded-xl px-3 py-2 text-xs font-medium border border-stone-200 text-stone-500 hover:bg-stone-50"
          >
            Limpiar filtros
          </button>
        )}
        <span className="ml-auto text-xs text-stone-400">
          {filtrados.length} de {lotes.length} lotes
        </span>
      </div>

      {filtrados.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
          <FileText className="h-10 w-10 mx-auto mb-3 text-stone-300" />
          <p className="text-stone-400 text-sm">
            {hayFiltros
              ? "Ningún lote coincide con los filtros."
              : "No hay lotes en proceso de conteo."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  {["Lote", "OP / Referencia", "Color", "Programado", "Fecha conteo", "Total contado", "Validado", "Estado", ""].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide text-left"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((lote) => (
                  <tr
                    key={lote.id}
                    className="border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-stone-700">
                      {lote.descripcion ?? padLote(lote.numero_lote)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-stone-800">{lote.orden.referencia}</p>
                      <p className="text-xs text-stone-400 font-mono">{padOP(lote.orden.numero_op)}</p>
                    </td>
                    <td className="px-4 py-3 text-stone-600">{lote.color}</td>
                    <td className="px-4 py-3 font-mono text-stone-700">
                      {lote.cantidad_programada.toLocaleString("es-CO")}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-stone-600">
                      {lote.conteo?.fecha_conteo ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-stone-700">
                      {lote.conteo ? (
                        lote.conteo.total_contado.toLocaleString("es-CO")
                      ) : (
                        <span className="text-stone-400 italic text-xs">Sin conteo</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {lote.conteo?.validado ? (
                        <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800">
                          Validado
                        </span>
                      ) : (
                        <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          LOTE_ESTADO_COLOR[lote.estado] ?? "bg-stone-100 text-stone-700"
                        }`}
                      >
                        {LOTE_ESTADO_LABEL[lote.estado] ?? lote.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/conteo/${lote.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-stone-100 transition-colors text-stone-500"
                      >
                        Abrir ficha →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
