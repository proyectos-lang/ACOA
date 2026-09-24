"use client"

import * as React from "react"
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  AlertTriangle,
  Undo2,
  Search,
  ArrowLeft,
} from "lucide-react"
import type { LoteEnProceso, ResumenDevolucion } from "@/lib/db/devolver-proceso"
import { PROCESO_LABEL } from "@/lib/db/devolver-proceso"
import { LOTE_ESTADO_COLOR } from "@/lib/db/lote"
import {
  cargarLotesEnProcesoAction,
  previsualizarDevolucionAction,
  devolverLoteAction,
} from "@/app/(dashboard)/historial/devolver-actions"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

function padOP(n: number) {
  return `OP-${String(n).padStart(4, "0")}`
}
function miles(n: number) {
  return n.toLocaleString("es-CO")
}

const filtroCls =
  "rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"

const ESTADOS = ["estampacion", "confeccion", "conteo", "empaque", "finalizado"]

export function DevolverProcesoClient() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)

  const [lotes, setLotes] = React.useState<LoteEnProceso[]>([])
  const [cargado, setCargado] = React.useState(false)
  const [fEstado, setFEstado] = React.useState("")
  const [fTexto, setFTexto] = React.useState("")

  // Lote que se va a devolver, con lo que se borraria
  const [resumen, setResumen] = React.useState<ResumenDevolucion | null>(null)

  const aviso = (tipo: "ok" | "error", msg: string) => {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 7000)
  }

  const cargar = React.useCallback((estado: string, texto: string) => {
    startTransition(async () => {
      const r = await cargarLotesEnProcesoAction({ estado: estado || null, texto })
      if (r.error) return aviso("error", r.error)
      setLotes(r.lotes ?? [])
      setCargado(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    if (!cargado) cargar("", "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargado])

  // Se revisa que se va a borrar antes de preguntar
  function preguntar(lote: LoteEnProceso) {
    startTransition(async () => {
      const r = await previsualizarDevolucionAction(lote.id)
      if (r.error) return aviso("error", r.error)
      setResumen(r.resumen ?? null)
    })
  }

  function devolver() {
    if (!resumen) return
    const id = resumen.lote_id
    startTransition(async () => {
      const r = await devolverLoteAction(id)
      setResumen(null)
      if (r.error) return aviso("error", r.error)
      aviso(
        "ok",
        `Lote devuelto a ${PROCESO_LABEL[r.destino ?? ""] ?? r.destino}. Los datos del proceso anterior se borraron.`
      )
      cargar(fEstado, fTexto)
      router.refresh()
    })
  }

  const visibles = lotes.filter((l) => l.puede_devolver)

  return (
    <div className="space-y-4">
      {toast && (
        <div
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
            toast.tipo === "ok"
              ? "border border-green-200 bg-green-50 text-green-800"
              : "border border-red-200 bg-red-50 text-red-800"
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

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] font-medium text-stone-500">Proceso</label>
            <select
              className={filtroCls}
              value={fEstado}
              onChange={(e) => {
                setFEstado(e.target.value)
                cargar(e.target.value, fTexto)
              }}
            >
              <option value="">Todos</option>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {PROCESO_LABEL[e] ?? e}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[220px] flex-1">
            <label className="block text-[11px] font-medium text-stone-500">
              OP, referencia o lote
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
              <input
                className={`${filtroCls} w-full pl-8`}
                value={fTexto}
                onChange={(e) => setFTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") cargar(fEstado, fTexto)
                }}
                placeholder="Buscar y pulsar Enter"
              />
            </div>
          </div>
          <button
            onClick={() => cargar(fEstado, fTexto)}
            disabled={isPending}
            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600 hover:bg-stone-50 disabled:opacity-50"
          >
            Actualizar
          </button>
          <span className="ml-auto text-xs text-stone-400">
            {visibles.length} lote(s) que se pueden devolver
          </span>
        </div>
        <p className="mt-3 text-xs text-stone-400">
          Devolver un lote borra lo que se registró en su proceso actual y lo deja como estaba
          antes de que lo enviaran.
        </p>
      </Card>

      {visibles.length === 0 ? (
        <Card className="p-12 text-center">
          <Undo2 className="mx-auto mb-3 h-10 w-10 text-stone-300" />
          <p className="text-sm text-stone-400">
            {cargado
              ? "No hay lotes que se puedan devolver con esos filtros."
              : "Cargando..."}
          </p>
        </Card>
      ) : (
        <Card className="p-0">
          <div className="max-h-[620px] overflow-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="sticky top-0 bg-stone-50">
                <tr className="border-b border-stone-200">
                  {["Lote", "OP / Referencia", "Cantidad", "Proceso actual", "Volveria a", ""].map(
                    (h, i) => (
                      <th
                        key={`${h}_${i}`}
                        className="px-3 py-2 text-left text-xs font-semibold uppercase text-stone-500"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {visibles.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-stone-100 last:border-0 hover:bg-stone-50"
                  >
                    <td className="px-3 py-2 font-mono font-semibold text-stone-700">
                      {l.descripcion ?? `LOTE-${String(l.numero_lote).padStart(4, "0")}`}
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-stone-800">{l.referencia}</p>
                      <p className="font-mono text-xs text-stone-400">{padOP(l.numero_op)}</p>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-stone-700">
                      {miles(l.cantidad_programada)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        className={
                          LOTE_ESTADO_COLOR[l.estado] ?? "bg-stone-100 text-stone-700"
                        }
                      >
                        {PROCESO_LABEL[l.estado] ?? l.estado}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1 text-xs text-stone-600">
                        <ArrowLeft className="h-3 w-3 text-stone-400" />
                        {PROCESO_LABEL[l.estado_destino ?? ""] ?? l.estado_destino}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => preguntar(l)}
                        disabled={isPending}
                        className="flex items-center gap-1 rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                      >
                        <Undo2 className="h-3 w-3" /> Devolver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Confirmacion: se muestra que se va a borrar */}
      <AlertDialog open={resumen != null} onOpenChange={(o) => !o && setResumen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Devolver {resumen?.descripcion ?? `lote ${resumen?.numero_lote}`} a{" "}
              {PROCESO_LABEL[resumen?.estado_destino ?? ""] ?? resumen?.estado_destino}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  {padOP(resumen?.numero_op ?? 0)} &middot; {resumen?.referencia}. El lote sale
                  de {PROCESO_LABEL[resumen?.estado_actual ?? ""] ?? resumen?.estado_actual} y
                  queda como estaba antes de que lo enviaran.
                </p>

                {resumen && resumen.registros.length > 0 ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="mb-1 text-xs font-semibold text-red-800">
                      Se borrará lo siguiente:
                    </p>
                    <ul className="space-y-0.5 text-xs text-red-700">
                      {resumen.registros.map((r) => (
                        <li key={r.que}>
                          {r.que}: <strong>{miles(r.cantidad)}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-stone-500">
                    Este lote no tiene datos registrados en su proceso actual.
                  </p>
                )}

                {resumen && resumen.advertencias.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <ul className="space-y-0.5 text-xs text-amber-800">
                      {resumen.advertencias.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-xs text-stone-500">Esta acción no se puede deshacer.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={devolver}>Devolver el lote</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
