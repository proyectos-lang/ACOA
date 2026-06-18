"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Plus, Eye, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react"
import type { PeriodoNominaRow } from "@/lib/db/periodo-nomina"
import { generarQuincenasAction } from "@/app/(dashboard)/nomina/actions"

const MESES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

function cop(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

interface Props {
  periodos: PeriodoNominaRow[]
}

export function PeriodosClient({ periodos: periodosInicial }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const now = new Date()
  const [anio, setAnio] = React.useState(now.getFullYear())
  const [mes, setMes] = React.useState(now.getMonth() + 1)
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)

  function showToast(tipo: "ok" | "error", msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 3500)
  }

  function handleGenerar() {
    startTransition(async () => {
      const res = await generarQuincenasAction(anio, mes)
      if (res.error) {
        showToast("error", res.error)
      } else {
        const n = res.creados ?? 0
        showToast("ok", n === 0 ? "Las quincenas ya existen" : `${n} quincena(s) creada(s)`)
        router.refresh()
      }
    })
  }

  const anios = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)

  return (
    <div className="space-y-4">
      {/* Generador */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4">
        <span className="text-sm font-medium text-stone-600">Generar quincenas para:</span>
        <select
          value={mes}
          onChange={(e) => setMes(Number(e.target.value))}
          className="rounded-xl border border-stone-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
        >
          {MESES.slice(1).map((m, i) => (
            <option key={i + 1} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={anio}
          onChange={(e) => setAnio(Number(e.target.value))}
          className="rounded-xl border border-stone-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
        >
          {anios.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <button
          onClick={handleGenerar}
          disabled={isPending}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60 transition-opacity"
          style={{ backgroundColor: "#344966" }}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Generar quincenas
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
            toast.tipo === "ok"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {toast.tipo === "ok" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          {toast.msg}
        </div>
      )}

      {/* Tabla */}
      {periodosInicial.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
          <p className="text-stone-400 text-sm">
            No hay períodos. Usa el generador para crear las quincenas del mes.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                    Período
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                    Quincena
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                    Fecha inicio
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                    Fecha fin
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                    Estado
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {periodosInicial.map((p) => (
                  <tr key={p.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-stone-800">
                      {MESES[p.mes]} {p.anio}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-stone-100 text-stone-600">
                        Q{p.quincena}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-xs text-stone-600">
                      {p.fecha_inicio}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-xs text-stone-600">
                      {p.fecha_fin}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.estado === "liquidado" ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          Liquidado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Abierto
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <a
                        href={`/nomina/${p.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-stone-100 transition-colors text-stone-600"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Ver detalle
                      </a>
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
