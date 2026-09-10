"use client"

import * as React from "react"
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Users,
  Wallet,
  Building2,
  CalendarDays,
  Lock,
  Unlock,
  Save,
  FileSpreadsheet,
  Printer,
  Settings2,
  Package,
} from "lucide-react"
import type { NominaPersona, ConfigNominaGeneral, DiaNomina } from "@/lib/db/nomina-diaria"
import type { PersonaRow } from "@/lib/db/persona"
import {
  cargarNominaDiariaAction,
  guardarConfigNominaAction,
  cerrarDiaNominaAction,
  reabrirDiaNominaAction,
} from "@/app/(dashboard)/nomina/diaria-actions"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

function cop(n: number) {
  return `$${Math.round(Number(n)).toLocaleString("es-CO")}`
}
const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

const CONCEPTO_LABEL: Record<string, string> = {
  jornada: "Jornada",
  destajo_empaque: "Empaque",
  dominical_descanso: "Descanso dominical",
  dominical_trabajado: "Dominical trabajado",
  festivo_trabajado: "Festivo trabajado",
  sin_pago: "Sin pago",
}
const CONCEPTO_COLOR: Record<string, string> = {
  jornada: "bg-blue-100 text-blue-800",
  destajo_empaque: "bg-teal-100 text-teal-800",
  dominical_descanso: "bg-purple-100 text-purple-800",
  dominical_trabajado: "bg-amber-100 text-amber-800",
  festivo_trabajado: "bg-amber-100 text-amber-800",
  sin_pago: "bg-stone-100 text-stone-500",
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

// Fila de una persona con su detalle día por día
function PersonaCard({
  p,
  onMsg,
  onRecargar,
}: {
  p: NominaPersona
  onMsg: (tipo: "ok" | "error", msg: string) => void
  onRecargar: () => void
}) {
  const [abierto, setAbierto] = React.useState(false)
  const [isPending, startTransition] = useTransition()

  function alternarCierre(d: DiaNomina) {
    startTransition(async () => {
      const res = d.cerrado
        ? await reabrirDiaNominaAction(p.persona_id, d.fecha)
        : await cerrarDiaNominaAction({
            persona_id: p.persona_id,
            fecha: d.fecha,
            valor_pagado: d.valor_total,
          })
      if (res.error) onMsg("error", res.error)
      else {
        onMsg("ok", d.cerrado ? "Día reabierto" : "Día cerrado")
        onRecargar()
      }
    })
  }

  const diasConPago = p.dias.filter((d) => d.valor_total > 0)

  return (
    <Card className="overflow-hidden p-0">
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-stone-50"
        onClick={() => setAbierto((a) => !a)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-stone-400">
            {abierto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-stone-800 truncate">{p.nombre}</p>
            <p className="text-xs text-stone-500">
              {p.cargo ?? "—"}
              <span className="text-stone-400"> · CC {p.documento}</span>
              {p.es_empacador && (
                <Badge className="ml-2 bg-teal-100 text-teal-800 border-0 text-[10px]">
                  Destajo
                </Badge>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="text-right">
            <p className="text-[11px] text-stone-500">Días</p>
            <p className="font-mono font-bold text-stone-700">{p.total_dias_trabajados}</p>
          </div>
          {p.es_empacador && (
            <div className="text-right">
              <p className="text-[11px] text-stone-500">Prendas</p>
              <p className="font-mono font-bold text-teal-700">
                {p.total_unidades.toLocaleString("es-CO")}
              </p>
            </div>
          )}
          <div className="text-right">
            <p className="text-[11px] text-stone-500">Devengado</p>
            <p className="font-mono font-bold text-stone-900">{cop(p.total_devengado)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-stone-500">Neto</p>
            <p className="font-mono font-bold text-emerald-700">{cop(p.neto_a_pagar)}</p>
          </div>
        </div>
      </div>

      {abierto && (
        <div className="border-t border-stone-100 bg-stone-50/40 px-4 py-4 space-y-4">
          {/* Resumen de liquidación */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              ["Devengado", cop(p.total_devengado), "text-stone-800"],
              ["Aux. transporte", cop(p.auxilio_transporte), "text-blue-700"],
              ["Salud (4%)", `−${cop(p.deduccion_salud)}`, "text-red-600"],
              ["Pensión (4%)", `−${cop(p.deduccion_pension)}`, "text-red-600"],
              ["Neto a pagar", cop(p.neto_a_pagar), "text-emerald-700"],
              ["Costo empresa", cop(p.costo_empleador), "text-amber-700"],
            ].map(([label, valor, color]) => (
              <div key={label} className="rounded-lg border border-stone-200 bg-white px-3 py-2">
                <p className="text-[11px] text-stone-500">{label}</p>
                <p className={`font-mono text-sm font-bold ${color}`}>{valor}</p>
              </div>
            ))}
          </div>

          {/* Detalle día por día */}
          <div className="rounded-xl border border-stone-200 bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100">
                  <th className="px-3 py-2 text-left text-xs text-stone-500 font-medium">Fecha</th>
                  <th className="px-3 py-2 text-left text-xs text-stone-500 font-medium">Día</th>
                  <th className="px-3 py-2 text-left text-xs text-stone-500 font-medium">Concepto</th>
                  {p.es_empacador && (
                    <th className="px-3 py-2 text-right text-xs text-stone-500 font-medium">
                      Prendas
                    </th>
                  )}
                  <th className="px-3 py-2 text-right text-xs text-stone-500 font-medium">Base</th>
                  <th className="px-3 py-2 text-right text-xs text-stone-500 font-medium">Recargo</th>
                  <th className="px-3 py-2 text-right text-xs text-stone-500 font-medium">Total</th>
                  <th className="px-3 py-2 text-left text-xs text-stone-500 font-medium">Detalle</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody>
                {p.dias.map((d) => (
                  <tr
                    key={d.fecha}
                    className={`border-b border-stone-100 last:border-0 ${
                      d.valor_total === 0
                        ? "bg-stone-50/60"
                        : d.cerrado
                          ? "bg-emerald-50/40"
                          : ""
                    }`}
                  >
                    <td className="px-3 py-1.5 font-mono text-xs text-stone-600">{d.fecha}</td>
                    <td className="px-3 py-1.5 text-xs">
                      <span
                        className={
                          d.es_domingo || d.es_festivo
                            ? "font-semibold text-amber-700"
                            : "text-stone-600"
                        }
                      >
                        {DIAS[d.dia_semana]}
                        {d.es_festivo && <span className="ml-1 text-[10px]">festivo</span>}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <Badge
                        className={`border-0 text-[10px] ${CONCEPTO_COLOR[d.concepto] ?? ""}`}
                      >
                        {CONCEPTO_LABEL[d.concepto] ?? d.concepto}
                      </Badge>
                    </td>
                    {p.es_empacador && (
                      <td className="px-3 py-1.5 text-right font-mono text-xs text-teal-700">
                        {d.unidades_empacadas > 0
                          ? d.unidades_empacadas.toLocaleString("es-CO")
                          : "—"}
                      </td>
                    )}
                    <td className="px-3 py-1.5 text-right font-mono text-xs text-stone-700">
                      {d.valor_base > 0 ? cop(d.valor_base) : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs text-amber-700">
                      {d.valor_recargo > 0 ? cop(d.valor_recargo) : "—"}
                    </td>
                    <td
                      className={`px-3 py-1.5 text-right font-mono text-xs font-bold ${
                        d.valor_total > 0 ? "text-stone-900" : "text-stone-300"
                      }`}
                    >
                      {cop(d.valor_total)}
                    </td>
                    <td className="px-3 py-1.5 text-[11px] text-stone-500">{d.detalle}</td>
                    <td className="px-3 py-1.5">
                      {d.valor_total > 0 && (
                        <button
                          type="button"
                          onClick={() => alternarCierre(d)}
                          disabled={isPending}
                          className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold ${
                            d.cerrado
                              ? "border border-stone-200 text-stone-500 hover:bg-stone-100"
                              : "text-white"
                          }`}
                          style={d.cerrado ? undefined : { backgroundColor: "#065f46" }}
                        >
                          {d.cerrado ? (
                            <>
                              <Unlock className="h-3 w-3" /> Reabrir
                            </>
                          ) : (
                            <>
                              <Lock className="h-3 w-3" /> Cerrar
                            </>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="bg-stone-100">
                  <td colSpan={p.es_empacador ? 6 : 5} className="px-3 py-2 text-xs font-bold text-stone-700">
                    Total del periodo · {diasConPago.length} días con pago
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-sm font-bold text-stone-900">
                    {cop(p.total_devengado)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  )
}

// ── Pestaña de configuración ──
function ConfigTab({
  config,
  onMsg,
  onRecargar,
}: {
  config: ConfigNominaGeneral | null
  onMsg: (tipo: "ok" | "error", msg: string) => void
  onRecargar: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [valores, setValores] = React.useState<Record<string, string>>(() => {
    if (!config) return {}
    const init: Record<string, string> = {}
    for (const [k, v] of Object.entries(config)) {
      if (typeof v === "number") init[k] = String(v)
    }
    return init
  })

  function set(k: string, v: string) {
    setValores((prev) => ({ ...prev, [k]: v }))
  }

  function guardar() {
    if (!config) return
    const campos: Record<string, number> = {}
    for (const [k, v] of Object.entries(valores)) {
      if (k === "id") continue
      const n = Number(v)
      if (!isNaN(n)) campos[k] = n
    }
    startTransition(async () => {
      const res = await guardarConfigNominaAction(config.id, campos)
      if (res.error) onMsg("error", res.error)
      else {
        onMsg("ok", "Configuración guardada")
        onRecargar()
        router.refresh()
      }
    })
  }

  if (!config) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-stone-500">
          No hay configuración de nómina. Ejecuta el script 36 en la base de datos.
        </p>
      </Card>
    )
  }

  const grupos: Array<{ titulo: string; nota?: string; campos: Array<[string, string, string]> }> = [
    {
      titulo: "Pago del personal de empaque",
      nota: "El personal con cargo EMPACADOR se paga a destajo: prendas empacadas × este valor.",
      campos: [["valor_prenda_empaque", "Valor por prenda empacada", "$"]],
    },
    {
      titulo: "Parámetros legales 2026",
      nota: "Salario mínimo y auxilio de transporte vigentes en Colombia.",
      campos: [
        ["salario_minimo", "Salario mínimo mensual", "$"],
        ["auxilio_transporte", "Auxilio de transporte", "$"],
        ["tope_auxilio_smmlv", "Tope auxilio (en SMMLV)", "x"],
        ["dias_semana_para_dominical", "Días para descanso dominical", "d"],
      ],
    },
    {
      titulo: "Aportes del trabajador",
      campos: [
        ["porc_salud_empleado", "Salud", "%"],
        ["porc_pension_empleado", "Pensión", "%"],
      ],
    },
    {
      titulo: "Aportes del empleador",
      campos: [
        ["porc_salud_empleador", "Salud", "%"],
        ["porc_pension_empleador", "Pensión", "%"],
        ["porc_arl", "ARL", "%"],
        ["porc_caja", "Caja de compensación", "%"],
        ["porc_icbf", "ICBF", "%"],
        ["porc_sena", "SENA", "%"],
      ],
    },
    {
      titulo: "Prestaciones sociales",
      campos: [
        ["porc_cesantias", "Cesantías", "%"],
        ["porc_int_cesantias", "Intereses cesantías", "%"],
        ["porc_prima", "Prima de servicios", "%"],
        ["porc_vacaciones", "Vacaciones", "%"],
      ],
    },
  ]

  return (
    <div className="space-y-4">
      {grupos.map((g) => (
        <Card key={g.titulo} className="p-5 space-y-3">
          <div className="border-b border-stone-100 pb-2">
            <h2 className="text-sm font-semibold text-stone-700">{g.titulo}</h2>
            {g.nota && <p className="text-xs text-stone-500 mt-0.5">{g.nota}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {g.campos.map(([key, label, sufijo]) => (
              <div key={key} className="space-y-1">
                <label className="text-xs font-medium text-stone-600">
                  {label} <span className="text-stone-400">({sufijo})</span>
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={valores[key] ?? ""}
                  onChange={(e) => set(key, e.target.value)}
                  className={`${filtroCls} w-full font-mono`}
                />
              </div>
            ))}
          </div>
        </Card>
      ))}

      <button
        type="button"
        onClick={guardar}
        disabled={isPending}
        className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        style={{ backgroundColor: "#344966" }}
      >
        <Save className="h-4 w-4" />
        {isPending ? "Guardando…" : "Guardar configuración"}
      </button>
    </div>
  )
}

export function NominaDiariaClient({
  personasIniciales,
  configInicial,
  empleados,
  desdeInicial,
  hastaInicial,
}: {
  personasIniciales: NominaPersona[]
  configInicial: ConfigNominaGeneral | null
  empleados: PersonaRow[]
  desdeInicial: string
  hastaInicial: string
}) {
  const router = useRouter()
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)
  const [tab, setTab] = React.useState<"diaria" | "config">("diaria")
  const [personas, setPersonas] = React.useState(personasIniciales)
  const [config, setConfig] = React.useState(configInicial)
  const [cargando, startCarga] = useTransition()

  const [desde, setDesde] = React.useState(desdeInicial)
  const [hasta, setHasta] = React.useState(hastaInicial)
  const [personaId, setPersonaId] = React.useState("")

  function showToast(tipo: "ok" | "error", msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const recargar = React.useCallback(() => {
    startCarga(async () => {
      const res = await cargarNominaDiariaAction({
        desde,
        hasta,
        personaId: personaId ? parseInt(personaId, 10) : null,
      })
      if (res.error) showToast("error", res.error)
      else {
        setPersonas(res.personas ?? [])
        if (res.config) setConfig(res.config)
      }
      router.refresh()
    })
  }, [desde, hasta, personaId, router])

  const totalDevengado = personas.reduce((s, p) => s + p.total_devengado, 0)
  const totalNeto = personas.reduce((s, p) => s + p.neto_a_pagar, 0)
  const totalCosto = personas.reduce((s, p) => s + p.costo_empleador, 0)
  const totalUnidades = personas.reduce((s, p) => s + p.total_unidades, 0)

  const esc = (t: unknown) =>
    String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  function exportarExcel() {
    const filas = personas
      .flatMap((p) =>
        p.dias.map(
          (d) =>
            `<tr><td>${esc(d.fecha)}</td><td>${DIAS[d.dia_semana]}</td><td>${esc(
              p.nombre
            )}</td><td>${esc(p.documento)}</td><td>${esc(p.cargo)}</td><td>${
              CONCEPTO_LABEL[d.concepto] ?? d.concepto
            }</td><td>${d.unidades_empacadas}</td><td>${d.valor_base}</td><td>${
              d.valor_recargo
            }</td><td>${d.valor_total}</td><td>${esc(d.detalle)}</td></tr>`
        )
      )
      .join("")
    const tabla = `<html><head><meta charset="utf-8"></head><body><table border="1"><tr><th>Fecha</th><th>Día</th><th>Persona</th><th>Documento</th><th>Cargo</th><th>Concepto</th><th>Prendas</th><th>Base</th><th>Recargo</th><th>Total</th><th>Detalle</th></tr>${filas}</table></body></html>`
    const blob = new Blob(["﻿" + tabla], { type: "application/vnd.ms-excel" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `nomina-diaria-${desde}_a_${hasta}.xls`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function imprimir() {
    const secciones = personas
      .map(
        (p) => `
      <div class="persona">
        <div class="cab">
          <span><strong>${esc(p.nombre)}</strong> · CC ${esc(p.documento)} · ${esc(p.cargo)}</span>
          <span>Neto: <strong>${cop(p.neto_a_pagar)}</strong></span>
        </div>
        <table>
          <thead><tr><th class="izq">Fecha</th><th>Día</th><th class="izq">Concepto</th><th>Prendas</th><th>Total</th></tr></thead>
          <tbody>
            ${p.dias
              .filter((d) => d.valor_total > 0)
              .map(
                (d) =>
                  `<tr><td class="izq">${d.fecha}</td><td>${DIAS[d.dia_semana]}</td><td class="izq">${
                    CONCEPTO_LABEL[d.concepto] ?? d.concepto
                  }</td><td>${d.unidades_empacadas || "—"}</td><td>${cop(d.valor_total)}</td></tr>`
              )
              .join("")}
            <tr class="tot"><td class="izq" colspan="4">Devengado</td><td>${cop(p.total_devengado)}</td></tr>
            <tr><td class="izq" colspan="4">Auxilio de transporte</td><td>${cop(p.auxilio_transporte)}</td></tr>
            <tr><td class="izq" colspan="4">Salud + Pensión</td><td>−${cop(
              p.deduccion_salud + p.deduccion_pension
            )}</td></tr>
            <tr class="tot"><td class="izq" colspan="4">NETO A PAGAR</td><td>${cop(p.neto_a_pagar)}</td></tr>
          </tbody>
        </table>
      </div>`
      )
      .join("")

    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>Nómina ${esc(desde)} a ${esc(hasta)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: letter; margin: 10mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #111; padding: 14px; }
  .titulo { background: #f2e14c; border: 1.5px solid #111; font-weight: bold; font-size: 12px;
            padding: 5px 8px; display: flex; justify-content: space-between; margin-bottom: 8px; }
  .persona { border: 1px solid #111; margin-bottom: 8px; page-break-inside: avoid; }
  .cab { background: #eee; padding: 3px 6px; display: flex; justify-content: space-between;
         border-bottom: 1px solid #111; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border-bottom: 1px solid #ddd; padding: 2px 6px; font-size: 9px; text-align: center; }
  th { background: #f7f7f7; text-transform: uppercase; font-size: 8px; }
  .izq { text-align: left; }
  tr.tot td { font-weight: bold; background: #dcefe4; }
</style></head><body>
  <div class="titulo"><span>NÓMINA DIARIA</span><span>${esc(desde)} a ${esc(hasta)}</span></div>
  ${secciones}
  <div class="titulo"><span>TOTAL NETO A PAGAR</span><span>${cop(totalNeto)}</span></div>
  <script>window.addEventListener("load",function(){setTimeout(function(){window.print()},250)})<\/script>
</body></html>`)
    w.document.close()
    w.focus()
  }

  const cardCls = "p-5 flex items-center gap-4"

  return (
    <div className="space-y-4">
      {toast && <Toast tipo={toast.tipo} msg={toast.msg} />}

      {/* Pestañas */}
      <div className="flex rounded-xl border border-stone-200 overflow-hidden w-fit">
        <button
          type="button"
          onClick={() => setTab("diaria")}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold ${
            tab === "diaria" ? "bg-[#344966] text-white" : "bg-white text-stone-600"
          }`}
        >
          <CalendarDays className="h-3.5 w-3.5" /> Nómina diaria
        </button>
        <button
          type="button"
          onClick={() => setTab("config")}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold ${
            tab === "config" ? "bg-[#344966] text-white" : "bg-white text-stone-600"
          }`}
        >
          <Settings2 className="h-3.5 w-3.5" /> Configuración
        </button>
      </div>

      {tab === "config" ? (
        <ConfigTab config={config} onMsg={showToast} onRecargar={recargar} />
      ) : (
        <>
          {/* Totales */}
          <Card className="p-0 overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-stone-200">
              <div className={cardCls}>
                <div className="rounded-xl bg-blue-50 p-3">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-stone-500">Personas</p>
                  <p className="text-2xl font-bold text-stone-900">{personas.length}</p>
                  {totalUnidades > 0 && (
                    <p className="text-[11px] text-teal-600">
                      {totalUnidades.toLocaleString("es-CO")} prendas empacadas
                    </p>
                  )}
                </div>
              </div>
              <div className={cardCls}>
                <div className="rounded-xl bg-stone-100 p-3">
                  <Package className="h-6 w-6 text-stone-600" />
                </div>
                <div>
                  <p className="text-xs text-stone-500">Devengado</p>
                  <p className="text-2xl font-bold text-stone-900 font-mono">
                    {cop(totalDevengado)}
                  </p>
                </div>
              </div>
              <div className={cardCls}>
                <div className="rounded-xl bg-emerald-50 p-3">
                  <Wallet className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-stone-500">Neto a pagar</p>
                  <p className="text-2xl font-bold text-emerald-700 font-mono">{cop(totalNeto)}</p>
                </div>
              </div>
              <div className={cardCls}>
                <div className="rounded-xl bg-amber-50 p-3">
                  <Building2 className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-stone-500">Costo empresa</p>
                  <p className="text-2xl font-bold text-amber-700 font-mono">{cop(totalCosto)}</p>
                  <p className="text-[11px] text-stone-400">con aportes y prestaciones</p>
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
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={recargar}
                  disabled={cargando}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: "#344966" }}
                >
                  {cargando ? "Calculando…" : "Calcular"}
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
            {config && config.valor_prenda_empaque === 0 && (
              <p className="mt-3 text-xs text-amber-600">
                El valor por prenda empacada está en $0. Configúralo en la pestaña
                Configuración para liquidar al personal de empaque.
              </p>
            )}
          </Card>

          {/* Personas */}
          {personas.length === 0 ? (
            <Card className="p-12 text-center">
              <Users className="h-10 w-10 mx-auto mb-3 text-stone-300" />
              <p className="text-stone-400 text-sm">
                No hay personal activo con movimientos en este periodo.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {personas.map((p) => (
                <PersonaCard
                  key={p.persona_id}
                  p={p}
                  onMsg={showToast}
                  onRecargar={recargar}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
