"use client"

import * as React from "react"
import Link from "next/link"
import { FileText, Ruler, AlertTriangle, ListChecks, BarChart3 } from "lucide-react"
import type { DiaCorte } from "@/lib/db/reporte-corte"
import { ReporteCortesClient } from "@/components/corte/reporte-cortes-client"

function padOP(n: number) {
  return `OP-${String(n).padStart(4, "0")}`
}

// Una OP en la bandeja de corte
type OpEnCorte = {
  id: number
  numero_op: number
  referencia: string
  descripcion: string | null
  fecha_programacion: string | null
  corte: {
    pendiente: boolean
    pendiente_motivo: string | null
  } | null
}

// Bandeja de corte y reporte de cortes entregados
export function CorteTabs({
  ops,
  diasReporte,
  desdeInicial,
  hastaInicial,
}: {
  ops: OpEnCorte[]
  diasReporte: DiaCorte[]
  desdeInicial: string
  hastaInicial: string
}) {
  const [vista, setVista] = React.useState<"bandeja" | "reporte">("bandeja")

  return (
    <div className="space-y-4">
      <div className="flex rounded-xl border border-stone-200 overflow-hidden w-fit">
        <button
          type="button"
          onClick={() => setVista("bandeja")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold ${
            vista === "bandeja" ? "bg-[#344966] text-white" : "bg-white text-stone-600"
          }`}
        >
          <ListChecks className="h-4 w-4" /> Órdenes en corte
        </button>
        <button
          type="button"
          onClick={() => setVista("reporte")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold ${
            vista === "reporte" ? "bg-[#344966] text-white" : "bg-white text-stone-600"
          }`}
        >
          <BarChart3 className="h-4 w-4" /> Reporte de cortes
        </button>
      </div>

      {vista === "bandeja" ? (
        <div className="space-y-4">
      {ops.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
          <FileText className="h-10 w-10 mx-auto mb-3 text-stone-300" />
          <p className="text-stone-400 text-sm">No hay órdenes en estado Corte.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  {["OP", "Referencia", "Fecha prog.", "Ficha de corte", ""].map(
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
                {ops.map((op) => (
                  <tr
                    key={op.id}
                    className="border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-stone-700">
                      {padOP(op.numero_op)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-stone-800">{op.referencia}</p>
                      {op.descripcion && (
                        <p className="text-xs text-stone-400 truncate max-w-xs">{op.descripcion}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-stone-600">
                      {op.fecha_programacion ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {op.corte ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium">
                            <Ruler className="h-3 w-3" /> Creada
                          </span>
                        ) : (
                          <span className="text-xs text-stone-400">Pendiente</span>
                        )}
                        {op.corte?.pendiente && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold"
                            title={op.corte.pendiente_motivo ?? "Faltan materiales"}
                          >
                            <AlertTriangle className="h-3 w-3" /> Faltan materiales
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/corte/${op.id}`}
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
      ) : (
        <ReporteCortesClient
          diasIniciales={diasReporte}
          desdeInicial={desdeInicial}
          hastaInicial={hastaInicial}
        />
      )}
    </div>
  )
}
