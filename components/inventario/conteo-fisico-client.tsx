"use client"

import * as React from "react"
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
  History,
  Save,
  Lock,
  Ban,
  Printer,
  Search,
  X,
  ChevronRight,
  ChevronDown,
} from "lucide-react"
import type {
  ConteoFisicoConDetalle,
  ConteoFisicoDetalleRow,
} from "@/lib/db/conteo-fisico"
import { ESTADO_CF_LABEL, ESTADO_CF_COLOR } from "@/lib/db/conteo-fisico"
import {
  abrirConteoFisicoAction,
  guardarConteoFisicoAction,
  cerrarConteoFisicoAction,
  anularConteoFisicoAction,
} from "@/app/(dashboard)/inventario/conteo-fisico-actions"
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

function hoyBogota() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
}
function miles(n: number) {
  return n.toLocaleString("es-CO")
}
function conSigno(n: number) {
  return n > 0 ? `+${miles(n)}` : miles(n)
}

const inputCls =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
const filtroCls =
  "rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"

export function ConteoFisicoClient({
  conteos,
  referencias,
  abierto,
  esAdmin,
}: {
  conteos: ConteoFisicoConDetalle[]
  referencias: Array<{ referencia: string; tallas: number; unidades: number }>
  abierto: ConteoFisicoConDetalle | null
  esAdmin: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)
  const [vista, setVista] = React.useState<"conteo" | "historial">(
    abierto ? "conteo" : "historial"
  )

  // Apertura
  const [fecha, setFecha] = React.useState(hoyBogota())
  const [observacion, setObservacion] = React.useState("")
  const [seleccion, setSeleccion] = React.useState<Set<string>>(new Set())
  const [buscaRef, setBuscaRef] = React.useState("")

  // Registro de lo contado: clave = id de la linea
  const [fisico, setFisico] = React.useState<Record<number, string>>({})
  const [notas, setNotas] = React.useState<Record<number, string>>({})
  const [soloDif, setSoloDif] = React.useState(false)
  const [buscaLinea, setBuscaLinea] = React.useState("")

  // Historial
  const [abiertas, setAbiertas] = React.useState<Set<number>>(new Set())

  const aviso = (tipo: "ok" | "error", msg: string) => {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 6000)
  }

  // Lo ya registrado se precarga al abrir la pantalla
  React.useEffect(() => {
    if (!abierto) return
    const f: Record<number, string> = {}
    const n: Record<number, string> = {}
    for (const d of abierto.detalle) {
      if (d.cantidad_fisica != null) f[d.id] = String(d.cantidad_fisica)
      if (d.observacion) n[d.id] = d.observacion
    }
    setFisico(f)
    setNotas(n)
  }, [abierto])

  // ── Apertura ──
  const refsFiltradas = React.useMemo(() => {
    const q = buscaRef.trim().toLowerCase()
    if (!q) return referencias
    return referencias.filter((r) => r.referencia.toLowerCase().includes(q))
  }, [referencias, buscaRef])

  function alternarRef(ref: string) {
    setSeleccion((prev) => {
      const s = new Set(prev)
      if (s.has(ref)) s.delete(ref)
      else s.add(ref)
      return s
    })
  }

  const unidadesSeleccionadas = referencias
    .filter((r) => seleccion.has(r.referencia))
    .reduce((s, r) => s + r.unidades, 0)

  function abrir() {
    startTransition(async () => {
      const r = await abrirConteoFisicoAction({
        fecha,
        referencias: [...seleccion],
        observacion,
      })
      if (r.error) return aviso("error", r.error)
      aviso(
        "ok",
        `Conteo abierto con ${miles(r.lineas ?? 0)} línea(s). Registra lo que hay en físico.`
      )
      setSeleccion(new Set())
      setObservacion("")
      setVista("conteo")
      router.refresh()
    })
  }

  // ── Registro ──
  const lineas = abierto?.detalle ?? []

  const conDiferencia = React.useMemo(() => {
    return lineas.filter((d) => {
      const v = fisico[d.id]
      if (v === undefined || v === "") return false
      return Number(v) !== d.cantidad_sistema
    })
  }, [lineas, fisico])

  const lineasVisibles = React.useMemo(() => {
    let l = lineas
    if (soloDif) {
      l = l.filter((d) => {
        const v = fisico[d.id]
        return v !== undefined && v !== "" && Number(v) !== d.cantidad_sistema
      })
    }
    const q = buscaLinea.trim().toLowerCase()
    if (q) {
      l = l.filter(
        (d) =>
          d.referencia.toLowerCase().includes(q) || d.talla.toLowerCase().includes(q)
      )
    }
    return l
  }, [lineas, soloDif, buscaLinea, fisico])

  const contadas = lineas.filter((d) => {
    const v = fisico[d.id]
    return v !== undefined && v !== ""
  }).length

  const difUnidades = conDiferencia.reduce(
    (s, d) => s + (Number(fisico[d.id]) - d.cantidad_sistema),
    0
  )

  function guardar(despues?: () => void) {
    if (!abierto) return
    startTransition(async () => {
      const payload = lineas.map((d) => ({
        id: d.id,
        cantidad_fisica:
          fisico[d.id] === undefined || fisico[d.id] === "" ? null : Number(fisico[d.id]),
        observacion: notas[d.id] ?? "",
      }))
      const r = await guardarConteoFisicoAction(abierto.id, payload)
      if (r.error) return aviso("error", r.error)
      if (despues) despues()
      else {
        aviso("ok", `Avance guardado: ${contadas} de ${lineas.length} línea(s) contadas`)
        router.refresh()
      }
    })
  }

  function cerrar() {
    if (!abierto) return
    // Se guarda primero: lo escrito en pantalla tiene que quedar antes
    // de que el cierre calcule las diferencias
    guardar(() => {
      startTransition(async () => {
        const r = await cerrarConteoFisicoAction(abierto.id)
        if (r.error) return aviso("error", r.error)
        aviso(
          "ok",
          `Conteo cerrado: ${r.ajustes} ajuste(s) al inventario, diferencia neta ${conSigno(
            r.diferencia ?? 0
          )} unidades`
        )
        setVista("historial")
        router.refresh()
      })
    })
  }

  function anular(id: number) {
    startTransition(async () => {
      const r = await anularConteoFisicoAction(id)
      if (r.error) return aviso("error", r.error)
      aviso("ok", "Conteo anulado")
      router.refresh()
    })
  }

  function alternarHistorial(id: number) {
    setAbiertas((prev) => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })
  }

  // ── Imprimible de la planilla ──
  function imprimirPlanilla() {
    if (!abierto) return
    const filas = lineas
      .map(
        (d) =>
          `<tr><td>${d.referencia}</td><td class="c">${d.talla}</td><td class="r">${miles(
            d.cantidad_sistema
          )}</td><td class="vacio"></td><td class="vacio"></td></tr>`
      )
      .join("")
    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(`<html><head><title>${abierto.numero}</title><style>
      @page { size: letter; margin: 12mm }
      body { font-family: Arial, sans-serif; font-size: 10px; color: #1c1917 }
      h1 { font-size: 15px; margin: 0 0 2px; color: #344966 }
      p.sub { margin: 0 0 10px; color: #78716c; font-size: 9px }
      table { width: 100%; border-collapse: collapse }
      th { background: #344966; color: #fff; padding: 5px; text-align: left; font-size: 9px }
      td { border-bottom: 1px solid #e7e5e4; padding: 4px 5px }
      td.r { text-align: right } td.c { text-align: center }
      td.vacio { border-bottom: 1px solid #a8a29e; width: 80px }
      .firma { margin-top: 36px; border-top: 1px solid #78716c; width: 220px;
               padding-top: 4px; text-align: center; font-size: 9px; color: #57534e }
    </style></head><body>
      <h1>Planilla de conteo fisico &mdash; ${abierto.numero}</h1>
      <p class="sub">Fecha: ${abierto.fecha} &middot; Abierto por ${
        abierto.abierto_nombre ?? "-"
      } &middot; ${miles(lineas.length)} lineas</p>
      <table>
        <thead><tr>
          <th>Referencia</th><th style="text-align:center">Talla</th>
          <th style="text-align:right">Sistema</th>
          <th style="width:80px">Fisico</th><th style="width:80px">Obs.</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <div class="firma">Contado por</div>
      <script>window.addEventListener("load", function(){ window.print() })<\/script>
    </body></html>`)
    w.document.close()
  }

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

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setVista("conteo")}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
            vista === "conteo"
              ? "bg-[#344966] text-white"
              : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
          }`}
        >
          <ClipboardList className="mr-2 inline h-4 w-4" />
          {abierto ? `Conteo ${abierto.numero}` : "Nuevo conteo"}
        </button>
        <button
          onClick={() => setVista("historial")}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
            vista === "historial"
              ? "bg-[#344966] text-white"
              : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
          }`}
        >
          <History className="mr-2 inline h-4 w-4" />
          Historial ({conteos.length})
        </button>
      </div>

      {/* ── Abrir un conteo ── */}
      {vista === "conteo" && !abierto && (
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-stone-700">Abrir un conteo físico</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="text-[11px] font-medium text-stone-500">Fecha</label>
                <input
                  type="date"
                  className={inputCls}
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[11px] font-medium text-stone-500">Observacion</label>
                <input
                  className={inputCls}
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  placeholder="Opcional: quien cuenta, bodega, motivo..."
                />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-stone-700">
                  Referencias a contar
                </h2>
                <p className="text-xs text-stone-400">
                  {seleccion.size === 0
                    ? `Sin selección se cuenta todo el inventario (${referencias.length} referencias)`
                    : `${seleccion.size} referencia(s) · ${miles(unidadesSeleccionadas)} unidades`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                  <input
                    className={`${filtroCls} pl-8`}
                    value={buscaRef}
                    onChange={(e) => setBuscaRef(e.target.value)}
                    placeholder="Buscar referencia"
                  />
                </div>
                {seleccion.size > 0 && (
                  <button
                    onClick={() => setSeleccion(new Set())}
                    className="rounded-xl border border-stone-200 px-3 py-2 text-xs text-stone-500 hover:bg-stone-50"
                  >
                    Quitar selección
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[320px] overflow-auto rounded-xl border border-stone-100">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-stone-50">
                  <tr>
                    <th className="w-10 px-3 py-2" />
                    {["Referencia", "Tallas", "Unidades"].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left text-xs font-semibold uppercase text-stone-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {refsFiltradas.map((r) => (
                    <tr
                      key={r.referencia}
                      onClick={() => alternarRef(r.referencia)}
                      className={`cursor-pointer border-t border-stone-100 hover:bg-stone-50 ${
                        seleccion.has(r.referencia) ? "bg-[#344966]/5" : ""
                      }`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={seleccion.has(r.referencia)}
                          onChange={() => alternarRef(r.referencia)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 cursor-pointer accent-[#344966]"
                        />
                      </td>
                      <td className="px-3 py-2 font-semibold text-stone-800">{r.referencia}</td>
                      <td className="px-3 py-2 text-stone-600">{r.tallas}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-stone-700">
                        {miles(r.unidades)}
                      </td>
                    </tr>
                  ))}
                  {refsFiltradas.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-sm text-stone-400">
                        Sin referencias con inventario
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <button
              onClick={abrir}
              disabled={isPending || referencias.length === 0}
              className="mt-4 flex items-center gap-2 rounded-xl bg-[#344966] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a3b52] disabled:opacity-50"
            >
              <ClipboardList className="h-4 w-4" />
              {seleccion.size === 0
                ? "Abrir conteo de todo el inventario"
                : `Abrir conteo de ${seleccion.size} referencia(s)`}
            </button>
            <p className="mt-2 text-xs text-stone-400">
              Al abrirlo se guarda una foto de lo que dice el sistema, para comparar contra lo
              contado.
            </p>
          </Card>
        </div>
      )}

      {/* ── Registrar lo contado ── */}
      {vista === "conteo" && abierto && (
        <div className="space-y-4">
          <Card className="p-0">
            <div className="flex flex-wrap divide-x divide-stone-100">
              <div className="min-w-[150px] flex-1 px-4 py-3">
                <p className="text-[11px] uppercase text-stone-400">Contadas</p>
                <p className="text-xl font-bold text-stone-900">
                  {miles(contadas)}{" "}
                  <span className="text-sm font-normal text-stone-400">
                    de {miles(lineas.length)}
                  </span>
                </p>
              </div>
              <div className="min-w-[150px] flex-1 px-4 py-3">
                <p className="text-[11px] uppercase text-stone-400">Con diferencia</p>
                <p
                  className={`text-xl font-bold ${
                    conDiferencia.length > 0 ? "text-amber-700" : "text-stone-900"
                  }`}
                >
                  {miles(conDiferencia.length)}
                </p>
              </div>
              <div className="min-w-[150px] flex-1 px-4 py-3">
                <p className="text-[11px] uppercase text-stone-400">Diferencia neta</p>
                <p
                  className={`text-xl font-bold ${
                    difUnidades === 0
                      ? "text-stone-900"
                      : difUnidades > 0
                        ? "text-emerald-700"
                        : "text-red-700"
                  }`}
                >
                  {conSigno(difUnidades)}
                </p>
              </div>
              <div className="min-w-[150px] flex-1 px-4 py-3">
                <p className="text-[11px] uppercase text-stone-400">Abierto por</p>
                <p className="mt-1 text-sm font-semibold text-stone-800">
                  {abierto.abierto_nombre ?? "—"}
                </p>
                <p className="text-xs text-stone-400">{abierto.fecha}</p>
              </div>
            </div>
          </Card>

          {conDiferencia.length > 0 && (
            <Card className="border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-2 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">
                    {conDiferencia.length} línea(s) no coinciden con el sistema
                  </p>
                  <p className="text-xs">
                    Al cerrar el conteo se ajustará el inventario con esas diferencias
                    ({conSigno(difUnidades)} unidades en total).
                  </p>
                </div>
              </div>
            </Card>
          )}

          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-stone-700">
                Conteo {abierto.numero}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                  <input
                    className={`${filtroCls} pl-8`}
                    value={buscaLinea}
                    onChange={(e) => setBuscaLinea(e.target.value)}
                    placeholder="Referencia o talla"
                  />
                </div>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-stone-600">
                  <input
                    type="checkbox"
                    checked={soloDif}
                    onChange={(e) => setSoloDif(e.target.checked)}
                    className="h-3.5 w-3.5 cursor-pointer accent-[#344966]"
                  />
                  Solo diferencias
                </label>
                <button
                  onClick={imprimirPlanilla}
                  className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50"
                >
                  <Printer className="h-3 w-3" /> Planilla
                </button>
              </div>
            </div>

            <div className="max-h-[520px] overflow-auto rounded-xl border border-stone-100">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="sticky top-0 bg-stone-50">
                  <tr>
                    {["Referencia", "Talla", "Sistema", "Físico", "Diferencia", "Observacion"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-3 py-2 text-left text-xs font-semibold uppercase text-stone-500"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {lineasVisibles.map((d: ConteoFisicoDetalleRow) => {
                    const v = fisico[d.id]
                    const contada = v !== undefined && v !== ""
                    const dif = contada ? Number(v) - d.cantidad_sistema : 0
                    return (
                      <tr
                        key={d.id}
                        className={`border-t border-stone-100 ${
                          contada && dif !== 0 ? "bg-amber-50/60" : ""
                        }`}
                      >
                        <td className="px-3 py-1.5 font-semibold text-stone-800">
                          {d.referencia}
                        </td>
                        <td className="px-3 py-1.5 text-stone-700">{d.talla}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-stone-600">
                          {miles(d.cantidad_sistema)}
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={v ?? ""}
                            onChange={(e) =>
                              setFisico((p) => ({ ...p, [d.id]: e.target.value }))
                            }
                            className={`w-24 rounded-lg border px-2 py-1 text-right text-sm outline-none focus:ring-2 focus:ring-[#344966] ${
                              contada && dif !== 0
                                ? "border-amber-400 bg-amber-50"
                                : "border-stone-200"
                            }`}
                            placeholder="—"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {contada ? (
                            <span
                              className={`font-mono text-sm font-semibold ${
                                dif === 0
                                  ? "text-stone-400"
                                  : dif > 0
                                    ? "text-emerald-700"
                                    : "text-red-700"
                              }`}
                            >
                              {dif === 0 ? "✓" : conSigno(dif)}
                            </span>
                          ) : (
                            <span className="text-xs text-stone-300">sin contar</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            value={notas[d.id] ?? ""}
                            onChange={(e) =>
                              setNotas((p) => ({ ...p, [d.id]: e.target.value }))
                            }
                            className="w-full rounded-lg border border-stone-200 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-[#344966]"
                            placeholder={dif !== 0 ? "Motivo de la diferencia" : ""}
                          />
                        </td>
                      </tr>
                    )
                  })}
                  {lineasVisibles.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-sm text-stone-400">
                        {soloDif ? "No hay diferencias registradas" : "Sin líneas"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => guardar()}
                disabled={isPending}
                className="flex items-center gap-2 rounded-xl bg-[#344966] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a3b52] disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> Guardar avance
              </button>

              {esAdmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      disabled={isPending || contadas === 0}
                      className="flex items-center gap-2 rounded-xl bg-[#15803d] px-4 py-2 text-sm font-medium text-white hover:bg-[#166534] disabled:opacity-50"
                    >
                      <Lock className="h-4 w-4" /> Cerrar y cuadrar inventario
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cerrar el conteo {abierto.numero}</AlertDialogTitle>
                      <AlertDialogDescription>
                        Se ajustará el inventario de {conDiferencia.length} línea(s) con
                        diferencia ({conSigno(difUnidades)} unidades). Las{" "}
                        {miles(lineas.length - contadas)} línea(s) sin contar quedan como están.
                        El conteo no se podrá volver a editar.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={cerrar}>Cerrar y ajustar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {esAdmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm text-red-700 hover:bg-red-50">
                      <Ban className="h-4 w-4" /> Anular
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Anular el conteo {abierto.numero}</AlertDialogTitle>
                      <AlertDialogDescription>
                        El conteo se descarta sin tocar el inventario.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => anular(abierto.id)}>
                        Anular
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            {!esAdmin && (
              <p className="mt-2 text-xs text-stone-400">
                Solo el administrador puede cerrar el conteo y ajustar el inventario.
              </p>
            )}
          </Card>
        </div>
      )}

      {/* ── Historial ── */}
      {vista === "historial" && (
        <div className="space-y-3">
          {conteos.length === 0 ? (
            <Card className="p-12 text-center">
              <History className="mx-auto mb-3 h-10 w-10 text-stone-300" />
              <p className="text-sm text-stone-400">Todavía no se ha hecho ningún conteo.</p>
            </Card>
          ) : (
            <Card className="p-0">
              <div className="max-h-[620px] overflow-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="sticky top-0 bg-stone-50">
                    <tr className="border-b border-stone-200">
                      {[
                        "",
                        "Conteo",
                        "Fecha",
                        "Estado",
                        "Lineas",
                        "Con dif.",
                        "Diferencia",
                        "Abrio",
                        "Cerro",
                      ].map((h, i) => (
                        <th
                          key={`${h}_${i}`}
                          className="px-3 py-2 text-left text-xs font-semibold uppercase text-stone-500"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {conteos.map((c) => {
                      const ab = abiertas.has(c.id)
                      const difs = c.detalle.filter(
                        (d) =>
                          d.cantidad_fisica != null &&
                          d.cantidad_fisica !== d.cantidad_sistema
                      )
                      return (
                        <React.Fragment key={c.id}>
                          <tr
                            onClick={() => alternarHistorial(c.id)}
                            className={`cursor-pointer border-b border-stone-100 hover:bg-stone-50 ${
                              ab ? "bg-[#344966]/5" : ""
                            }`}
                          >
                            <td className="px-3 py-2 text-stone-400">
                              {ab ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono font-semibold text-stone-800">
                              {c.numero}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs text-stone-600">
                              {c.fecha}
                            </td>
                            <td className="px-3 py-2">
                              <Badge className={ESTADO_CF_COLOR[c.estado]}>
                                {ESTADO_CF_LABEL[c.estado]}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-stone-700">{miles(c.total_lineas)}</td>
                            <td className="px-3 py-2">
                              <span
                                className={
                                  c.lineas_con_dif > 0
                                    ? "font-semibold text-amber-700"
                                    : "text-stone-400"
                                }
                              >
                                {miles(c.lineas_con_dif)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span
                                className={`font-mono font-semibold ${
                                  c.diferencia_total === 0
                                    ? "text-stone-400"
                                    : c.diferencia_total > 0
                                      ? "text-emerald-700"
                                      : "text-red-700"
                                }`}
                              >
                                {conSigno(c.diferencia_total)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs text-stone-600">
                              {c.abierto_nombre ?? "—"}
                              <span className="block text-[10px] text-stone-400">
                                {new Date(c.abierto_en).toLocaleString("es-CO", {
                                  timeZone: "America/Bogota",
                                })}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs text-stone-600">
                              {c.cerrado_nombre ?? "—"}
                              {c.cerrado_en && (
                                <span className="block text-[10px] text-stone-400">
                                  {new Date(c.cerrado_en).toLocaleString("es-CO", {
                                    timeZone: "America/Bogota",
                                  })}
                                </span>
                              )}
                            </td>
                          </tr>

                          {ab && (
                            <tr className="border-b border-stone-100 bg-stone-50/60">
                              <td colSpan={9} className="px-3 py-3">
                                {c.observacion && (
                                  <p className="mb-2 text-xs text-stone-500">
                                    {c.observacion}
                                  </p>
                                )}
                                <p className="mb-1 text-[11px] font-semibold uppercase text-stone-500">
                                  Diferencias ({difs.length})
                                </p>
                                {difs.length === 0 ? (
                                  <p className="text-xs text-stone-400">
                                    Este conteo no encontró diferencias.
                                  </p>
                                ) : (
                                  <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                                    <table className="w-full text-xs">
                                      <thead className="bg-stone-50">
                                        <tr>
                                          {[
                                            "Referencia",
                                            "Talla",
                                            "Sistema",
                                            "Fisico",
                                            "Diferencia",
                                            "Observacion",
                                          ].map((h) => (
                                            <th
                                              key={h}
                                              className="px-3 py-1.5 text-left font-semibold uppercase text-stone-500"
                                            >
                                              {h}
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {difs.map((d) => {
                                          const dif =
                                            Number(d.cantidad_fisica) - d.cantidad_sistema
                                          return (
                                            <tr key={d.id} className="border-t border-stone-100">
                                              <td className="px-3 py-1.5 font-semibold text-stone-800">
                                                {d.referencia}
                                              </td>
                                              <td className="px-3 py-1.5 text-stone-700">
                                                {d.talla}
                                              </td>
                                              <td className="px-3 py-1.5 text-right tabular-nums text-stone-600">
                                                {miles(d.cantidad_sistema)}
                                              </td>
                                              <td className="px-3 py-1.5 text-right tabular-nums text-stone-800">
                                                {miles(Number(d.cantidad_fisica))}
                                              </td>
                                              <td
                                                className={`px-3 py-1.5 text-right font-mono font-semibold ${
                                                  dif > 0 ? "text-emerald-700" : "text-red-700"
                                                }`}
                                              >
                                                {conSigno(dif)}
                                              </td>
                                              <td className="px-3 py-1.5 text-stone-500">
                                                {d.observacion ?? "—"}
                                              </td>
                                            </tr>
                                          )
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
