"use client"

import * as React from "react"
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Save,
  CheckCircle,
  CheckCircle2,
  AlertTriangle,
  ImageIcon,
  ExternalLink,
} from "lucide-react"
import type { OrdenProduccionRow } from "@/lib/db/orden-produccion"
import type { DisenoRow, DisenoConOP } from "@/lib/db/diseno"
import type { LoteRow } from "@/lib/db/lote"
import { LOTE_ESTADO_LABEL, LOTE_ESTADO_COLOR } from "@/lib/db/lote"
import {
  guardarDisenoAction,
  aprobarDisenoAction,
  guardarLoteDisenoAction,
} from "@/app/(dashboard)/diseno/[id]/actions"
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
  diseno: DisenoRow | null
  disenosAnteriores: DisenoConOP[]
  lotes: LoteRow[]
}

function padOP(n: number) {
  return `OP-${String(n).padStart(4, "0")}`
}

function padLote(n: number) {
  return `LOTE-${String(n).padStart(4, "0")}`
}

// ── Tarjeta de diseño por lote ────────────────────────────────────────────────

function LoteDisenoCard({
  lote,
  ordenId,
  onMsg,
}: {
  lote: LoteRow
  ordenId: number
  onMsg: (tipo: "ok" | "error", msg: string) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [preview, setPreview] = React.useState<string | null>(lote.url_imagen)
  const [notas, setNotas] = React.useState(lote.notas_diseno ?? "")
  const fileRef = React.useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) setPreview(URL.createObjectURL(f))
  }

  function handleSave() {
    const fd = new FormData()
    fd.set("notas_diseno", notas)
    const file = fileRef.current?.files?.[0]
    if (file) fd.set("imagen_lote", file)
    startTransition(async () => {
      const res = await guardarLoteDisenoAction(lote.id, ordenId, fd)
      if (res.error) onMsg("error", res.error)
      else {
        onMsg("ok", `${padLote(lote.numero_lote)} guardado`)
        router.refresh()
      }
    })
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono font-semibold text-sm text-stone-800">
            {padLote(lote.numero_lote)}
          </p>
          <p className="text-xs text-stone-500 truncate">
            {lote.descripcion ?? "—"} · {lote.cantidad_programada.toLocaleString("es-CO")} uds
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
            LOTE_ESTADO_COLOR[lote.estado] ?? "bg-stone-100 text-stone-600"
          }`}
        >
          {LOTE_ESTADO_LABEL[lote.estado] ?? lote.estado}
        </span>
      </div>

      {/* Imagen */}
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt={`Imagen de ${padLote(lote.numero_lote)}`}
          className="w-full h-40 object-contain rounded-lg border border-stone-200 bg-white p-1"
        />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-stone-200 bg-white h-40">
          <ImageIcon className="h-8 w-8 text-stone-300 mb-1" />
          <p className="text-xs text-stone-400">Sin imagen</p>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="w-full text-xs text-stone-500 file:mr-2 file:rounded-lg file:border-0 file:px-2.5 file:py-1 file:text-xs file:font-medium file:bg-stone-100 file:text-stone-600 hover:file:bg-stone-200"
      />

      <textarea
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        rows={2}
        placeholder="Datos de diseño del lote (colores, estampado, ubicación…)"
        className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#344966] resize-none"
      />

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 w-full justify-center"
        style={{ backgroundColor: "#344966" }}
      >
        <Save className="h-3 w-3" />
        {isPending ? "Guardando…" : "Guardar lote"}
      </button>
    </div>
  )
}

function Toast({
  tipo,
  msg,
}: {
  tipo: "ok" | "error"
  msg: string
}) {
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

export function DisenaFichaClient({ orden, diseno, disenosAnteriores, lotes }: Props) {
  const router = useRouter()
  const [isPendingSave, startSave] = useTransition()
  const [isPendingApprove, startApprove] = useTransition()
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)
  const [imagePreview, setImagePreview] = React.useState<string | null>(
    diseno?.url_imagen_prenda ?? null
  )

  function showToast(tipo: "ok" | "error", msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 4000)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) setImagePreview(URL.createObjectURL(f))
  }

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startSave(async () => {
      const res = await guardarDisenoAction(orden.id, fd)
      if (res.error) {
        showToast("error", res.error)
      } else {
        showToast("ok", "Diseño guardado")
        router.refresh()
      }
    })
  }

  function handleApprove() {
    startApprove(async () => {
      const res = await aprobarDisenoAction(orden.id)
      if (res.error) {
        showToast("error", res.error)
      } else {
        showToast("ok", "Diseño aprobado — OP enviada a Corte")
        router.refresh()
      }
    })
  }

  const fieldCls =
    "w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
  const isAprobado = diseno?.aprobado === true
  const tieneImagen = Boolean(imagePreview)

  return (
    <div className="space-y-6">
      {toast && <Toast tipo={toast.tipo} msg={toast.msg} />}

      {/* Cabecera OP */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-stone-700 mb-3 border-b border-stone-100 pb-2">
          Información de la Orden
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
            <p className="text-xs text-stone-500">Gama / Color</p>
            <p className="text-stone-700">{orden.gama_color ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Fecha programada</p>
            <p className="font-mono text-stone-700">{orden.fecha_programacion ?? "—"}</p>
          </div>
        </div>
        {orden.descripcion && (
          <p className="mt-3 text-sm text-stone-600">{orden.descripcion}</p>
        )}
        {orden.url_molde && (
          <a
            href={orden.url_molde}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-[#344966] hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> Ver archivo molde
          </a>
        )}
        {isAprobado && (
          <div className="mt-3 flex items-center gap-2 text-sm font-medium text-green-700">
            <CheckCircle className="h-4 w-4" />
            Diseño aprobado el{" "}
            {new Date(diseno!.fecha_aprobacion!).toLocaleDateString("es-CO")}
          </div>
        )}
      </div>

      <form onSubmit={handleSave}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Especificaciones */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-stone-700 border-b border-stone-100 pb-2">
              Datos del diseño
            </h2>

            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">
                Especificaciones de confirmación
              </label>
              <textarea
                name="especificaciones_confirmacion"
                rows={4}
                defaultValue={diseno?.especificaciones_confirmacion ?? ""}
                className={`${fieldCls} resize-none`}
                placeholder="Detalles confirmados con el cliente…"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">Carta de color</label>
              <input
                type="text"
                name="carta_color"
                defaultValue={diseno?.carta_color ?? ""}
                className={fieldCls}
                placeholder="Ej: Pantone 286 C — Azul marino"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">
                Especificaciones de diseño
              </label>
              <textarea
                name="especificaciones_diseno"
                rows={4}
                defaultValue={diseno?.especificaciones_diseno ?? ""}
                className={`${fieldCls} resize-none`}
                placeholder="Técnica, posición, medidas de estampado…"
              />
            </div>
          </div>

          {/* Imagen */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-stone-700 border-b border-stone-100 pb-2">
              Imagen de la prenda <span className="text-red-500">*</span>
            </h2>

            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">Subir imagen</label>
              <input
                type="file"
                name="imagen_prenda"
                accept="image/*"
                onChange={handleFileChange}
                className="w-full text-sm text-stone-500 file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-1.5 file:text-xs file:font-medium file:bg-stone-100 file:text-stone-600 hover:file:bg-stone-200"
              />
              <p className="text-xs text-stone-400">Requerida para aprobar el diseño</p>
            </div>

            {imagePreview ? (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Vista previa de la prenda"
                  className="w-full max-h-72 object-contain rounded-xl border border-stone-200 bg-stone-50 p-2"
                />
                {diseno?.url_imagen_prenda && (
                  <a
                    href={diseno.url_imagen_prenda}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700"
                  >
                    <ExternalLink className="h-3 w-3" /> Ver imagen guardada
                  </a>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-200 bg-stone-50 p-10 text-center">
                <ImageIcon className="h-10 w-10 text-stone-300 mb-2" />
                <p className="text-sm text-stone-400">Sin imagen cargada</p>
              </div>
            )}
          </div>
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-3 mt-4">
          <button
            type="submit"
            disabled={isPendingSave}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
            style={{ backgroundColor: "#344966" }}
          >
            <Save className="h-4 w-4" />
            {isPendingSave ? "Guardando…" : "Guardar diseño"}
          </button>

          {!isAprobado && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  disabled={!tieneImagen || isPendingApprove}
                  title={!tieneImagen ? "Suba una imagen de la prenda antes de aprobar" : undefined}
                  className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
                  style={{ backgroundColor: "#15803d" }}
                >
                  <CheckCircle className="h-4 w-4" />
                  {isPendingApprove ? "Aprobando…" : "Aprobar diseño"}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Aprobar diseño?</AlertDialogTitle>
                  <AlertDialogDescription>
                    La orden <strong>{padOP(orden.numero_op)}</strong> pasará a estado{" "}
                    <strong>Corte</strong>. Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleApprove}>
                    Aprobar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </form>

      {/* Diseño por lote: imagen de referencia + datos de cada lote */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-stone-700 border-b border-stone-100 pb-2">
          Lotes de la orden — imagen de referencia por lote
        </h2>
        {lotes.length === 0 ? (
          <p className="text-sm text-stone-400 py-4 text-center">
            Esta orden aún no tiene lotes. Se crean desde la pestaña Curva de la OP.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lotes.map((l) => (
              <LoteDisenoCard key={l.id} lote={l} ordenId={orden.id} onMsg={showToast} />
            ))}
          </div>
        )}
      </div>

      {/* Diseños anteriores de la misma referencia */}
      {disenosAnteriores.length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-stone-700 border-b border-stone-100 pb-2">
            Diseños anteriores — {orden.referencia}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {disenosAnteriores.map((d) => (
              <div key={d.id} className="space-y-2">
                <div className="relative overflow-hidden rounded-xl border border-stone-200 bg-stone-50 aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={d.url_imagen_prenda!}
                    alt={`Diseño ${padOP(d.numero_op)}`}
                    className="w-full h-full object-contain p-1"
                  />
                  {d.aprobado && (
                    <div className="absolute top-1.5 right-1.5 rounded-full bg-green-500 p-0.5">
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-xs font-mono font-semibold text-stone-700">{padOP(d.numero_op)}</p>
                  {d.fecha_programacion && (
                    <p className="text-xs text-stone-400">{d.fecha_programacion}</p>
                  )}
                  <a
                    href={`/diseno/${d.orden_id}`}
                    className="inline-flex items-center gap-0.5 text-xs text-[#344966] hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Ver
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
