"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { CheckCircle2, AlertTriangle, UserCheck, PackageCheck, X, Printer } from "lucide-react"
import type { LoteConConfeccion } from "@/lib/db/confeccion"
import type { ConfeccionistaRow } from "@/lib/db/confeccionista"
import {
  asignarConfeccionistaMasivoAction,
  recepcionConfeccionMasivaAction,
  marcarEntregaConfeccionMasivaAction,
  marcarFechaEstimadaConfeccionMasivaAction,
} from "@/app/(dashboard)/confeccion/actions"
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

function padLote(n: number) {
  return `LOTE-${String(n).padStart(4, "0")}`
}
function padOP(n: number) {
  return `OP-${String(n).padStart(4, "0")}`
}
function cop(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n)
}

function hoyBogota(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
}

// Días desde hoy hasta la fecha (negativo = vencida)
function diasHasta(fecha: string): number {
  const hoy = new Date(hoyBogota() + "T00:00:00")
  const f = new Date(fecha + "T00:00:00")
  return Math.round((f.getTime() - hoy.getTime()) / 86400000)
}

// Alerta de vencimiento para lotes aún no devueltos
function alertaVencimiento(l: LoteConConfeccion): "vencido" | "proximo" | null {
  const est = l.confeccion?.fecha_estimada_entrega
  if (!est || l.confeccion?.fecha_retorno_lote) return null
  const d = diasHasta(est)
  if (d < 0) return "vencido"
  if (d <= 2) return "proximo"
  return null
}

// ─── Relación de envío al confeccionista (PDF imprimible) ────────────────────────

function generarRelacionEnvio(
  nombreConfeccionista: string,
  seleccionados: LoteConConfeccion[],
  fechaEntrega: string
) {
  const esc = (s: string | null | undefined) =>
    (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  const totalUds = seleccionados.reduce((s, l) => s + l.cantidad_programada, 0)

  const filas = seleccionados
    .map(
      (l) => `<tr>
        <td class="img-cell">${
          l.url_imagen
            ? `<img src="${esc(l.url_imagen)}" alt="Lote ${l.numero_lote}" />`
            : `<div class="sin-img">Sin imagen</div>`
        }</td>
        <td class="izq">
          <strong>${esc(l.descripcion) || padLote(l.numero_lote)}</strong>
        </td>
        <td>${padOP(l.orden.numero_op)}</td>
        <td class="izq">${esc(l.orden.referencia)}</td>
        <td class="num">${l.cantidad_programada.toLocaleString("es-CO")}</td>
        <td>${esc(l.confeccion?.fecha_estimada_entrega) || "—"}</td>
        <td class="izq sub">${esc(l.notas_diseno) || "—"}</td>
      </tr>`
    )
    .join("")

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Relación de envío — ${esc(nombreConfeccionista)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; padding: 24px; }
  .encabezado { border: 2px solid #111; margin-bottom: 14px; }
  .encabezado .titulo { background: #f2e14c; font-weight: bold; font-size: 14px; padding: 6px 10px; border-bottom: 2px solid #111; }
  .encabezado table { width: 100%; border-collapse: collapse; }
  .encabezado td { border: 1px solid #111; padding: 5px 8px; }
  .encabezado td.label { font-weight: bold; background: #eee; width: 160px; text-transform: uppercase; }
  table.detalle { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  table.detalle th, table.detalle td { border: 1px solid #111; padding: 5px 6px; text-align: center; vertical-align: middle; }
  table.detalle th { background: #eee; text-transform: uppercase; font-size: 10px; }
  td.izq { text-align: left; }
  td.num { text-align: right; font-family: 'Courier New', monospace; font-weight: bold; }
  .sub { color: #555; font-size: 10px; }
  .img-cell { width: 90px; }
  .img-cell img { width: 80px; height: 80px; object-fit: contain; }
  .sin-img { width: 80px; height: 80px; border: 1px dashed #bbb; color: #999; font-size: 9px; display: flex; align-items: center; justify-content: center; margin: 0 auto; }
  tr.total td { background: #dcefe4; font-weight: bold; }
  .firmas { display: flex; gap: 40px; margin-top: 40px; }
  .firmas div { flex: 1; border-top: 1px solid #111; padding-top: 6px; text-align: center; font-size: 11px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="encabezado">
    <div class="titulo">RELACIÓN DE ENVÍO A CONFECCIÓN</div>
    <table>
      <tr><td class="label">Confeccionista</td><td>${esc(nombreConfeccionista)}</td></tr>
      <tr><td class="label">Fecha de entrega</td><td>${esc(fechaEntrega)}</td></tr>
      <tr><td class="label">Lotes enviados</td><td>${seleccionados.length}</td></tr>
      <tr><td class="label">Total unidades</td><td>${totalUds.toLocaleString("es-CO")}</td></tr>
    </table>
  </div>

  <table class="detalle">
    <thead>
      <tr>
        <th>Imagen</th><th>Lote</th><th>OP</th><th>Referencia</th><th>Cantidad</th><th>F. estimada entrega</th><th>Notas de diseño</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
    <tfoot>
      <tr class="total">
        <td colspan="4" class="izq">TOTAL</td>
        <td class="num">${totalUds.toLocaleString("es-CO")}</td>
        <td></td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  <div class="firmas">
    <div>Entrega (Vanessa)</div>
    <div>Recibe (${esc(nombreConfeccionista)})</div>
  </div>

  <script>
    // Imprime cuando las imágenes hayan cargado
    window.addEventListener("load", function () {
      setTimeout(function () { window.print() }, 250)
    })
  </script>
</body>
</html>`

  const w = window.open("", "_blank")
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
}

export function ConfeccionListaClient({
  lotes,
  confeccionistas,
}: {
  lotes: LoteConConfeccion[]
  confeccionistas: ConfeccionistaRow[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)
  const [seleccion, setSeleccion] = React.useState<Set<number>>(new Set())
  const [confeccionistaSel, setConfeccionistaSel] = React.useState("")
  const [fechaEntregaSel, setFechaEntregaSel] = React.useState("")
  const [fechaEstimadaSel, setFechaEstimadaSel] = React.useState("")

  // ── Filtros ────────────────────────────────────────────────────
  const [fLote, setFLote] = React.useState("")
  const [fOP, setFOP] = React.useState("")
  const [fConfeccionista, setFConfeccionista] = React.useState("todos")
  const [fEstado, setFEstado] = React.useState("todos")
  const [fEntregaDesde, setFEntregaDesde] = React.useState("")
  const [fEntregaHasta, setFEntregaHasta] = React.useState("")
  const [fRetornoDesde, setFRetornoDesde] = React.useState("")
  const [fRetornoHasta, setFRetornoHasta] = React.useState("")

  const hayFiltros =
    fLote || fOP || fConfeccionista !== "todos" || fEstado !== "todos" ||
    fEntregaDesde || fEntregaHasta || fRetornoDesde || fRetornoHasta

  function limpiarFiltros() {
    setFLote(""); setFOP(""); setFConfeccionista("todos"); setFEstado("todos")
    setFEntregaDesde(""); setFEntregaHasta(""); setFRetornoDesde(""); setFRetornoHasta("")
  }

  // Confeccionistaes para el filtro: los del módulo + los que ya figuran en lotes
  const nombresConfeccionistaFiltro = React.useMemo(() => {
    const set = new Set<string>(confeccionistas.map((e) => e.nombre_completo))
    for (const l of lotes) {
      if (l.confeccion?.nombre_confeccionista) set.add(l.confeccion.nombre_confeccionista)
    }
    return [...set].sort((a, b) => a.localeCompare(b, "es"))
  }, [confeccionistas, lotes])

  const lotesFiltrados = React.useMemo(() => {
    return lotes.filter((l) => {
      if (fLote) {
        const q = fLote.toLowerCase()
        const target = `${padLote(l.numero_lote)} ${l.numero_lote} ${l.descripcion ?? ""}`.toLowerCase()
        if (!target.includes(q)) return false
      }
      if (fOP) {
        const q = fOP.toLowerCase()
        const target = `${padOP(l.orden.numero_op)} ${l.orden.numero_op} ${l.orden.referencia}`.toLowerCase()
        if (!target.includes(q)) return false
      }
      if (fConfeccionista === "sin_asignar") {
        if (l.confeccion?.nombre_confeccionista) return false
      } else if (fConfeccionista !== "todos") {
        if (l.confeccion?.nombre_confeccionista !== fConfeccionista) return false
      }
      if (fEstado === "por_asignar" && l.confeccion?.nombre_confeccionista) return false
      if (fEstado === "en_estampacion" && !l.confeccion?.nombre_confeccionista) return false
      const fe = l.confeccion?.fecha_entrega_lote
      if (fEntregaDesde && (!fe || fe < fEntregaDesde)) return false
      if (fEntregaHasta && (!fe || fe > fEntregaHasta)) return false
      const fr = l.confeccion?.fecha_retorno_lote
      if (fRetornoDesde && (!fr || fr < fRetornoDesde)) return false
      if (fRetornoHasta && (!fr || fr > fRetornoHasta)) return false
      return true
    })
  }, [lotes, fLote, fOP, fConfeccionista, fEstado, fEntregaDesde, fEntregaHasta, fRetornoDesde, fRetornoHasta])

  function showToast(tipo: "ok" | "error", msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const todosSeleccionados =
    lotesFiltrados.length > 0 && lotesFiltrados.every((l) => seleccion.has(l.id))

  function toggleTodos() {
    setSeleccion(todosSeleccionados ? new Set() : new Set(lotesFiltrados.map((l) => l.id)))
  }

  function toggleUno(id: number) {
    setSeleccion((p) => {
      const next = new Set(p)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleAsignar() {
    const asignados = lotes.filter((l) => seleccion.has(l.id))
    const nombre = confeccionistaSel
    startTransition(async () => {
      const res = await asignarConfeccionistaMasivoAction([...seleccion], nombre)
      if (res.error) showToast("error", res.error)
      else {
        showToast("ok", `Confeccionista asignado a ${res.procesados} lote(s) — generando relación de envío`)
        setSeleccion(new Set())
        // Relación de envío en PDF con los lotes recién asignados
        generarRelacionEnvio(
          nombre,
          asignados,
          new Date().toLocaleDateString("es-CO", { timeZone: "America/Bogota" })
        )
        router.refresh()
      }
    })
  }

  // Reimprimir la relación para los lotes seleccionados
  function handleImprimirRelacion() {
    const seleccionados = lotes.filter((l) => seleccion.has(l.id))
    const nombres = new Set(
      seleccionados
        .map((l) => confeccionistaSel || l.confeccion?.nombre_confeccionista || "")
        .filter(Boolean)
    )
    if (nombres.size === 0) {
      showToast("error", "Selecciona un confeccionista o lotes que ya lo tengan asignado")
      return
    }
    if (nombres.size > 1) {
      showToast("error", "Los lotes seleccionados tienen confeccionistas distintos — genera una relación por confeccionista")
      return
    }
    generarRelacionEnvio(
      [...nombres][0],
      seleccionados,
      seleccionados[0]?.confeccion?.fecha_entrega_lote ??
        new Date().toLocaleDateString("es-CO", { timeZone: "America/Bogota" })
    )
  }

  function handleRecepcion() {
    startTransition(async () => {
      const res = await recepcionConfeccionMasivaAction([...seleccion])
      if (res.error) showToast("error", res.error)
      else {
        showToast("ok", `Recepción registrada: ${res.procesados} lote(s) enviados a Conteo`)
        setSeleccion(new Set())
        router.refresh()
      }
    })
  }

  function handleMarcarEntrega() {
    startTransition(async () => {
      const res = await marcarEntregaConfeccionMasivaAction([...seleccion], fechaEntregaSel)
      if (res.error) showToast("error", res.error)
      else {
        showToast("ok", `Fecha de entrega marcada en ${res.procesados} lote(s)`)
        setSeleccion(new Set())
        router.refresh()
      }
    })
  }

  function handleMarcarEstimada() {
    startTransition(async () => {
      const res = await marcarFechaEstimadaConfeccionMasivaAction([...seleccion], fechaEstimadaSel)
      if (res.error) showToast("error", res.error)
      else {
        showToast("ok", `Fecha estimada marcada en ${res.procesados} lote(s)`)
        setSeleccion(new Set())
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
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

      {/* Filtros */}
      <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-500">Lote</label>
            <input
              type="text"
              value={fLote}
              onChange={(e) => setFLote(e.target.value)}
              placeholder="Nº o descripción…"
              className="rounded-xl border border-stone-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#344966] w-36"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-500">OP / Referencia</label>
            <input
              type="text"
              value={fOP}
              onChange={(e) => setFOP(e.target.value)}
              placeholder="Nº OP o referencia…"
              className="rounded-xl border border-stone-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#344966] w-40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-500">Confeccionista</label>
            <select
              value={fConfeccionista}
              onChange={(e) => setFConfeccionista(e.target.value)}
              className="rounded-xl border border-stone-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
            >
              <option value="todos">Todos</option>
              <option value="sin_asignar">Sin asignar</option>
              {nombresConfeccionistaFiltro.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-500">Estado</label>
            <select
              value={fEstado}
              onChange={(e) => setFEstado(e.target.value)}
              className="rounded-xl border border-stone-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
            >
              <option value="todos">Todos</option>
              <option value="por_asignar">Por asignar</option>
              <option value="en_estampacion">En confección</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-500">F. entrega (desde / hasta)</label>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={fEntregaDesde}
                onChange={(e) => setFEntregaDesde(e.target.value)}
                className="rounded-xl border border-stone-200 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#344966]"
              />
              <input
                type="date"
                value={fEntregaHasta}
                onChange={(e) => setFEntregaHasta(e.target.value)}
                className="rounded-xl border border-stone-200 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#344966]"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-500">F. retorno (desde / hasta)</label>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={fRetornoDesde}
                onChange={(e) => setFRetornoDesde(e.target.value)}
                className="rounded-xl border border-stone-200 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#344966]"
              />
              <input
                type="date"
                value={fRetornoHasta}
                onChange={(e) => setFRetornoHasta(e.target.value)}
                className="rounded-xl border border-stone-200 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#344966]"
              />
            </div>
          </div>
          {hayFiltros && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium border border-stone-200 text-stone-500 hover:bg-stone-50 transition-colors"
            >
              <X className="h-3.5 w-3.5" /> Limpiar
            </button>
          )}
          <span className="ml-auto text-xs text-stone-400 self-center">
            {lotesFiltrados.length} de {lotes.length} lote{lotes.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Barra de acciones masivas */}
      {seleccion.size > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-stone-700">
            {seleccion.size} lote{seleccion.size !== 1 ? "s" : ""} seleccionado{seleccion.size !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            <select
              value={confeccionistaSel}
              onChange={(e) => setConfeccionistaSel(e.target.value)}
              className="rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
            >
              <option value="">— Confeccionista —</option>
              {confeccionistas.map((e) => (
                <option key={e.id} value={e.nombre_completo}>{e.nombre_completo}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAsignar}
              disabled={isPending || !confeccionistaSel}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: "#344966" }}
            >
              <UserCheck className="h-4 w-4" />
              {isPending ? "Asignando…" : "Asignar confeccionista"}
            </button>
            <div className="flex items-center gap-1.5 border-l border-stone-200 pl-2">
              <input
                type="date"
                value={fechaEntregaSel}
                onChange={(e) => setFechaEntregaSel(e.target.value)}
                className="rounded-xl border border-stone-200 px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
                title="Fecha de entrega al confeccionista"
              />
              <button
                type="button"
                onClick={handleMarcarEntrega}
                disabled={isPending || !fechaEntregaSel}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: "#b45309" }}
              >
                {isPending ? "Marcando…" : "Marcar entrega"}
              </button>
            </div>
            <div className="flex items-center gap-1.5 border-l border-stone-200 pl-2">
              <input
                type="date"
                value={fechaEstimadaSel}
                onChange={(e) => setFechaEstimadaSel(e.target.value)}
                className="rounded-xl border border-stone-200 px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
                title="Fecha estimada de entrega (devolución del confeccionista)"
              />
              <button
                type="button"
                onClick={handleMarcarEstimada}
                disabled={isPending || !fechaEstimadaSel}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: "#7c3aed" }}
              >
                {isPending ? "Marcando…" : "Marcar estimada"}
              </button>
            </div>
            <button
              type="button"
              onClick={handleImprimirRelacion}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold border border-[#344966] text-[#344966] hover:bg-[#344966] hover:text-white transition-colors disabled:opacity-50"
              title="Genera la relación de envío en PDF de los lotes seleccionados"
            >
              <Printer className="h-4 w-4" />
              Relación PDF
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: "#15803d" }}
                >
                  <PackageCheck className="h-4 w-4" />
                  Registrar recepción
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Registrar recepción?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se registrará la fecha de retorno de {seleccion.size} lote(s) y pasarán a{" "}
                    <strong>Conteo</strong>.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRecepcion} className="rounded-xl text-white" style={{ backgroundColor: "#15803d" }}>
                    Confirmar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}

      {/* Alertas de vencimiento por fecha estimada de entrega */}
      {(() => {
        const vencidos = lotesFiltrados.filter((l) => alertaVencimiento(l) === "vencido").length
        const proximos = lotesFiltrados.filter((l) => alertaVencimiento(l) === "proximo").length
        if (vencidos === 0 && proximos === 0) return null
        return (
          <div
            className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium ${
              vencidos > 0
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-amber-50 border-amber-200 text-amber-800"
            }`}
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {vencidos > 0 && (
              <span>
                {vencidos} lote{vencidos !== 1 ? "s" : ""} con fecha estimada de entrega vencida
              </span>
            )}
            {vencidos > 0 && proximos > 0 && <span>·</span>}
            {proximos > 0 && (
              <span>
                {proximos} lote{proximos !== 1 ? "s" : ""} por vencer (≤ 2 días)
              </span>
            )}
          </div>
        )
      })()}

      <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="px-3 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={todosSeleccionados}
                    onChange={toggleTodos}
                    className="h-4 w-4 rounded border-stone-300 accent-[#344966]"
                  />
                </th>
                {["Imagen", "Lote", "OP / Referencia", "Cantidad", "Reconf.", "Confeccionista", "Precio conf.", "F. entrega", "F. estimada", "F. retorno", "Estado", ""].map((h) => (
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
              {lotesFiltrados.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-sm text-stone-400">
                    Ningún lote coincide con los filtros.
                  </td>
                </tr>
              )}
              {lotesFiltrados.map((lote) => (
                <tr
                  key={lote.id}
                  className={`border-b border-stone-100 last:border-0 transition-colors ${
                    seleccion.has(lote.id) ? "bg-blue-50/50" : "hover:bg-stone-50"
                  }`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={seleccion.has(lote.id)}
                      onChange={() => toggleUno(lote.id)}
                      className="h-4 w-4 rounded border-stone-300 accent-[#344966]"
                    />
                  </td>
                  <td className="px-3 py-2">
                    {lote.url_imagen ? (
                      <a href={lote.url_imagen} target="_blank" rel="noopener noreferrer" title="Ver imagen de referencia">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={lote.url_imagen}
                          alt={`Lote ${lote.numero_lote}`}
                          className="h-10 w-10 rounded-lg object-cover border border-stone-200 bg-white"
                        />
                      </a>
                    ) : (
                      <div className="h-10 w-10 rounded-lg border border-dashed border-stone-200 bg-stone-50" />
                    )}
                  </td>
                  <td className="px-3 py-2 font-semibold text-stone-700 whitespace-nowrap">
                    {lote.descripcion ?? padLote(lote.numero_lote)}
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-stone-800">{lote.orden.referencia}</p>
                    <p className="text-xs text-stone-400 font-mono">{padOP(lote.orden.numero_op)}</p>
                  </td>
                  <td className="px-3 py-2 font-mono text-stone-700">
                    {lote.cantidad_programada.toLocaleString("es-CO")}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {lote.confeccion?.cantidad_reconfirmada != null ? (
                      <span
                        className={
                          lote.confeccion.cantidad_reconfirmada !== lote.cantidad_programada
                            ? "text-amber-600 font-semibold"
                            : "text-stone-700"
                        }
                      >
                        {lote.confeccion.cantidad_reconfirmada.toLocaleString("es-CO")}
                        {lote.confeccion.cantidad_reconfirmada !== lote.cantidad_programada && " ⚠"}
                      </span>
                    ) : (
                      <span className="text-stone-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-stone-600 text-xs">
                    {lote.confeccion?.nombre_confeccionista ?? (
                      <span className="text-stone-400 italic">Sin asignar</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-stone-600">
                    {lote.confeccion?.precio_confeccion != null
                      ? cop(Number(lote.confeccion.precio_confeccion))
                      : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-stone-600">
                    {lote.confeccion?.fecha_entrega_lote ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    {lote.confeccion?.fecha_estimada_entrega ? (
                      (() => {
                        const alerta = alertaVencimiento(lote)
                        const d = diasHasta(lote.confeccion!.fecha_estimada_entrega!)
                        return (
                          <span className="inline-flex flex-col gap-0.5">
                            <span className="font-mono text-stone-600">
                              {lote.confeccion!.fecha_estimada_entrega}
                            </span>
                            {alerta === "vencido" && (
                              <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 text-center">
                                Vencido {-d}d
                              </span>
                            )}
                            {alerta === "proximo" && (
                              <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 text-center">
                                {d === 0 ? "Vence hoy" : `Vence en ${d}d`}
                              </span>
                            )}
                          </span>
                        )
                      })()
                    ) : (
                      <span className="font-mono text-stone-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-stone-600">
                    {lote.confeccion?.fecha_retorno_lote ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {!lote.confeccion?.nombre_confeccionista ? (
                      <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 whitespace-nowrap">
                        Por asignar
                      </span>
                    ) : (
                      <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-teal-100 text-teal-800 whitespace-nowrap">
                        En confección
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/confeccion/${lote.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-stone-100 transition-colors text-stone-500 whitespace-nowrap"
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
    </div>
  )
}
