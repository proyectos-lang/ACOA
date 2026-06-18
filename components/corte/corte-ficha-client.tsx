"use client"

import * as React from "react"
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Send,
  ExternalLink,
  Zap,
} from "lucide-react"
import type { OrdenProduccionRow } from "@/lib/db/orden-produccion"
import type { CorteConTelas, CorteTela } from "@/lib/db/corte"
import type { CurvaTallaRow } from "@/lib/db/curva-talla"
import type { OpMaterialRow } from "@/lib/db/op-material"
import type { LoteRow } from "@/lib/db/lote"
import { LOTE_ESTADO_COLOR, LOTE_ESTADO_LABEL } from "@/lib/db/lote"
import {
  guardarInfoCorteAction,
  guardarCortetelaAction,
  actualizarCurvaAction,
  aplicarConsumoRealAction,
  enviarAEstampacionAction,
  crearLoteAction,
  enviarLoteAEstampacionAction,
} from "@/app/(dashboard)/corte/[id]/actions"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

interface Props {
  orden: OrdenProduccionRow
  corte: CorteConTelas | null
  curvaTallas: CurvaTallaRow[]
  opMateriales: OpMaterialRow[]
  lotes: LoteRow[]
}

function padOP(n: number) {
  return `OP-${String(n).padStart(4, "0")}`
}
function padLote(n: number) {
  return `LOTE-${String(n).padStart(4, "0")}`
}
function cop(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 2,
  }).format(n)
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

// ─── Ficha de corte por tela ──────────────────────────────────────────────────

function CorteTelCard({
  corteTela,
  ordenId,
  onMsg,
}: {
  corteTela: CorteTela
  ordenId: number
  onMsg: (m: string) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [nombreTela, setNombreTela] = React.useState(corteTela.nombre_tela)
  const [anchoTela, setAnchoTela] = React.useState(
    corteTela.ancho_tela != null ? String(corteTela.ancho_tela) : ""
  )
  const [rendimiento, setRendimiento] = React.useState(
    corteTela.rendimiento != null ? String(corteTela.rendimiento) : ""
  )
  const [largoTrazo, setLargoTrazo] = React.useState(
    corteTela.largo_trazo != null ? String(corteTela.largo_trazo) : ""
  )
  const [capas, setCapas] = React.useState(
    corteTela.capas != null ? String(corteTela.capas) : ""
  )

  const lt = parseFloat(largoTrazo) || 0
  const nt = parseInt(capas, 10) || 0
  const promedioLive = lt > 0 && nt > 0 ? lt / nt : null

  const consumoEstimado = corteTela.op_material?.consumo_estimado
  const consumoReal = corteTela.op_material?.consumo_real

  function handleSave() {
    startTransition(async () => {
      const res = await guardarCortetelaAction(corteTela.id, ordenId, {
        nombre_tela: nombreTela.trim() || corteTela.nombre_tela,
        ancho_tela: anchoTela ? parseFloat(anchoTela) : null,
        rendimiento: rendimiento ? parseFloat(rendimiento) : null,
        largo_trazo: largoTrazo ? parseFloat(largoTrazo) : null,
        capas: capas ? parseInt(capas, 10) : null,
      })
      if (res.error) onMsg(`Error: ${res.error}`)
      else {
        onMsg(`Ficha guardada: ${nombreTela}`)
        router.refresh()
      }
    })
  }

  const fieldCls =
    "w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-stone-100 pb-2">
        <h3 className="text-sm font-semibold text-stone-800">{corteTela.nombre_tela}</h3>
        <span className="text-xs text-stone-400 font-mono uppercase">
          {corteTela.op_material?.tipo ?? "tela"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-stone-700">Nombre de la tela</label>
          <input
            type="text"
            value={nombreTela}
            onChange={(e) => setNombreTela(e.target.value)}
            className={fieldCls}
            placeholder="Ej: Algodón jersey"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-stone-700">Ancho de tela (m)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={anchoTela}
            onChange={(e) => setAnchoTela(e.target.value)}
            className={fieldCls}
            placeholder="1.50"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-stone-700">Rendimiento</label>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={rendimiento}
            onChange={(e) => setRendimiento(e.target.value)}
            className={fieldCls}
            placeholder="0.8500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-stone-700">Largo del trazo (m)</label>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={largoTrazo}
            onChange={(e) => setLargoTrazo(e.target.value)}
            className={fieldCls}
            placeholder="12.5000"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-stone-700">
            Capas
          </label>
          <input
            type="number"
            min="1"
            step="1"
            value={capas}
            onChange={(e) => setCapas(e.target.value)}
            className={fieldCls}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-stone-700">
            Promedio consumo / prenda
          </label>
          <div className="rounded-xl bg-orange-50 border border-orange-200 px-3 py-2 text-sm font-mono font-bold text-orange-800 h-[42px] flex items-center">
            {promedioLive != null
              ? `${promedioLive.toFixed(4)} m`
              : corteTela.promedio_consumo != null
              ? `${Number(corteTela.promedio_consumo).toFixed(4)} m`
              : "—"}
          </div>
        </div>
      </div>

      {/* Comparación con OP */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-stone-500 border-t border-stone-100 pt-3">
        <span>
          Consumo estimado (OP):{" "}
          <strong className="font-mono text-stone-700">
            {consumoEstimado != null ? `${consumoEstimado} m` : "—"}
          </strong>
        </span>
        {consumoReal != null && (
          <span className="text-orange-700">
            Consumo real aplicado:{" "}
            <strong className="font-mono">{Number(consumoReal).toFixed(4)} m</strong>
          </span>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={isPending}
        className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        style={{ backgroundColor: "#344966" }}
      >
        <Save className="h-3.5 w-3.5" />
        {isPending ? "Guardando…" : "Guardar ficha"}
      </button>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function CorteFichaClient({
  orden,
  corte,
  curvaTallas,
  opMateriales,
  lotes: lotesIniciales,
}: Props) {
  const router = useRouter()
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)

  // ── Curva de tallas ───────────────────────────────────────────
  const [tallas, setTallas] = React.useState<string[]>(() => curvaTallas.map((c) => c.talla))
  const [nuevaTalla, setNuevaTalla] = React.useState("")
  const [isPendingCurva, startCurva] = useTransition()

  // ── Info corte ────────────────────────────────────────────────
  const [isPendingCorte, startCorte] = useTransition()

  // ── Consumo real ──────────────────────────────────────────────
  const [isPendingConsumo, startConsumo] = useTransition()

  // ── Enviar estampación ────────────────────────────────────────
  const [isPendingEstampacion, startEstampacion] = useTransition()

  // ── Lotes ─────────────────────────────────────────────────────
  const [lotes] = React.useState<LoteRow[]>(lotesIniciales)
  const [loteDialogOpen, setLoteDialogOpen] = React.useState(false)
  const [isPendingLote, startLote] = useTransition()
  const totalUnidades = orden.capas * tallas.length

  function showToast(tipo: "ok" | "error", msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 5000)
  }

  // ── Curva de tallas ───────────────────────────────────────────
  function addTalla() {
    const t = nuevaTalla.trim().toUpperCase()
    if (!t || tallas.includes(t)) return
    setTallas((prev) => [...prev, t])
    setNuevaTalla("")
  }
  function removeTalla(t: string) {
    setTallas((prev) => prev.filter((x) => x !== t))
  }
  function handleSaveCurva() {
    startCurva(async () => {
      const res = await actualizarCurvaAction(orden.id, tallas)
      if (res.error) showToast("error", res.error)
      else { showToast("ok", "Curva de tallas guardada"); router.refresh() }
    })
  }

  // ── Info corte ────────────────────────────────────────────────
  function handleSaveInfoCorte(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startCorte(async () => {
      const res = await guardarInfoCorteAction(orden.id, fd)
      if (res.error) showToast("error", res.error)
      else { showToast("ok", "Información de corte guardada"); router.refresh() }
    })
  }

  // ── Aplicar consumo real ──────────────────────────────────────
  function handleAplicarConsumo() {
    startConsumo(async () => {
      const res = await aplicarConsumoRealAction(orden.id)
      if (res.error) showToast("error", res.error)
      else {
        const lineas = res.resumen?.map(
          (r) => `${r.nombre}: ${r.promedio.toFixed(4)} m`
        ) ?? []
        showToast("ok", `Consumo real aplicado. ${lineas.join(" | ")}`)
        router.refresh()
      }
    })
  }

  // ── Enviar a estampación ──────────────────────────────────────
  function handleEnviarEstampacion() {
    startEstampacion(async () => {
      const res = await enviarAEstampacionAction(orden.id)
      if (res.error) showToast("error", res.error)
      else { showToast("ok", "OP enviada a Estampación"); router.refresh() }
    })
  }

  // ── Lotes ─────────────────────────────────────────────────────
  function handleCrearLote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const cantidad = parseInt(fd.get("cantidad_programada") as string, 10)
    const descripcion = (fd.get("descripcion") as string)?.trim() || undefined
    if (!cantidad) return
    startLote(async () => {
      const res = await crearLoteAction({
        orden_id: orden.id,
        cantidad_programada: cantidad,
        descripcion,
      })
      if (res.error) showToast("error", res.error)
      else { setLoteDialogOpen(false); showToast("ok", "Lote creado"); router.refresh() }
    })
  }

  function handleEnviarLoteEstampacion(loteId: number) {
    startLote(async () => {
      const res = await enviarLoteAEstampacionAction(loteId, orden.id)
      if (res.error) showToast("error", res.error)
      else { showToast("ok", "Lote enviado a estampación"); router.refresh() }
    })
  }

  const fieldCls =
    "w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
  const inputSmCls =
    "rounded-lg border border-stone-200 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-[#344966] w-full"

  const corteTelas = corte?.corte_tela ?? []

  // Condiciones para "Enviar a estampación"
  const todasConLargo = corteTelas.length > 0 && corteTelas.every((ct) => ct.largo_trazo && ct.largo_trazo > 0)
  const todoConsumoAplicado = corteTelas.length > 0 && corteTelas.every((ct) => ct.op_material?.consumo_real != null)
  const puedeEnviarEstampacion = todasConLargo && todoConsumoAplicado

  // Hay algún promedio calculado para habilitar "Aplicar consumo real"
  const hayPromedio = corteTelas.some((ct) => ct.promedio_consumo && ct.promedio_consumo > 0)

  return (
    <div className="space-y-6">
      {toast && <Toast tipo={toast.tipo} msg={toast.msg} />}

      {/* ── Cabecera OP ─────────────────────────────────────── */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-stone-700 mb-3 border-b border-stone-100 pb-2">
          Orden de Producción
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-stone-500">Número OP</p>
            <p className="font-mono font-semibold text-stone-800">{padOP(orden.numero_op)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Referencia</p>
            <p className="font-medium text-stone-800">{orden.referencia}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Descripción</p>
            <p className="text-stone-700 text-xs">{orden.descripcion ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Estado</p>
            <p className="font-medium text-stone-700 capitalize">{orden.estado}</p>
          </div>
        </div>
        {orden.url_molde && (
          <div className="mt-3">
            <a
              href={orden.url_molde}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[#344966] hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> Descargar molde
            </a>
          </div>
        )}
      </div>

      {/* ── Info general del corte ───────────────────────────── */}
      <form onSubmit={handleSaveInfoCorte}>
        <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2">
            <h2 className="text-sm font-semibold text-stone-700">Información general del corte</h2>
            {corte && (
              <span className="text-xs font-mono text-stone-500">
                Corte #{corte.consecutivo_corte}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">Fecha programación</label>
              <input
                type="date"
                name="fecha_programacion"
                defaultValue={corte?.fecha_programacion ?? ""}
                className={fieldCls}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">Fecha de corte real</label>
              <input
                type="date"
                name="fecha_corte"
                defaultValue={corte?.fecha_corte ?? ""}
                className={fieldCls}
              />
            </div>
            <div className="space-y-1 sm:col-span-1">
              <label className="text-sm font-medium text-stone-700">Descripción de piezas</label>
              <input
                type="text"
                name="descripcion_piezas"
                defaultValue={corte?.descripcion_piezas ?? ""}
                className={fieldCls}
                placeholder="Delantera, espalda, mangas…"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isPendingCorte}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "#344966" }}
          >
            <Save className="h-3.5 w-3.5" />
            {isPendingCorte ? "Guardando…" : "Guardar información"}
          </button>
        </div>
      </form>

      {/* ── Curva de tallas ─────────────────────────────────── */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3 border-b border-stone-100 pb-2">
          <h2 className="text-sm font-semibold text-stone-700">Curva de tallas</h2>
          <span className="text-xs text-stone-500">
            {tallas.length} tallas · {orden.capas} capas · {totalUnidades.toLocaleString("es-CO")} uds
          </span>
        </div>
        <div className="space-y-3">
          {tallas.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tallas.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => removeTalla(t)}
                    className="ml-0.5 rounded-full hover:bg-stone-200 p-0.5 transition-colors"
                  >
                    <Trash2 className="h-3 w-3 text-stone-500" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={nuevaTalla}
              onChange={(e) => setNuevaTalla(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTalla() } }}
              className="rounded-xl border border-stone-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#344966] w-28"
              placeholder="XS, S, M…"
            />
            <button type="button" onClick={addTalla} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border border-stone-200 hover:bg-stone-50 transition-colors text-stone-600">
              <Plus className="h-3.5 w-3.5" /> Agregar
            </button>
            <button type="button" onClick={handleSaveCurva} disabled={isPendingCurva} className="flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "#344966" }}>
              <Save className="h-3.5 w-3.5" />
              {isPendingCurva ? "Guardando…" : "Guardar tallas"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Fichas de corte por tela ─────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-stone-700 px-1">
          Fichas de corte por tela ({corteTelas.length})
        </h2>

        {corteTelas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-8 text-center">
            <p className="text-sm text-stone-400">
              No hay materiales de tipo "tela" registrados en la OP. Agréguelos en la pestaña de Materiales de la OP.
            </p>
          </div>
        ) : (
          corteTelas.map((ct) => (
            <CorteTelCard
              key={ct.id}
              corteTela={ct}
              ordenId={orden.id}
              onMsg={(m) =>
                showToast(m.startsWith("Error") ? "error" : "ok", m)
              }
            />
          ))
        )}
      </div>

      {/* ── Comparativo de consumos ──────────────────────────── */}
      {corteTelas.length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-stone-700 mb-3 border-b border-stone-100 pb-2">
            Comparativo de consumos
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  {["Tela", "Cons. estimado (OP)", "Cons. real (promedio)", "Diferencia", "Estado"].map(
                    (h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-stone-500 uppercase tracking-wide">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {corteTelas.map((ct) => {
                  const estimado = ct.op_material?.consumo_estimado ?? null
                  const real = ct.promedio_consumo != null ? Number(ct.promedio_consumo) : null
                  const diff = estimado != null && real != null ? real - estimado : null
                  const excede = diff != null && diff > 0

                  return (
                    <tr key={ct.id} className={`border-b border-stone-100 last:border-0 ${excede ? "bg-red-50" : ""}`}>
                      <td className="px-3 py-2 font-medium text-stone-800">{ct.nombre_tela}</td>
                      <td className="px-3 py-2 font-mono text-stone-600">
                        {estimado != null ? `${estimado} m` : "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-stone-600">
                        {real != null ? `${real.toFixed(4)} m` : "—"}
                      </td>
                      <td className={`px-3 py-2 font-mono font-semibold ${excede ? "text-red-700" : diff != null && diff < 0 ? "text-green-700" : "text-stone-400"}`}>
                        {diff != null
                          ? `${diff > 0 ? "+" : ""}${diff.toFixed(4)} m`
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {ct.op_material?.consumo_real != null ? (
                          <span className="rounded-full px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium">
                            Aplicado
                          </span>
                        ) : (
                          <span className="rounded-full px-2 py-0.5 bg-stone-100 text-stone-500 text-xs">
                            Pendiente
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Acciones de consumo y envío */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-stone-100 mt-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  disabled={!hayPromedio || isPendingConsumo}
                  title={
                    !hayPromedio
                      ? "Guarde al menos un largo de trazo para calcular el promedio"
                      : undefined
                  }
                  className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                  style={{ backgroundColor: "#c2410c" }}
                >
                  <Zap className="h-4 w-4" />
                  {isPendingConsumo ? "Aplicando…" : "Aplicar consumo real"}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Aplicar consumo real?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se copiará el promedio de consumo de cada ficha de tela al campo{" "}
                    <em>consumo_real</em> del material correspondiente. Esto recalculará la
                    hoja de costos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleAplicarConsumo}
                    className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    Aplicar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  disabled={!puedeEnviarEstampacion || isPendingEstampacion || orden.estado !== "corte"}
                  title={
                    !todasConLargo
                      ? "Faltan largos de trazo en una o más fichas"
                      : !todoConsumoAplicado
                      ? "Aplique el consumo real primero"
                      : undefined
                  }
                  className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                  style={{ backgroundColor: "#344966" }}
                >
                  <Send className="h-4 w-4" />
                  {isPendingEstampacion ? "Enviando…" : "Enviar a Estampación"}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Enviar a Estampación?</AlertDialogTitle>
                  <AlertDialogDescription>
                    La OP {padOP(orden.numero_op)} pasará al estado "Estampación". Todas las
                    fichas de tela tienen largo de trazo registrado y el consumo real fue
                    aplicado.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleEnviarEstampacion}
                    className="rounded-xl text-white"
                    style={{ backgroundColor: "#344966" }}
                  >
                    Confirmar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}

      {/* ── Materiales de la OP (referencia) ────────────────── */}
      {opMateriales.length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-stone-700 mb-3 border-b border-stone-100 pb-2">
            Materiales de la OP
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-stone-100">
                  {["Tipo", "Material", "Unidad", "Cons. est.", "Cons. real", "V/Prenda"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-stone-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {opMateriales.map((m) => (
                  <tr key={m.id} className="border-b border-stone-100 last:border-0">
                    <td className="px-3 py-2 text-stone-500">{m.tipo}</td>
                    <td className="px-3 py-2 font-medium text-stone-800">{m.nombre}</td>
                    <td className="px-3 py-2 text-stone-500">{m.unidad_medida}</td>
                    <td className="px-3 py-2 font-mono text-stone-600">{m.consumo_estimado ?? "—"}</td>
                    <td className={`px-3 py-2 font-mono ${m.consumo_real != null ? "text-orange-700 font-semibold" : "text-stone-400"}`}>
                      {m.consumo_real != null ? Number(m.consumo_real).toFixed(4) : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono font-semibold text-stone-800">
                      {cop(Number(m.valor_por_prenda))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Lotes ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3 border-b border-stone-100 pb-2">
          <h2 className="text-sm font-semibold text-stone-700">Lotes</h2>
          <button
            type="button"
            onClick={() => setLoteDialogOpen(true)}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-white"
            style={{ backgroundColor: "#344966" }}
          >
            <Plus className="h-3.5 w-3.5" /> Nuevo lote
          </button>
        </div>

        <p className="text-xs text-stone-400 mb-3">
          Si no crea lotes manualmente, al enviar a Estampación se generará automáticamente 1 lote con {totalUnidades} unidades ({tallas.length} tallas × {orden.capas} capas).
        </p>

        {lotes.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-4">
            Sin lotes — se creará 1 lote automáticamente al enviar a Estampación.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  {["Lote", "Descripción", "Cantidad", "Estado", ""].map((h) => (
                    <th key={h} className="px-3 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wide text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lotes.map((l) => (
                  <tr key={l.id} className="border-b border-stone-100 last:border-0">
                    <td className="px-3 py-2 font-mono font-semibold text-stone-700">
                      {padLote(l.numero_lote)}
                    </td>
                    <td className="px-3 py-2 text-stone-500 text-xs">{l.descripcion ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-stone-700">
                      {l.cantidad_programada.toLocaleString("es-CO")}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${LOTE_ESTADO_COLOR[l.estado] ?? "bg-stone-100 text-stone-700"}`}>
                        {LOTE_ESTADO_LABEL[l.estado] ?? l.estado}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {l.estado === "cortado" && (
                        <button
                          type="button"
                          disabled={isPendingLote}
                          onClick={() => handleEnviarLoteEstampacion(l.id)}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium bg-pink-50 text-pink-700 hover:bg-pink-100 disabled:opacity-50 transition-colors"
                        >
                          <Send className="h-3 w-3" /> Enviar a estampación
                        </button>
                      )}
                      {l.estado === "estampacion" && (
                        <a
                          href={`/estampacion/${l.id}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-stone-500 hover:bg-stone-100 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" /> Ver en estampación
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Dialog nuevo lote ────────────────────────────────── */}
      <Dialog open={loteDialogOpen} onOpenChange={setLoteDialogOpen}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo lote</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCrearLote} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">Cantidad programada *</label>
              <input type="number" name="cantidad_programada" required min="1" defaultValue={totalUnidades || ""} className={fieldCls} placeholder="0" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">Descripción (opcional)</label>
              <input type="text" name="descripcion" className={fieldCls} placeholder="Ej: Lote especial cliente A" />
            </div>
            <button type="submit" disabled={isPendingLote} className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "#344966" }}>
              {isPendingLote ? "Creando…" : "Crear lote"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
