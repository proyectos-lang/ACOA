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
  ImagePlus,
} from "lucide-react"
import type { OrdenProduccionRow } from "@/lib/db/orden-produccion"
import type { CurvaTallaRow } from "@/lib/db/curva-talla"
import type { LoteRow } from "@/lib/db/lote"
import { LOTE_ESTADO_COLOR, LOTE_ESTADO_LABEL } from "@/lib/db/lote"
import type { ConfeccionRow, ConfeccionInsumoRow } from "@/lib/db/confeccion"
import type { NovedadProcesoRow } from "@/lib/db/novedad-proceso"
import { TIPO_NOVEDAD_LABEL, TIPO_NOVEDAD_COLOR } from "@/lib/db/novedad-proceso"
import {
  guardarConfeccionAction,
  guardarInsumosAction,
  crearNovedadConfeccionAction,
  eliminarNovedadConfeccionAction,
  enviarAConteoAction,
} from "@/app/(dashboard)/confeccion/[id]/actions"
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

interface InsumoFila {
  key: string
  nombre: string
  valor: number
}

interface Props {
  lote: LoteRow
  orden: OrdenProduccionRow
  curvaTallas: CurvaTallaRow[]
  confeccion: ConfeccionRow | null
  insumos: ConfeccionInsumoRow[]
  novedades: NovedadProcesoRow[]
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

const TIPOS_NOVEDAD = [
  "reposicion",
  "averia",
  "dano",
  "cobro",
  "compra",
] as const

export function ConfeccionFichaClient({
  lote,
  orden,
  curvaTallas,
  confeccion,
  insumos: insumosIniciales,
  novedades: novedadesIniciales,
}: Props) {
  const router = useRouter()
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)
  const [isPendingConf, startConf] = useTransition()
  const [isPendingIns, startIns] = useTransition()
  const [isPendingNov, startNov] = useTransition()
  const [isPendingEnv, startEnv] = useTransition()
  const [novDialogOpen, setNovDialogOpen] = React.useState(false)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(
    confeccion?.url_imagen_prenda ?? null
  )
  const fileRef = React.useRef<HTMLInputElement>(null)

  const [insumos, setInsumos] = React.useState<InsumoFila[]>(
    insumosIniciales.length > 0
      ? insumosIniciales.map((i) => ({ key: String(i.id), nombre: i.nombre, valor: i.valor }))
      : []
  )

  function showToast(tipo: "ok" | "error", msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const curvaDeLote = curvaTallas

  const cantidadReconfirmada = confeccion?.cantidad_reconfirmada
  const hayDiff =
    cantidadReconfirmada != null && cantidadReconfirmada !== lote.cantidad_programada
  const yaEnConteo = lote.estado !== "confeccion"

  // ── Formulario confección ──────────────────────────────────────
  function handleSaveConf(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startConf(async () => {
      const res = await guardarConfeccionAction(lote.id, fd)
      if (res.error) showToast("error", res.error)
      else {
        showToast("ok", "Confección guardada")
        router.refresh()
      }
    })
  }

  // ── Insumos ────────────────────────────────────────────────────
  function addInsumo() {
    setInsumos((prev) => [
      ...prev,
      { key: `new_${Date.now()}`, nombre: "", valor: 0 },
    ])
  }

  function removeInsumo(key: string) {
    setInsumos((prev) => prev.filter((i) => i.key !== key))
  }

  function updateInsumo(key: string, field: "nombre" | "valor", value: string) {
    setInsumos((prev) =>
      prev.map((i) =>
        i.key === key
          ? { ...i, [field]: field === "valor" ? parseFloat(value) || 0 : value }
          : i
      )
    )
  }

  function handleSaveInsumos() {
    if (!confeccion) {
      showToast("error", "Guarda primero los datos de confección")
      return
    }
    const sinNombre = insumos.filter((i) => !i.nombre.trim())
    if (sinNombre.length > 0) {
      showToast("error", "Completa el nombre de todos los insumos antes de guardar")
      return
    }
    const filas = insumos.map((i) => ({ nombre: i.nombre.trim(), valor: i.valor }))
    startIns(async () => {
      const res = await guardarInsumosAction(confeccion.id, lote.id, filas)
      if (res.error) showToast("error", res.error)
      else {
        showToast("ok", "Insumos guardados")
        router.refresh()
      }
    })
  }

  const totalInsumos = insumos.reduce((s, i) => s + (i.valor || 0), 0)

  // ── Novedades ──────────────────────────────────────────────────
  function handleCrearNovedad(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startNov(async () => {
      const res = await crearNovedadConfeccionAction({
        lote_id: lote.id,
        tipo: fd.get("tipo") as string,
        cantidad: parseInt(fd.get("cantidad") as string, 10) || 0,
        valor: parseFloat(fd.get("valor") as string) || 0,
        descripcion: (fd.get("descripcion") as string)?.trim(),
      })
      if (res.error) showToast("error", res.error)
      else {
        setNovDialogOpen(false)
        showToast("ok", "Novedad registrada")
        router.refresh()
      }
    })
  }

  function handleEliminarNovedad(id: number) {
    startNov(async () => {
      const res = await eliminarNovedadConfeccionAction(id, lote.id)
      if (res.error) showToast("error", res.error)
      else {
        showToast("ok", "Novedad eliminada")
        router.refresh()
      }
    })
  }

  // ── Enviar a conteo ────────────────────────────────────────────
  function handleEnviarConteo() {
    startEnv(async () => {
      const res = await enviarAConteoAction(lote.id)
      if (res.error) showToast("error", res.error)
      else {
        showToast("ok", "Lote enviado a conteo")
        router.refresh()
      }
    })
  }

  const fieldCls =
    "w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"

  return (
    <div className="space-y-6">
      {toast && <Toast tipo={toast.tipo} msg={toast.msg} />}

      {/* ── Alerta diferencia cantidad ───────────────────────── */}
      {hayDiff && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Diferencia de cantidad: programado{" "}
            <strong>{lote.cantidad_programada.toLocaleString("es-CO")}</strong> vs reconfirmado{" "}
            <strong>{cantidadReconfirmada!.toLocaleString("es-CO")}</strong> ud.
          </span>
        </div>
      )}

      {/* ── Cabecera lote ────────────────────────────────────── */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-stone-500">Lote</p>
            <p className="font-mono font-bold text-stone-800 text-lg">{padLote(lote.numero_lote)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">OP</p>
            <p className="font-mono font-semibold text-stone-700">{padOP(orden.numero_op)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Referencia</p>
            <p className="font-medium text-stone-800">{orden.referencia}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Color</p>
            <p className="font-medium text-stone-800">{lote.color}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Programado</p>
            <p className="font-mono font-semibold text-stone-700">
              {lote.cantidad_programada.toLocaleString("es-CO")} uds
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Reconfirmado</p>
            <p className={`font-mono font-semibold ${hayDiff ? "text-amber-600" : "text-stone-700"}`}>
              {cantidadReconfirmada != null
                ? `${cantidadReconfirmada.toLocaleString("es-CO")} uds`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Estado</p>
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                LOTE_ESTADO_COLOR[lote.estado] ?? "bg-stone-100 text-stone-700"
              }`}
            >
              {LOTE_ESTADO_LABEL[lote.estado] ?? lote.estado}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Formulario confección ───────────────────────────── */}
        <form onSubmit={handleSaveConf} encType="multipart/form-data">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4 h-full">
            <h2 className="text-sm font-semibold text-stone-700 border-b border-stone-100 pb-2">
              Datos de confección
            </h2>

            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">Confeccionista</label>
              <input
                type="text"
                name="nombre_confeccionista"
                defaultValue={confeccion?.nombre_confeccionista ?? ""}
                className={fieldCls}
                placeholder="Nombre de la empresa o persona"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-stone-700">Cantidad reconfirmada</label>
                <input
                  type="number"
                  name="cantidad_reconfirmada"
                  min="0"
                  defaultValue={confeccion?.cantidad_reconfirmada ?? ""}
                  className={fieldCls}
                  placeholder={String(lote.cantidad_programada)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-stone-700">Precio confección (COP)</label>
                <input
                  type="number"
                  name="precio_confeccion"
                  min="0"
                  step="0.01"
                  defaultValue={confeccion?.precio_confeccion ?? ""}
                  className={fieldCls}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-stone-700">Fecha entrega lote</label>
                <input
                  type="date"
                  name="fecha_entrega_lote"
                  defaultValue={confeccion?.fecha_entrega_lote ?? ""}
                  className={fieldCls}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-stone-700">Fecha retorno lote</label>
                <input
                  type="date"
                  name="fecha_retorno_lote"
                  defaultValue={confeccion?.fecha_retorno_lote ?? ""}
                  className={fieldCls}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">Condiciones</label>
              <textarea
                name="condiciones_confeccion"
                rows={3}
                defaultValue={confeccion?.condiciones_confeccion ?? ""}
                className={`${fieldCls} resize-none`}
                placeholder="Especificaciones para el confeccionista…"
              />
            </div>

            {/* Imagen de prenda */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">Imagen de prenda</label>
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Prenda"
                  className="h-32 w-32 object-cover rounded-xl border border-stone-200"
                />
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 rounded-xl border border-dashed border-stone-300 px-4 py-2.5 text-sm text-stone-500 hover:bg-stone-50 transition-colors"
              >
                <ImagePlus className="h-4 w-4" />
                {previewUrl ? "Cambiar imagen" : "Subir imagen"}
              </button>
              <input
                ref={fileRef}
                type="file"
                name="imagen"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) setPreviewUrl(URL.createObjectURL(file))
                }}
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="submit"
                disabled={isPendingConf}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: "#344966" }}
              >
                <Save className="h-4 w-4" />
                {isPendingConf ? "Guardando…" : "Guardar confección"}
              </button>

              {!yaEnConteo && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      disabled={isPendingEnv}
                      className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                      style={{ backgroundColor: "#0f766e" }}
                    >
                      <Send className="h-4 w-4" />
                      {isPendingEnv ? "Enviando…" : "Enviar a conteo"}
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Enviar a conteo?</AlertDialogTitle>
                      <AlertDialogDescription>
                        El lote <strong>{padLote(lote.numero_lote)}</strong> pasará a estado{" "}
                        <strong>Conteo</strong>. Asegúrese de haber guardado todos los datos de
                        confección e insumos.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleEnviarConteo}>Enviar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </form>

        {/* ── Panel derecho: curva + novedades ─────────────────── */}
        <div className="space-y-6">
          {/* Curva tallas del lote */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
            <h2 className="text-sm font-semibold text-stone-700 border-b border-stone-100 pb-2">
              Tallas de la OP
            </h2>
            {curvaDeLote.length === 0 ? (
              <p className="text-sm text-stone-400 text-center py-3">
                Sin tallas registradas para esta OP.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {curvaDeLote.map((ct) => (
                  <span key={ct.id} className="inline-block rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
                    {ct.talla}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Novedades */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <h2 className="text-sm font-semibold text-stone-700">Novedades</h2>
              <button
                type="button"
                onClick={() => setNovDialogOpen(true)}
                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-white"
                style={{ backgroundColor: "#344966" }}
              >
                <Plus className="h-3.5 w-3.5" /> Agregar
              </button>
            </div>

            {novedadesIniciales.length === 0 ? (
              <p className="text-sm text-stone-400 text-center py-3">Sin novedades registradas.</p>
            ) : (
              <div className="space-y-2">
                {novedadesIniciales.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-stone-100 bg-stone-50 px-3 py-2.5"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            TIPO_NOVEDAD_COLOR[n.tipo] ?? "bg-stone-100 text-stone-700"
                          }`}
                        >
                          {TIPO_NOVEDAD_LABEL[n.tipo] ?? n.tipo}
                        </span>
                        <span className="text-xs font-mono font-semibold text-stone-700">
                          {n.cantidad} uds · {cop(Number(n.valor))}
                        </span>
                      </div>
                      {n.descripcion && (
                        <p className="text-xs text-stone-500 truncate">{n.descripcion}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleEliminarNovedad(n.id)}
                      disabled={isPendingNov}
                      className="p-1 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors disabled:opacity-50 shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Insumos ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-2">
          <h2 className="text-sm font-semibold text-stone-700">Insumos de confección</h2>
          <button
            type="button"
            onClick={addInsumo}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-white"
            style={{ backgroundColor: "#344966" }}
          >
            <Plus className="h-3.5 w-3.5" /> Agregar
          </button>
        </div>

        {insumos.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-3">Sin insumos registrados.</p>
        ) : (
          <div className="space-y-2">
            {insumos.map((ins) => (
              <div key={ins.key} className="flex items-center gap-2">
                <input
                  type="text"
                  value={ins.nombre}
                  onChange={(e) => updateInsumo(ins.key, "nombre", e.target.value)}
                  placeholder="Nombre del insumo (ej. cordón, elástico, bandera...)"
                  className="flex-1 min-w-0 rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
                />
                <input
                  type="number"
                  value={ins.valor || ""}
                  onChange={(e) => updateInsumo(ins.key, "valor", e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-32 shrink-0 rounded-xl border border-stone-200 px-3 py-2 text-sm text-right outline-none focus:ring-2 focus:ring-[#344966]"
                />
                <button
                  type="button"
                  onClick={() => removeInsumo(ins.key)}
                  className="p-2 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            <div className="flex items-center justify-between pt-2 border-t border-stone-100">
              <span className="text-sm font-semibold text-stone-700">
                Total insumos: {cop(totalInsumos)}
              </span>
              <button
                type="button"
                onClick={handleSaveInsumos}
                disabled={isPendingIns}
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: "#344966" }}
              >
                <Save className="h-4 w-4" />
                {isPendingIns ? "Guardando…" : "Guardar insumos"}
              </button>
            </div>
          </div>
        )}

        {/* Botón guardar cuando no hay insumos pero sí botón de agregar */}
        {insumos.length === 0 && confeccion && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveInsumos}
              disabled={isPendingIns}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "#344966" }}
            >
              <Save className="h-4 w-4" />
              {isPendingIns ? "Guardando…" : "Guardar insumos"}
            </button>
          </div>
        )}
      </div>

      {/* ── Dialog nueva novedad ─────────────────────────────────── */}
      <Dialog open={novDialogOpen} onOpenChange={setNovDialogOpen}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Registrar novedad</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCrearNovedad} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">Tipo *</label>
              <select name="tipo" required className={fieldCls}>
                {TIPOS_NOVEDAD.map((t) => (
                  <option key={t} value={t}>
                    {TIPO_NOVEDAD_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-stone-700">Cantidad *</label>
                <input
                  type="number"
                  name="cantidad"
                  required
                  min="0"
                  defaultValue="0"
                  className={fieldCls}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-stone-700">Valor (COP)</label>
                <input
                  type="number"
                  name="valor"
                  min="0"
                  step="0.01"
                  defaultValue="0"
                  className={fieldCls}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">Descripción</label>
              <textarea
                name="descripcion"
                rows={2}
                className={`${fieldCls} resize-none`}
                placeholder="Detalle de la novedad…"
              />
            </div>
            <button
              type="submit"
              disabled={isPendingNov}
              className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "#344966" }}
            >
              {isPendingNov ? "Guardando…" : "Registrar"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
