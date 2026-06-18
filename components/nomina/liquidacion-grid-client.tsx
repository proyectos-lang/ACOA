"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { FileText, Loader2, CheckCircle2, AlertTriangle, Lock } from "lucide-react"
import type { PeriodoNominaRow } from "@/lib/db/periodo-nomina"
import type { LiquidacionConPersona, LiquidacionDetalleRow } from "@/lib/db/liquidacion"
import {
  liquidarPeriodoAction,
  cerrarPeriodoAction,
} from "@/app/(dashboard)/nomina/actions"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Props {
  periodo: PeriodoNominaRow
  liquidaciones: LiquidacionConPersona[]
  detallesMap: Record<number, LiquidacionDetalleRow[]>
}

function cop(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

const CONCEPTO_LABEL: Record<string, string> = {
  dia_salario:          "Días de salario",
  descuento_falta:      "Descuento falta injustificada",
  descuento_domingo:    "Descuento dominical",
  hora_extra_diurna:    "Horas extra diurnas",
  turno_ordinario:      "Turno ordinario",
  produccion_empaque:   "Producción (Empaque)",
}

export function LiquidacionGridClient({ periodo, liquidaciones, detallesMap }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isCerrando, startCerrando] = useTransition()
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)
  const [conceptosLiq, setConceptosLiq] = React.useState<LiquidacionConPersona | null>(null)

  function showToast(tipo: "ok" | "error", msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 3500)
  }

  function handleLiquidar() {
    startTransition(async () => {
      const res = await liquidarPeriodoAction(periodo.id)
      if (res.error) {
        showToast("error", res.error)
      } else {
        showToast("ok", `${res.liquidados} persona(s) liquidada(s)`)
        router.refresh()
      }
    })
  }

  function handleCerrar() {
    startCerrando(async () => {
      const res = await cerrarPeriodoAction(periodo.id)
      if (res.error) {
        showToast("error", res.error)
      } else {
        showToast("ok", "Período cerrado")
        router.refresh()
      }
    })
  }

  const totalGeneral = liquidaciones.reduce(
    (s, l) => s + Number(l.total_devengado),
    0
  )

  return (
    <div className="space-y-4">
      {/* Acciones del período */}
      <div className="flex flex-wrap items-center gap-3">
        {periodo.estado === "abierto" && (
          <>
            <button
              onClick={handleLiquidar}
              disabled={isPending}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60 transition-opacity"
              style={{ backgroundColor: "#344966" }}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {liquidaciones.length === 0 ? "Liquidar período" : "Re-liquidar período"}
            </button>
            {liquidaciones.length > 0 && (
              <button
                onClick={handleCerrar}
                disabled={isCerrando}
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-60 transition-colors"
                style={{ color: "#344966" }}
              >
                {isCerrando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Cerrar período
              </button>
            )}
          </>
        )}
        <span className="ml-auto text-sm text-stone-500">
          Total devengado:{" "}
          <span className="font-semibold text-stone-800">{cop(totalGeneral)}</span>
        </span>
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

      {/* Grid de liquidaciones */}
      {liquidaciones.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
          <p className="text-stone-400 text-sm">
            No hay liquidaciones. Haz clic en "Liquidar período" para calcular.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                    Persona
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                    Tipo pago
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                    Valor día
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                    Total devengado
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                    Conceptos
                  </th>
                </tr>
              </thead>
              <tbody>
                {liquidaciones.map((liq) => (
                  <tr
                    key={liq.id}
                    className="border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-stone-800">{liq.persona?.nombre ?? "—"}</p>
                      <p className="text-xs text-stone-400">{liq.persona?.documento ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-stone-100 text-stone-600">
                        {liq.tipo_pago}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-stone-600">
                      {liq.valor_dia != null ? cop(Number(liq.valor_dia)) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-semibold font-mono ${
                          Number(liq.total_devengado) < 0
                            ? "text-red-600"
                            : "text-stone-800"
                        }`}
                      >
                        {cop(Number(liq.total_devengado))}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setConceptosLiq(liq)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-stone-100 transition-colors text-stone-500"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-stone-200 bg-stone-50">
                  <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-stone-700">
                    Total general
                  </td>
                  <td className="px-4 py-3 text-right font-bold font-mono text-stone-900">
                    {cop(totalGeneral)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Dialog conceptos */}
      <Dialog open={conceptosLiq !== null} onOpenChange={(o) => !o && setConceptosLiq(null)}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              Conceptos — {conceptosLiq?.persona?.nombre ?? ""}
            </DialogTitle>
          </DialogHeader>
          {conceptosLiq && (
            <div className="space-y-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100">
                    <th className="text-left py-2 text-xs font-semibold text-stone-500 uppercase">
                      Concepto
                    </th>
                    <th className="text-center py-2 text-xs font-semibold text-stone-500 uppercase">
                      Cant.
                    </th>
                    <th className="text-right py-2 text-xs font-semibold text-stone-500 uppercase">
                      V. unitario
                    </th>
                    <th className="text-right py-2 text-xs font-semibold text-stone-500 uppercase">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(detallesMap[conceptosLiq.id] ?? []).map((d) => (
                    <tr key={d.id} className="border-b border-stone-100 last:border-0">
                      <td className="py-2 pr-2">
                        <p className="font-medium text-stone-800">
                          {CONCEPTO_LABEL[d.concepto] ?? d.concepto}
                        </p>
                        {d.descripcion && (
                          <p className="text-xs text-stone-400">{d.descripcion}</p>
                        )}
                      </td>
                      <td className="py-2 text-center font-mono text-xs text-stone-600">
                        {d.cantidad}
                      </td>
                      <td className="py-2 text-right font-mono text-xs text-stone-600">
                        {cop(Number(d.valor_unitario))}
                      </td>
                      <td
                        className={`py-2 text-right font-mono font-medium ${
                          Number(d.valor_total) < 0 ? "text-red-600" : "text-stone-800"
                        }`}
                      >
                        {cop(Number(d.valor_total))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-stone-200">
                    <td colSpan={3} className="py-2 font-semibold text-stone-700">
                      Total devengado
                    </td>
                    <td className="py-2 text-right font-bold font-mono text-stone-900">
                      {cop(Number(conceptosLiq.total_devengado))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
