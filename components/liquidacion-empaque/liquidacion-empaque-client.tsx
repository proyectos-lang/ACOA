"use client"

import * as React from "react"
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Lock,
  Unlock,
  Users,
  Package,
  CircleDollarSign,
  FileSpreadsheet,
  FileDown,
  Printer,
} from "lucide-react"
import type { DiaEmpaquePersona } from "@/lib/db/liquidacion-empaque"
import type { PersonaRow } from "@/lib/db/persona"
import {
  cargarLiquidacionEmpaqueAction,
  cerrarDiaEmpaqueAction,
  reabrirDiaEmpaqueAction,
} from "@/app/(dashboard)/liquidacion-empaque/actions"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

function padOP(n: number) {
  return n ? `OP-${String(n).padStart(4, "0")}` : "—"
}
function cop(n: number) {
  return `$${Number(n).toLocaleString("es-CO")}`
}
function fechaLarga(f: string) {
  const [y, m, d] = f.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-CO", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

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

// Tarjeta de un día de una persona: totales, resumen por talla y detalle
function DiaCard({
  dia,
  onMsg,
  onRecargar,
}: {
  dia: DiaEmpaquePersona
  onMsg: (tipo: "ok" | "error", msg: string) => void
  onRecargar: () => void
}) {
  const [abierto, setAbierto] = React.useState(false)
  const [isPending, startTransition] = useTransition()
  const [observacion, setObservacion] = React.useState(dia.cierre?.observacion ?? "")

  const cerrado = dia.cierre != null
  // Si tras cerrar se registró más empaque, los totales ya no cuadran
  const desactualizado =
    cerrado &&
    (dia.cierre!.total_unidades !== dia.total_unidades ||
      dia.cierre!.total_imperfectos !== dia.total_imperfectos)

  function cerrar() {
    startTransition(async () => {
      const res = await cerrarDiaEmpaqueAction({
        persona_id: dia.persona_id,
        fecha: dia.fecha,
        total_unidades: dia.total_unidades,
        total_imperfectos: dia.total_imperfectos,
        total_valor: dia.total_valor,
        observacion: observacion.trim() || undefined,
      })
      if (res.error) onMsg("error", res.error)
      else {
        onMsg("ok", `Día cerrado para ${dia.persona_nombre}`)
        onRecargar()
      }
    })
  }

  function reabrir() {
    startTransition(async () => {
      const res = await reabrirDiaEmpaqueAction(dia.persona_id, dia.fecha)
      if (res.error) onMsg("error", res.error)
      else {
        onMsg("ok", "Día reabierto")
        onRecargar()
      }
    })
  }

  return (
    <Card className="overflow-hidden p-0">
      {/* Cabecera del día */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 cursor-pointer ${
          cerrado ? "bg-emerald-50/60" : "bg-white hover:bg-stone-50"
        }`}
        onClick={() => setAbierto((a) => !a)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-stone-400">
            {abierto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-stone-800 truncate">{dia.persona_nombre}</p>
            <p className="text-xs text-stone-500 capitalize">
              {fechaLarga(dia.fecha)}
              {dia.persona_documento && (
                <span className="text-stone-400"> · CC {dia.persona_documento}</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="text-right">
            <p className="text-[11px] text-stone-500">Empacado</p>
            <p className="font-mono font-bold text-teal-700">
              {dia.total_unidades.toLocaleString("es-CO")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-stone-500">Imperf.</p>
            <p className="font-mono font-bold text-red-700">
              {dia.total_imperfectos.toLocaleString("es-CO")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-stone-500">Valor</p>
            <p className="font-mono font-bold text-stone-800">{cop(dia.total_valor)}</p>
          </div>
          {cerrado ? (
            <Badge
              className={`border-0 ${
                desactualizado ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {desactualizado ? "Cerrado (desactualizado)" : "Cerrado"}
            </Badge>
          ) : (
            <Badge className="bg-stone-100 text-stone-600 border-0">Abierto</Badge>
          )}
        </div>
      </div>

      {abierto && (
        <div className="border-t border-stone-100 px-4 py-4 space-y-4 bg-stone-50/40">
          {/* Resumen por talla */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Resumen por talla
            </p>
            <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-100">
                    <th className="px-3 py-2 text-left text-xs text-stone-500 font-medium">Talla</th>
                    <th className="px-3 py-2 text-right text-xs text-stone-500 font-medium">
                      Empacado
                    </th>
                    <th className="px-3 py-2 text-right text-xs text-stone-500 font-medium">
                      Imperfectos
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dia.por_talla.map((t) => (
                    <tr key={t.talla} className="border-b border-stone-100 last:border-0">
                      <td className="px-3 py-2 font-medium text-stone-800">{t.talla}</td>
                      <td className="px-3 py-2 text-right font-mono text-teal-700">
                        {t.cantidad.toLocaleString("es-CO")}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-red-700">
                        {t.imperfectos.toLocaleString("es-CO")}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-stone-50">
                    <td className="px-3 py-2 text-xs font-semibold text-stone-700">Total</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-teal-700 text-xs">
                      {dia.total_unidades.toLocaleString("es-CO")}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-red-700 text-xs">
                      {dia.total_imperfectos.toLocaleString("es-CO")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Detalle por registro */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Detalle ({dia.detalle.length} registro{dia.detalle.length !== 1 ? "s" : ""})
            </p>
            <div className="rounded-xl border border-stone-200 bg-white overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-100">
                    <th className="px-3 py-2 text-left text-xs text-stone-500 font-medium">OP</th>
                    <th className="px-3 py-2 text-left text-xs text-stone-500 font-medium">Lote</th>
                    <th className="px-3 py-2 text-left text-xs text-stone-500 font-medium">Talla</th>
                    <th className="px-3 py-2 text-right text-xs text-stone-500 font-medium">Cant.</th>
                    <th className="px-3 py-2 text-right text-xs text-stone-500 font-medium">
                      Imperf.
                    </th>
                    <th className="px-3 py-2 text-right text-xs text-stone-500 font-medium">
                      Precio/ud
                    </th>
                    <th className="px-3 py-2 text-right text-xs text-stone-500 font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {dia.detalle.map((d) => (
                    <tr key={d.registro_id} className="border-b border-stone-100 last:border-0">
                      <td className="px-3 py-2 font-mono text-xs text-stone-600">
                        {padOP(d.numero_op)}
                        <span className="block text-[11px] text-stone-400">{d.referencia}</span>
                      </td>
                      <td className="px-3 py-2 text-stone-700">{d.lote_nombre}</td>
                      <td className="px-3 py-2 font-medium text-stone-800">{d.talla}</td>
                      <td className="px-3 py-2 text-right font-mono text-stone-700">
                        {d.cantidad.toLocaleString("es-CO")}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-red-700">
                        {d.imperfectos.toLocaleString("es-CO")}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-stone-500">
                        {cop(d.precio_unidad)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-stone-800">
                        {cop(d.valor_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cierre del día */}
          <div className="flex flex-wrap items-end gap-2" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-0.5 flex-1 min-w-48">
              <label className="text-[11px] font-medium text-stone-500">
                Observación del cierre
              </label>
              <input
                type="text"
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                disabled={cerrado && !desactualizado}
                className={`${filtroCls} w-full text-xs py-1.5 disabled:bg-stone-100`}
                placeholder="Novedades del día (opcional)"
              />
            </div>

            {!cerrado || desactualizado ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    disabled={isPending}
                    className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: "#065f46" }}
                  >
                    <Lock className="h-3.5 w-3.5" />
                    {desactualizado ? "Actualizar cierre" : "Cerrar día"}
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-md rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      ¿{desactualizado ? "Actualizar el cierre" : "Cerrar el día"} de{" "}
                      {dia.persona_nombre}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Se dejará registrado el cierre del{" "}
                      <strong className="capitalize">{fechaLarga(dia.fecha)}</strong> con{" "}
                      <strong>{dia.total_unidades.toLocaleString("es-CO")} unidades</strong>
                      {dia.total_imperfectos > 0 && (
                        <>
                          {" "}
                          y <strong>{dia.total_imperfectos.toLocaleString("es-CO")} imperfectos</strong>
                        </>
                      )}
                      , por un valor de <strong>{cop(dia.total_valor)}</strong>. Podrás reabrirlo si
                      necesitas corregir algo.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={cerrar}
                      className="rounded-xl"
                      style={{ backgroundColor: "#065f46" }}
                    >
                      {desactualizado ? "Actualizar" : "Cerrar día"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <button
                type="button"
                onClick={reabrir}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-xl border border-stone-200 px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-50"
              >
                <Unlock className="h-3.5 w-3.5" /> Reabrir día
              </button>
            )}

            {cerrado && (
              <span className="text-[11px] text-stone-400">
                Cerrado el {dia.cierre!.cerrado_en.slice(0, 10)}
                {desactualizado && (
                  <span className="block text-amber-600">
                    Hay registros nuevos después del cierre
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

export function LiquidacionEmpaqueClient({
  diasIniciales,
  empacadoras,
  desdeInicial,
  hastaInicial,
}: {
  diasIniciales: DiaEmpaquePersona[]
  empacadoras: PersonaRow[]
  desdeInicial: string
  hastaInicial: string
}) {
  const router = useRouter()
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)
  const [dias, setDias] = React.useState(diasIniciales)
  const [cargando, startCarga] = useTransition()

  const [desde, setDesde] = React.useState(desdeInicial)
  const [hasta, setHasta] = React.useState(hastaInicial)
  const [personaId, setPersonaId] = React.useState("")
  const [fEstado, setFEstado] = React.useState("")

  function showToast(tipo: "ok" | "error", msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const recargar = React.useCallback(() => {
    startCarga(async () => {
      const res = await cargarLiquidacionEmpaqueAction({
        desde,
        hasta,
        personaId: personaId ? parseInt(personaId, 10) : null,
      })
      if (res.error) showToast("error", res.error)
      else setDias(res.dias ?? [])
      router.refresh()
    })
  }, [desde, hasta, personaId, router])

  const visibles = dias.filter((d) => {
    if (fEstado === "abierto" && d.cierre) return false
    if (fEstado === "cerrado" && !d.cierre) return false
    return true
  })

  // Totales del periodo mostrado
  const totalUnidades = visibles.reduce((s, d) => s + d.total_unidades, 0)
  const totalImperfectos = visibles.reduce((s, d) => s + d.total_imperfectos, 0)
  const totalValor = visibles.reduce((s, d) => s + d.total_valor, 0)
  const personasUnicas = new Set(visibles.map((d) => d.persona_id)).size
  const sinCerrar = visibles.filter((d) => !d.cierre).length

  // Resumen por persona del periodo
  const porPersona = (() => {
    const map = new Map<
      number,
      { nombre: string; dias: number; unidades: number; imperfectos: number; valor: number }
    >()
    for (const d of visibles) {
      const r = map.get(d.persona_id) ?? {
        nombre: d.persona_nombre,
        dias: 0,
        unidades: 0,
        imperfectos: 0,
        valor: 0,
      }
      r.dias += 1
      r.unidades += d.total_unidades
      r.imperfectos += d.total_imperfectos
      r.valor += d.total_valor
      map.set(d.persona_id, r)
    }
    return [...map.values()].sort((a, b) => b.valor - a.valor)
  })()

  const esc = (t: unknown) =>
    String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  function exportarExcel() {
    const filas = visibles
      .flatMap((d) =>
        d.detalle.map(
          (x) =>
            `<tr><td>${esc(d.fecha)}</td><td>${esc(d.persona_nombre)}</td><td>${esc(
              d.persona_documento
            )}</td><td>${padOP(x.numero_op)}</td><td>${esc(x.lote_nombre)}</td><td>${esc(
              x.talla
            )}</td><td>${x.cantidad}</td><td>${x.imperfectos}</td><td>${x.precio_unidad}</td><td>${
              x.valor_total
            }</td><td>${d.cierre ? "Cerrado" : "Abierto"}</td></tr>`
        )
      )
      .join("")
    const tabla = `<html><head><meta charset="utf-8"></head><body><table border="1"><tr><th>Fecha</th><th>Persona</th><th>Documento</th><th>OP</th><th>Lote</th><th>Talla</th><th>Empacado</th><th>Imperfectos</th><th>Precio/ud</th><th>Valor</th><th>Estado</th></tr>${filas}</table></body></html>`
    const blob = new Blob(["﻿" + tabla], { type: "application/vnd.ms-excel" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `liquidacion-empaque-${desde}_a_${hasta}.xls`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function imprimirPdf() {
    const secciones = visibles
      .map(
        (d) => `
      <div class="dia">
        <div class="cab">
          <span><strong>${esc(d.persona_nombre)}</strong> ${
            d.persona_documento ? `· CC ${esc(d.persona_documento)}` : ""
          }</span>
          <span>${esc(d.fecha)} · ${d.cierre ? "CERRADO" : "ABIERTO"}</span>
        </div>
        <table>
          <thead><tr><th class="izq">Talla</th><th>Empacado</th><th>Imperfectos</th></tr></thead>
          <tbody>
            ${d.por_talla
              .map(
                (t) =>
                  `<tr><td class="izq">${esc(t.talla)}</td><td>${t.cantidad}</td><td>${t.imperfectos}</td></tr>`
              )
              .join("")}
            <tr class="tot"><td class="izq">Total</td><td>${d.total_unidades}</td><td>${
              d.total_imperfectos
            }</td></tr>
          </tbody>
        </table>
        <p class="valor">Valor del día: <strong>${cop(d.total_valor)}</strong>${
          d.cierre?.observacion ? ` · Obs: ${esc(d.cierre.observacion)}` : ""
        }</p>
      </div>`
      )
      .join("")

    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>Liquidación empaque ${esc(desde)} a ${esc(hasta)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: letter; margin: 10mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #111; padding: 14px; }
  .titulo { background: #f2e14c; border: 1.5px solid #111; font-weight: bold; font-size: 12px;
            padding: 5px 8px; display: flex; justify-content: space-between; margin-bottom: 8px; }
  .dia { border: 1px solid #111; margin-bottom: 8px; page-break-inside: avoid; }
  .cab { background: #eee; padding: 3px 6px; display: flex; justify-content: space-between;
         border-bottom: 1px solid #111; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border-bottom: 1px solid #ddd; padding: 2px 6px; font-size: 9px; text-align: center; }
  th { background: #f7f7f7; text-transform: uppercase; font-size: 8px; }
  .izq { text-align: left; }
  tr.tot td { font-weight: bold; background: #dcefe4; }
  .valor { padding: 3px 6px; font-size: 9px; }
  .resumen { border: 1.5px solid #111; margin-top: 10px; }
</style></head><body>
  <div class="titulo"><span>LIQUIDACIÓN DE EMPAQUE</span><span>${esc(desde)} a ${esc(hasta)}</span></div>
  ${secciones}
  <div class="resumen">
    <div class="cab"><span><strong>RESUMEN DEL PERIODO</strong></span><span>${personasUnicas} persona(s)</span></div>
    <table>
      <thead><tr><th class="izq">Persona</th><th>Días</th><th>Empacado</th><th>Imperfectos</th><th>Valor</th></tr></thead>
      <tbody>
        ${porPersona
          .map(
            (r) =>
              `<tr><td class="izq">${esc(r.nombre)}</td><td>${r.dias}</td><td>${r.unidades}</td><td>${
                r.imperfectos
              }</td><td>${cop(r.valor)}</td></tr>`
          )
          .join("")}
        <tr class="tot"><td class="izq">Total</td><td>${visibles.length}</td><td>${totalUnidades}</td><td>${totalImperfectos}</td><td>${cop(
          totalValor
        )}</td></tr>
      </tbody>
    </table>
  </div>
  <script>window.addEventListener("load",function(){setTimeout(function(){window.print()},250)})<\/script>
</body></html>`)
    w.document.close()
    w.focus()
  }

  const cardCls = "p-5 flex items-center gap-4"

  return (
    <div className="space-y-4">
      {toast && <Toast tipo={toast.tipo} msg={toast.msg} />}

      {/* ── Totales del periodo ─────────────────────────────── */}
      <Card className="p-0 overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-stone-200">
          <div className={cardCls}>
            <div className="rounded-xl bg-blue-50 p-3">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-stone-500">Personas</p>
              <p className="text-2xl font-bold text-stone-900">{personasUnicas}</p>
              <p className="text-[11px] text-stone-400">{visibles.length} días de trabajo</p>
            </div>
          </div>
          <div className={cardCls}>
            <div className="rounded-xl bg-teal-50 p-3">
              <Package className="h-6 w-6 text-teal-600" />
            </div>
            <div>
              <p className="text-xs text-stone-500">Unidades empacadas</p>
              <p className="text-2xl font-bold text-teal-700 font-mono">
                {totalUnidades.toLocaleString("es-CO")}
              </p>
              <p className="text-[11px] text-red-600">
                {totalImperfectos.toLocaleString("es-CO")} imperfectos
              </p>
            </div>
          </div>
          <div className={cardCls}>
            <div className="rounded-xl bg-stone-100 p-3">
              <CircleDollarSign className="h-6 w-6 text-stone-600" />
            </div>
            <div>
              <p className="text-xs text-stone-500">Valor del periodo</p>
              <p className="text-2xl font-bold text-stone-900 font-mono">{cop(totalValor)}</p>
            </div>
          </div>
          <div className={cardCls}>
            <div className={`rounded-xl p-3 ${sinCerrar > 0 ? "bg-amber-50" : "bg-emerald-50"}`}>
              <Lock
                className={`h-6 w-6 ${sinCerrar > 0 ? "text-amber-600" : "text-emerald-600"}`}
              />
            </div>
            <div>
              <p className="text-xs text-stone-500">Días sin cerrar</p>
              <p
                className={`text-2xl font-bold font-mono ${
                  sinCerrar > 0 ? "text-amber-700" : "text-emerald-700"
                }`}
              >
                {sinCerrar}
              </p>
              <p className="text-[11px] text-stone-400">
                {visibles.length - sinCerrar} cerrados
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Filtros ─────────────────────────────────────────── */}
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
              {empacadoras.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-0.5">
            <label className="text-[11px] font-medium text-stone-500">Estado</label>
            <select
              value={fEstado}
              onChange={(e) => setFEstado(e.target.value)}
              className={`${filtroCls} w-full`}
            >
              <option value="">Todos</option>
              <option value="abierto">Sin cerrar</option>
              <option value="cerrado">Cerrados</option>
            </select>
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
              onClick={imprimirPdf}
              className="flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50"
              title="Imprimir la liquidación del periodo"
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

      {/* ── Días por persona ────────────────────────────────── */}
      {visibles.length === 0 ? (
        <Card className="p-12 text-center">
          <FileDown className="h-10 w-10 mx-auto mb-3 text-stone-300" />
          <p className="text-stone-400 text-sm">
            No hay empaque registrado en este periodo con los filtros actuales.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibles.map((d) => (
            <DiaCard
              key={`${d.persona_id}_${d.fecha}`}
              dia={d}
              onMsg={showToast}
              onRecargar={recargar}
            />
          ))}
        </div>
      )}

      {/* ── Resumen por persona ─────────────────────────────── */}
      {porPersona.length > 0 && (
        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-stone-700 border-b border-stone-100 pb-2">
            Resumen del periodo por persona
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left py-2 text-xs text-stone-500 font-medium">Persona</th>
                  <th className="text-right py-2 text-xs text-stone-500 font-medium">Días</th>
                  <th className="text-right py-2 text-xs text-stone-500 font-medium">Empacado</th>
                  <th className="text-right py-2 text-xs text-stone-500 font-medium">Imperfectos</th>
                  <th className="text-right py-2 text-xs text-stone-500 font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {porPersona.map((r) => (
                  <tr key={r.nombre} className="border-b border-stone-100 last:border-0">
                    <td className="py-2 font-medium text-stone-800">{r.nombre}</td>
                    <td className="py-2 text-right font-mono text-stone-600">{r.dias}</td>
                    <td className="py-2 text-right font-mono text-teal-700">
                      {r.unidades.toLocaleString("es-CO")}
                    </td>
                    <td className="py-2 text-right font-mono text-red-700">
                      {r.imperfectos.toLocaleString("es-CO")}
                    </td>
                    <td className="py-2 text-right font-mono font-semibold text-stone-800">
                      {cop(r.valor)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-stone-50">
                  <td className="py-2 text-xs font-semibold text-stone-700">Total</td>
                  <td className="py-2 text-right font-mono text-xs font-semibold text-stone-700">
                    {visibles.length}
                  </td>
                  <td className="py-2 text-right font-mono text-xs font-semibold text-teal-700">
                    {totalUnidades.toLocaleString("es-CO")}
                  </td>
                  <td className="py-2 text-right font-mono text-xs font-semibold text-red-700">
                    {totalImperfectos.toLocaleString("es-CO")}
                  </td>
                  <td className="py-2 text-right font-mono text-xs font-semibold text-stone-800">
                    {cop(totalValor)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
