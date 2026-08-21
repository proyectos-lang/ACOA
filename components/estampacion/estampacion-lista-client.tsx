"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { CheckCircle2, AlertTriangle, UserCheck, PackageCheck, X } from "lucide-react"
import type { LoteConInfo } from "@/lib/db/lote"
import type { EstampadorRow } from "@/lib/db/estampador"
import {
  asignarEstampadorMasivoAction,
  recepcionMasivaAction,
  marcarEntregaMasivaAction,
} from "@/app/(dashboard)/estampacion/actions"
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

export function EstampacionListaClient({
  lotes,
  estampadores,
}: {
  lotes: LoteConInfo[]
  estampadores: EstampadorRow[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)
  const [seleccion, setSeleccion] = React.useState<Set<number>>(new Set())
  const [estampadorSel, setEstampadorSel] = React.useState("")
  const [fechaEntregaSel, setFechaEntregaSel] = React.useState("")

  // ── Filtros ────────────────────────────────────────────────────
  const [fLote, setFLote] = React.useState("")
  const [fOP, setFOP] = React.useState("")
  const [fEstampador, setFEstampador] = React.useState("todos")
  const [fEstado, setFEstado] = React.useState("todos")
  const [fEntregaDesde, setFEntregaDesde] = React.useState("")
  const [fEntregaHasta, setFEntregaHasta] = React.useState("")
  const [fRetornoDesde, setFRetornoDesde] = React.useState("")
  const [fRetornoHasta, setFRetornoHasta] = React.useState("")

  const hayFiltros =
    fLote || fOP || fEstampador !== "todos" || fEstado !== "todos" ||
    fEntregaDesde || fEntregaHasta || fRetornoDesde || fRetornoHasta

  function limpiarFiltros() {
    setFLote(""); setFOP(""); setFEstampador("todos"); setFEstado("todos")
    setFEntregaDesde(""); setFEntregaHasta(""); setFRetornoDesde(""); setFRetornoHasta("")
  }

  // Estampadores para el filtro: los del módulo + los que ya figuran en lotes
  const nombresEstampadorFiltro = React.useMemo(() => {
    const set = new Set<string>(estampadores.map((e) => e.nombre_completo))
    for (const l of lotes) {
      if (l.estampacion?.nombre_estampador) set.add(l.estampacion.nombre_estampador)
    }
    return [...set].sort((a, b) => a.localeCompare(b, "es"))
  }, [estampadores, lotes])

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
      if (fEstampador === "sin_asignar") {
        if (l.estampacion?.nombre_estampador) return false
      } else if (fEstampador !== "todos") {
        if (l.estampacion?.nombre_estampador !== fEstampador) return false
      }
      if (fEstado === "por_asignar" && l.estampacion?.nombre_estampador) return false
      if (fEstado === "en_estampacion" && !l.estampacion?.nombre_estampador) return false
      const fe = l.estampacion?.fecha_entrega_lote
      if (fEntregaDesde && (!fe || fe < fEntregaDesde)) return false
      if (fEntregaHasta && (!fe || fe > fEntregaHasta)) return false
      const fr = l.estampacion?.fecha_retorno_lote
      if (fRetornoDesde && (!fr || fr < fRetornoDesde)) return false
      if (fRetornoHasta && (!fr || fr > fRetornoHasta)) return false
      return true
    })
  }, [lotes, fLote, fOP, fEstampador, fEstado, fEntregaDesde, fEntregaHasta, fRetornoDesde, fRetornoHasta])

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
    startTransition(async () => {
      const res = await asignarEstampadorMasivoAction([...seleccion], estampadorSel)
      if (res.error) showToast("error", res.error)
      else {
        showToast("ok", `Estampador asignado a ${res.procesados} lote(s)`)
        setSeleccion(new Set())
        router.refresh()
      }
    })
  }

  function handleRecepcion() {
    startTransition(async () => {
      const res = await recepcionMasivaAction([...seleccion])
      if (res.error) showToast("error", res.error)
      else {
        showToast("ok", `Recepción registrada: ${res.procesados} lote(s) enviados a Costura`)
        setSeleccion(new Set())
        router.refresh()
      }
    })
  }

  function handleMarcarEntrega() {
    startTransition(async () => {
      const res = await marcarEntregaMasivaAction([...seleccion], fechaEntregaSel)
      if (res.error) showToast("error", res.error)
      else {
        showToast("ok", `Fecha de entrega marcada en ${res.procesados} lote(s)`)
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
            <label className="text-xs font-medium text-stone-500">Estampador</label>
            <select
              value={fEstampador}
              onChange={(e) => setFEstampador(e.target.value)}
              className="rounded-xl border border-stone-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
            >
              <option value="todos">Todos</option>
              <option value="sin_asignar">Sin asignar</option>
              {nombresEstampadorFiltro.map((n) => (
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
              <option value="en_estampacion">En estampación</option>
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
              value={estampadorSel}
              onChange={(e) => setEstampadorSel(e.target.value)}
              className="rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
            >
              <option value="">— Estampador —</option>
              {estampadores.map((e) => (
                <option key={e.id} value={e.nombre_completo}>{e.nombre_completo}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAsignar}
              disabled={isPending || !estampadorSel}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: "#344966" }}
            >
              <UserCheck className="h-4 w-4" />
              {isPending ? "Asignando…" : "Asignar estampador"}
            </button>
            <div className="flex items-center gap-1.5 border-l border-stone-200 pl-2">
              <input
                type="date"
                value={fechaEntregaSel}
                onChange={(e) => setFechaEntregaSel(e.target.value)}
                className="rounded-xl border border-stone-200 px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
                title="Fecha de entrega al estampador"
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
                    <strong>Costura</strong>.
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
                {["Imagen", "Lote", "OP / Referencia", "Cantidad", "Estampador", "Precio est.", "F. entrega", "F. retorno", "Estado", ""].map((h) => (
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
                  <td colSpan={11} className="px-4 py-8 text-center text-sm text-stone-400">
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
                  <td className="px-3 py-2 font-mono font-semibold text-stone-700 whitespace-nowrap">
                    {padLote(lote.numero_lote)}
                    {lote.descripcion && (
                      <span className="block font-sans font-normal text-xs text-stone-400">{lote.descripcion}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-stone-800">{lote.orden.referencia}</p>
                    <p className="text-xs text-stone-400 font-mono">{padOP(lote.orden.numero_op)}</p>
                  </td>
                  <td className="px-3 py-2 font-mono text-stone-700">
                    {lote.cantidad_programada.toLocaleString("es-CO")}
                  </td>
                  <td className="px-3 py-2 text-stone-600 text-xs">
                    {lote.estampacion?.nombre_estampador ?? (
                      <span className="text-stone-400 italic">Sin asignar</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-stone-600">
                    {lote.estampacion?.precio_estampacion != null
                      ? cop(Number(lote.estampacion.precio_estampacion))
                      : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-stone-600">
                    {lote.estampacion?.fecha_entrega_lote ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-stone-600">
                    {lote.estampacion?.fecha_retorno_lote ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {!lote.estampacion?.nombre_estampador ? (
                      <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 whitespace-nowrap">
                        Por asignar
                      </span>
                    ) : (
                      <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-pink-100 text-pink-800 whitespace-nowrap">
                        En estampación
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/estampacion/${lote.id}`}
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
