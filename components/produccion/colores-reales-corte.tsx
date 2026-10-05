"use client"

import * as React from "react"
import type { ColorRealLote } from "@/lib/db/corte-capas"

// Lo que corte registro realmente para un lote, color por color.
//
// Los procesos siguientes solo recibian cantidad_programada (un total), asi
// que no veian el detalle: si el cortador subia un color y bajaba otro, el
// total quedaba igual y el lote llegaba como si nada hubiera cambiado. Un
// color que se dejo de cortar se seguia mostrando como si existiera.
export function ColoresRealesCorte({ colores }: { colores: ColorRealLote[] }) {
  if (colores.length === 0) return null

  const cambiados = colores.filter((c) => c.cambio).length
  const totalProg = colores.reduce((s, c) => s + c.capas_programadas, 0)
  const totalReal = colores.reduce((s, c) => s + c.capas_reales, 0)
  const totalUds = colores.reduce((s, c) => s + c.unidades, 0)

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-2">
        <h2 className="text-sm font-semibold text-stone-700">
          Colores y cantidades reales de corte
        </h2>
        {cambiados > 0 && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
            {cambiados} color(es) cambiaron frente a lo programado
          </span>
        )}
      </div>

      <p className="text-xs text-stone-400">
        Es lo que el cortador registró en la ficha de corte. Las filas resaltadas no coinciden
        con la programación inicial; las que quedaron en cero no se cortaron.
      </p>

      <div className="overflow-x-auto rounded-xl border border-stone-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50">
              <th className="px-3 py-2 text-left font-semibold text-stone-500">Color</th>
              <th className="px-3 py-2 text-center font-semibold text-stone-500">
                Capas programadas
              </th>
              <th className="px-3 py-2 text-center font-semibold text-stone-500">Capas reales</th>
              <th className="px-3 py-2 text-center font-semibold text-stone-500">Unidades</th>
              <th className="px-3 py-2 text-left font-semibold text-stone-500">
                Motivo del cambio
              </th>
            </tr>
          </thead>
          <tbody>
            {colores.map((c, i) => (
              <tr
                key={`${c.color}-${i}`}
                className={`border-b border-stone-100 last:border-0 ${
                  c.capas_reales === 0 ? "bg-red-50/60" : c.cambio ? "bg-amber-50/60" : ""
                }`}
              >
                <td className="px-3 py-2 font-medium text-stone-800">
                  {c.color}
                  {c.capas_reales === 0 && (
                    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                      no se cortó
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-center font-mono text-stone-500">
                  {c.capas_programadas}
                </td>
                <td
                  className={`px-3 py-2 text-center font-mono font-bold ${
                    c.cambio ? "text-amber-700" : "text-stone-700"
                  }`}
                >
                  {c.capas_reales}
                </td>
                <td className="px-3 py-2 text-center font-mono text-stone-700">
                  {c.unidades.toLocaleString("es-CO")}
                </td>
                <td className="px-3 py-2 text-stone-500">{c.comentario ?? "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-stone-200 bg-stone-50">
              <td className="px-3 py-2 font-semibold text-stone-600">Total</td>
              <td className="px-3 py-2 text-center font-mono text-stone-500">{totalProg}</td>
              <td
                className="px-3 py-2 text-center font-mono font-bold"
                style={{ color: "#344966" }}
              >
                {totalReal}
              </td>
              <td
                className="px-3 py-2 text-center font-mono font-bold"
                style={{ color: "#344966" }}
              >
                {totalUds.toLocaleString("es-CO")}
              </td>
              <td className="px-3 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
