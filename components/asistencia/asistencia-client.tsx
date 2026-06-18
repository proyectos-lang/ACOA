"use client"

import React, { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, AlertTriangle, RefreshCw, Download, Search } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AsistenciaDiaRow } from "@/lib/db/asistencia-dia"
import type { HistorialRow } from "@/lib/types"
import type { PersonaRow } from "@/lib/db/persona"
import {
  consolidarDiaAction,
  actualizarUmbralAction,
  actualizarHorasExtraAction,
  filtrarHistorialAction,
} from "@/app/(dashboard)/asistencia/actions"

type RegistroConPersona = AsistenciaDiaRow & {
  persona: { nombre: string; documento: string; tipo_pago: string } | null
}

interface Props {
  fecha: string
  registros: RegistroConPersona[]
  personas: PersonaRow[]
}

function fmt2(n: number | string) {
  return Number(n).toFixed(2)
}

function fmtHora(h: string | null) {
  if (!h) return "—"
  return h.substring(0, 5) // "HH:MM"
}

function fmtFecha(f: string) {
  const [y, m, d] = f.split("-")
  return `${d}/${m}/${y}`
}

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

// ── Tab "Asistencia del día" ──────────────────────────────────────────────────

function DiaTab({
  fechaInicial,
  registrosInicial,
}: {
  fechaInicial: string
  registrosInicial: RegistroConPersona[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [fecha, setFecha] = useState(fechaInicial)
  const [registros, setRegistros] = useState(registrosInicial)
  const [toast, setToast] = useState<{ tipo: "ok" | "error"; msg: string } | null>(null)
  const [umbralEdit, setUmbralEdit] = useState<Record<number, string>>({})
  const [extraEdit, setExtraEdit] = useState<Record<number, string>>({})

  React.useEffect(() => { setRegistros(registrosInicial) }, [registrosInicial])

  function showToast(tipo: "ok" | "error", msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 3500)
  }

  function handleFechaChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFecha(e.target.value)
    router.push(`/asistencia?fecha=${e.target.value}`)
  }

  function handleConsolidar() {
    startTransition(async () => {
      const res = await consolidarDiaAction(fecha)
      if (res.error) showToast("error", res.error)
      else {
        showToast("ok", `${res.procesadas} registro(s) consolidado(s)`)
        router.refresh()
      }
    })
  }

  async function handleGuardarUmbral(id: number) {
    const val = parseFloat(umbralEdit[id] ?? "")
    if (isNaN(val) || val < 0) { showToast("error", "Umbral inválido"); return }
    const res = await actualizarUmbralAction(id, val)
    if (res.error) showToast("error", res.error)
    else { setUmbralEdit((p) => { const n = { ...p }; delete n[id]; return n }); router.refresh() }
  }

  async function handleGuardarExtra(id: number) {
    const val = parseFloat(extraEdit[id] ?? "")
    if (isNaN(val) || val < 0) { showToast("error", "Valor inválido"); return }
    const res = await actualizarHorasExtraAction(id, val)
    if (res.error) showToast("error", res.error)
    else { setExtraEdit((p) => { const n = { ...p }; delete n[id]; return n }); router.refresh() }
  }

  function rowBg(reg: RegistroConPersona) {
    if (reg.observacion === "Sin registro de salida") return "bg-yellow-50"
    if (reg.es_festivo || reg.es_domingo) return "bg-blue-50"
    if (!reg.trabajado) return "bg-stone-50"
    return "bg-white"
  }

  return (
    <div className="space-y-4">
      {/* Barra superior */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-stone-600">Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={handleFechaChange}
            className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
          />
        </div>
        <button
          onClick={handleConsolidar}
          disabled={isPending}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-60"
          style={{ backgroundColor: "#344966" }}
        >
          <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
          Consolidar día
        </button>
        <span className="text-sm text-stone-400 ml-auto">
          {registros.length} persona(s) consolidada(s)
        </span>
      </div>

      {toast && <Toast tipo={toast.tipo} msg={toast.msg} />}

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3 text-xs text-stone-500">
        {[
          { color: "bg-yellow-50 border-yellow-200", label: "Sin salida" },
          { color: "bg-blue-50 border-blue-200",     label: "Domingo / Festivo" },
          { color: "bg-stone-50 border-stone-200",   label: "Sin asistencia" },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`inline-block w-3 h-3 rounded border ${color}`} />
            {label}
          </span>
        ))}
      </div>

      {/* Tabla */}
      {registros.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
          <p className="text-stone-400 text-sm">
            No hay registros para esta fecha. Usa &quot;Consolidar día&quot; para procesar las marcaciones.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  {[
                    "Persona", "Tipo", "Entrada", "Salida",
                    "H. Trab.", "H. Ord.", "H. Extra", "H. Noc.",
                    "Umbral", "Estado",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide text-left whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registros.map((reg) => {
                  const bg = reg.horas_extra > 2 ? "bg-amber-50" : rowBg(reg)
                  const umbralVal = umbralEdit[reg.id] ?? String(reg.umbral_horas_extra)
                  const extraVal = extraEdit[reg.id] ?? String(reg.horas_extra)
                  return (
                    <tr key={reg.id} className={`border-b border-stone-100 last:border-0 ${bg}`}>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-stone-800 whitespace-nowrap">
                          {reg.persona?.nombre ?? "—"}
                        </p>
                        <p className="text-xs text-stone-400">{reg.persona?.documento ?? "—"}</p>
                        {reg.observacion && (
                          <p className="text-xs text-amber-600 mt-0.5">{reg.observacion}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-stone-100 text-stone-600">
                          {reg.persona?.tipo_pago ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-stone-600 whitespace-nowrap">
                        {fmtHora(reg.hora_entrada)}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-stone-600 whitespace-nowrap">
                        {fmtHora(reg.hora_salida)}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-medium text-stone-800">
                        {fmt2(reg.horas_trabajadas)}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-stone-600">
                        {fmt2(reg.horas_ordinarias)}
                      </td>
                      {/* H. Extra editable */}
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            min="0"
                            step="0.25"
                            value={extraVal}
                            onChange={(e) =>
                              setExtraEdit((p) => ({ ...p, [reg.id]: e.target.value }))
                            }
                            onBlur={() => {
                              if (extraEdit[reg.id] !== undefined) handleGuardarExtra(reg.id)
                            }}
                            className="w-16 rounded-lg border border-stone-200 px-2 py-1 text-xs text-center font-mono outline-none focus:ring-1 focus:ring-[#344966]"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-stone-600">
                        {fmt2(reg.horas_nocturnas)}
                      </td>
                      {/* Umbral editable */}
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={umbralVal}
                            onChange={(e) =>
                              setUmbralEdit((p) => ({ ...p, [reg.id]: e.target.value }))
                            }
                            className="w-16 rounded-lg border border-stone-200 px-2 py-1 text-xs text-center font-mono outline-none focus:ring-1 focus:ring-[#344966]"
                          />
                          {umbralEdit[reg.id] !== undefined && (
                            <button
                              onClick={() => handleGuardarUmbral(reg.id)}
                              className="text-xs rounded-lg px-1.5 py-1 font-medium text-white"
                              style={{ backgroundColor: "#344966" }}
                            >
                              OK
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1 items-center">
                          {reg.trabajado ? (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                              Trabajó
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-stone-100 text-stone-500">
                              Sin registro
                            </span>
                          )}
                          {reg.es_festivo && (
                            <span className="inline-flex rounded-full px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
                              Festivo
                            </span>
                          )}
                          {reg.es_domingo && (
                            <span className="inline-flex rounded-full px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700">
                              Dom
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab "Historial" ───────────────────────────────────────────────────────────

function HistorialTab({ personas }: { personas: PersonaRow[] }) {
  const hoy = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Bogota" })
  const hace15 = new Date(Date.now() - 15 * 86400000)
    .toLocaleDateString("sv-SE", { timeZone: "America/Bogota" })

  const [fechaDesde, setFechaDesde] = useState(hace15)
  const [fechaHasta, setFechaHasta] = useState(hoy)
  const [personaId, setPersonaId] = useState<string>("")
  const [registros, setRegistros] = useState<HistorialRow[]>([])
  const [cargado, setCargado] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ tipo: "ok" | "error"; msg: string } | null>(null)

  function showToast(tipo: "ok" | "error", msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 3500)
  }

  function handleFiltrar() {
    startTransition(async () => {
      const res = await filtrarHistorialAction({
        fechaDesde,
        fechaHasta,
        personaId: personaId ? Number(personaId) : undefined,
      })
      if (res.error) showToast("error", res.error)
      else { setRegistros(res.registros); setCargado(true) }
    })
  }

  // Totales
  const totales = registros.reduce(
    (acc, r) => ({
      dias: acc.dias + (r.trabajado ? 1 : 0),
      trabajadas: acc.trabajadas + Number(r.horas_trabajadas),
      ordinarias: acc.ordinarias + Number(r.horas_ordinarias),
      extra: acc.extra + Number(r.horas_extra),
      nocturnas: acc.nocturnas + Number(r.horas_nocturnas),
      domingos: acc.domingos + (r.es_domingo && r.trabajado ? 1 : 0),
      festivos: acc.festivos + (r.es_festivo && r.trabajado ? 1 : 0),
    }),
    { dias: 0, trabajadas: 0, ordinarias: 0, extra: 0, nocturnas: 0, domingos: 0, festivos: 0 }
  )

  function exportarCSV() {
    const headers = [
      "Fecha", "Documento", "Nombre", "Entrada", "Salida",
      "H.Trabajadas", "H.Ordinarias", "H.Extra", "H.Nocturnas",
      "Domingo", "Festivo", "Observación",
    ]
    const rows = registros.map((r) => [
      fmtFecha(r.fecha),
      r.documento ?? "",
      r.nombre ?? "",
      fmtHora(r.hora_entrada),
      fmtHora(r.hora_salida),
      fmt2(r.horas_trabajadas),
      fmt2(r.horas_ordinarias),
      fmt2(r.horas_extra),
      fmt2(r.horas_nocturnas),
      r.es_domingo ? "Sí" : "No",
      r.es_festivo ? "Sí" : "No",
      r.observacion ?? "",
    ])
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n")
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `historial-asistencia-${fechaDesde}-${fechaHasta}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const porPersona = personaId !== ""

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-stone-500">Desde</label>
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-stone-500">Hasta</label>
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
          />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-stone-500">Persona</label>
          <select
            value={personaId}
            onChange={(e) => setPersonaId(e.target.value)}
            className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#344966] bg-white"
          >
            <option value="">Todas las personas</option>
            {personas.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.documento} — {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleFiltrar}
          disabled={isPending}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          style={{ backgroundColor: "#344966" }}
        >
          <Search className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
          Filtrar
        </button>
        {registros.length > 0 && (
          <button
            onClick={exportarCSV}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
        )}
      </div>

      {toast && <Toast tipo={toast.tipo} msg={toast.msg} />}

      {/* Totales (cards si es por persona, fila si es todas) */}
      {cargado && registros.length > 0 && porPersona && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Días trabajados", value: totales.dias },
            { label: "H. trabajadas", value: fmt2(totales.trabajadas) },
            { label: "H. ordinarias", value: fmt2(totales.ordinarias) },
            { label: "H. extra", value: fmt2(totales.extra) },
            { label: "H. nocturnas", value: fmt2(totales.nocturnas) },
            { label: "Domingos", value: totales.domingos },
            { label: "Festivos", value: totales.festivos },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-stone-200 bg-white p-3 text-center shadow-sm">
              <p className="text-xl font-bold text-stone-800 tabular-nums">{value}</p>
              <p className="text-xs text-stone-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabla */}
      {!cargado ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
          <p className="text-stone-400 text-sm">Selecciona los filtros y presiona &quot;Filtrar&quot; para cargar el historial.</p>
        </div>
      ) : registros.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
          <p className="text-stone-400 text-sm">No hay registros para los filtros seleccionados.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  {[
                    "Fecha", "Documento", "Nombre",
                    "Entrada", "Salida",
                    "H. Trab.", "H. Ord.", "H. Extra", "H. Noc.",
                    "Dom.", "Fest.", "Observación",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide text-left whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registros.map((reg) => {
                  const sinSalida = reg.observacion === "Sin registro de salida"
                  const especial = reg.es_domingo || reg.es_festivo
                  const bg = sinSalida ? "bg-yellow-50" : especial ? "bg-blue-50" : "bg-white"
                  return (
                    <tr key={reg.id} className={`border-b border-stone-100 last:border-0 ${bg}`}>
                      <td className="px-3 py-2.5 font-mono text-stone-600 whitespace-nowrap">
                        {fmtFecha(reg.fecha)}
                      </td>
                      <td className="px-3 py-2.5 text-stone-600">
                        {reg.documento ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-stone-800 whitespace-nowrap">
                        {reg.nombre ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-stone-600">
                        {fmtHora(reg.hora_entrada)}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-stone-600">
                        {fmtHora(reg.hora_salida)}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-medium text-stone-800">
                        {fmt2(reg.horas_trabajadas)}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-stone-600">
                        {fmt2(reg.horas_ordinarias)}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-stone-600">
                        {fmt2(reg.horas_extra)}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-stone-600">
                        {fmt2(reg.horas_nocturnas)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {reg.es_domingo ? (
                          <span className="text-purple-600 font-semibold text-xs">Sí</span>
                        ) : (
                          <span className="text-stone-300 text-xs">No</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {reg.es_festivo ? (
                          <span className="text-blue-600 font-semibold text-xs">Sí</span>
                        ) : (
                          <span className="text-stone-300 text-xs">No</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-amber-600 max-w-[160px]">
                        {reg.observacion ?? ""}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {/* Fila de totales si es "todas las personas" */}
              {!porPersona && (
                <tfoot>
                  <tr className="border-t-2 border-stone-200 bg-stone-50 font-semibold">
                    <td colSpan={5} className="px-3 py-2.5 text-xs text-stone-500 uppercase tracking-wide">
                      Totales ({registros.length} registros)
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono text-stone-800">
                      {fmt2(totales.trabajadas)}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono text-stone-800">
                      {fmt2(totales.ordinarias)}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono text-stone-800">
                      {fmt2(totales.extra)}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono text-stone-800">
                      {fmt2(totales.nocturnas)}
                    </td>
                    <td className="px-3 py-2.5 text-center text-stone-700">{totales.domingos}</td>
                    <td className="px-3 py-2.5 text-center text-stone-700">{totales.festivos}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function AsistenciaClient({ fecha, registros, personas }: Props) {
  return (
    <Tabs defaultValue="dia">
      <TabsList className="mb-4">
        <TabsTrigger value="dia">Asistencia del día</TabsTrigger>
        <TabsTrigger value="historial">Historial</TabsTrigger>
      </TabsList>
      <TabsContent value="dia">
        <DiaTab fechaInicial={fecha} registrosInicial={registros} />
      </TabsContent>
      <TabsContent value="historial">
        <HistorialTab personas={personas} />
      </TabsContent>
    </Tabs>
  )
}
