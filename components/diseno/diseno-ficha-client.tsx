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
  Printer,
  Send,
} from "lucide-react"
import type { OrdenProduccionRow } from "@/lib/db/orden-produccion"
import type { DisenoRow, DisenoConOP } from "@/lib/db/diseno"
import type { LoteRow } from "@/lib/db/lote"
import type { OpTelaRow } from "@/lib/db/op-tela"
import type { OpTelaLoteRow } from "@/lib/db/op-tela-lote"
import type { EstampadorRow } from "@/lib/db/estampador"
import { LOTE_ESTADO_LABEL, LOTE_ESTADO_COLOR } from "@/lib/db/lote"
import {
  aprobarDisenoAction,
  guardarLoteDisenoAction,
  aprobarYEnviarEstampacionAction,
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
  opTelas: OpTelaRow[]
  opTelaLotes: OpTelaLoteRow[]
  estampadores: EstampadorRow[]
  estampadorPorLote: Record<number, string | null>
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
  estampadores,
  estampadorAsignado,
  onMsg,
}: {
  lote: LoteRow
  ordenId: number
  estampadores: EstampadorRow[]
  estampadorAsignado: string | null
  onMsg: (tipo: "ok" | "error", msg: string) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [preview, setPreview] = React.useState<string | null>(lote.url_imagen)
  const [notas, setNotas] = React.useState(lote.notas_diseno ?? "")
  const [estampador, setEstampador] = React.useState(estampadorAsignado ?? "")
  const fileRef = React.useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) setPreview(URL.createObjectURL(f))
  }

  const nombreLote = lote.descripcion ?? padLote(lote.numero_lote)

  function handleSave() {
    const fd = new FormData()
    fd.set("notas_diseno", notas)
    fd.set("nombre_estampador", estampador)
    const file = fileRef.current?.files?.[0]
    if (file) fd.set("imagen_lote", file)
    startTransition(async () => {
      const res = await guardarLoteDisenoAction(lote.id, ordenId, fd)
      if (res.error) onMsg("error", res.error)
      else {
        onMsg("ok", `${nombreLote} guardado`)
        router.refresh()
      }
    })
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-stone-800 truncate">{nombreLote}</p>
          <p className="text-xs text-stone-500">
            {lote.cantidad_programada.toLocaleString("es-CO")} uds
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
          alt={`Imagen de ${nombreLote}`}
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

      {/* Estampador asignado desde Diseño (queda en el proceso de estampación) */}
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-stone-500">Estampador asignado</label>
        <select
          value={estampador}
          onChange={(e) => setEstampador(e.target.value)}
          className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#344966]"
        >
          <option value="">— Sin asignar —</option>
          {estampador && !estampadores.some((e) => e.nombre_completo === estampador) && (
            <option value={estampador}>{estampador} (no registrado)</option>
          )}
          {estampadores.map((e) => (
            <option key={e.id} value={e.nombre_completo}>
              {e.nombre_completo}
            </option>
          ))}
        </select>
        {estampadores.length === 0 && (
          <p className="text-[11px] text-amber-600">
            No hay estampadores registrados. Créalos en el módulo Estampadores.
          </p>
        )}
      </div>

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

export function DisenaFichaClient({
  orden,
  diseno,
  disenosAnteriores,
  lotes,
  opTelas,
  opTelaLotes,
  estampadores,
  estampadorPorLote,
}: Props) {
  const router = useRouter()
  const [isPendingApprove, startApprove] = useTransition()
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)

  function showToast(tipo: "ok" | "error", msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 4000)
  }

  // Rejilla 3x3 por hoja carta con la imagen de cada lote y su referencia.
  // Se abre en una ventana nueva y se imprime cuando las imágenes cargan.
  function imprimirRejilla() {
    const esc = (t: string | null | undefined) =>
      (t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

    const ordenados = [...lotes].sort((a, b) =>
      (a.descripcion ?? "").localeCompare(b.descripcion ?? "", "es", { numeric: true })
    )

    const celdas = ordenados
      .map((l) => {
        const nombre = esc(l.descripcion ?? padLote(l.numero_lote))
        const img = l.url_imagen
          ? `<img src="${esc(l.url_imagen)}" alt="${nombre}">`
          : `<div class="sin-img">Sin imagen</div>`
        return `<div class="celda">
          <div class="img">${img}</div>
          <div class="pie">
            <p class="lote">${nombre}</p>
            <p class="ref">${esc(orden.referencia)}</p>
          </div>
        </div>`
      })
      .join("")

    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<title>Diseño ${padOP(orden.numero_op)} — ${esc(orden.referencia)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: letter; margin: 8mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; padding: 10px; }
  .encabezado { border: 1.5px solid #111; margin-bottom: 8px; }
  .titulo { background: #f2e14c; font-weight: bold; font-size: 12px; padding: 4px 8px;
            display: flex; justify-content: space-between; border-bottom: 1.5px solid #111; }
  .sub { padding: 3px 8px; font-size: 9px; color: #444; display: flex; gap: 16px; }
  .rejilla { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .celda { border: 1px solid #111; display: flex; flex-direction: column;
           height: 78mm; page-break-inside: avoid; break-inside: avoid; }
  .img { flex: 1; display: flex; align-items: center; justify-content: center;
         padding: 3px; overflow: hidden; }
  .img img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .sin-img { color: #999; font-size: 9px; border: 1px dashed #ccc; padding: 20px 10px; }
  .pie { border-top: 1px solid #111; padding: 3px 5px; background: #f7f7f7; }
  .pie .lote { font-size: 10px; font-weight: bold; }
  .pie .ref { font-size: 9px; color: #444; }
  @media print { body { padding: 0; } }
</style></head><body>
  <div class="encabezado">
    <div class="titulo"><span>DISEÑO — IMÁGENES POR LOTE</span><span>${padOP(orden.numero_op)}</span></div>
    <div class="sub">
      <span><strong>Referencia:</strong> ${esc(orden.referencia)}</span>
      <span><strong>Lotes:</strong> ${ordenados.length}</span>
      ${orden.descripcion ? `<span><strong>Descripción:</strong> ${esc(orden.descripcion)}</span>` : ""}
    </div>
  </div>
  <div class="rejilla">${celdas}</div>
  <script>
    window.addEventListener("load", function () { setTimeout(function () { window.print() }, 250) })
  <\/script>
</body></html>`

    const w = window.open("", "_blank")
    if (!w) {
      showToast("error", "Permite las ventanas emergentes para imprimir")
      return
    }
    w.document.write(html)
    w.document.close()
    w.focus()
  }

  // Aprueba el diseño y manda los lotes directo a Estampación
  const [isPendingEnvio, startEnvio] = useTransition()
  function handleAprobarYEnviar() {
    startEnvio(async () => {
      const res = await aprobarYEnviarEstampacionAction(orden.id)
      if (res.error) showToast("error", res.error)
      else {
        showToast(
          "ok",
          `Diseño aprobado — ${res.lotesEnviados ?? 0} lote${
            (res.lotesEnviados ?? 0) !== 1 ? "s" : ""
          } enviado${(res.lotesEnviados ?? 0) !== 1 ? "s" : ""} a estampación`
        )
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

  const isAprobado = diseno?.aprobado === true
  // Informativo: la imagen por lote es recomendada pero no bloquea la aprobación
  const lotesSinImagen = lotes.filter((l) => !l.url_imagen)

  // Materiales de la curva con datos (colores por fila y capas por lote)
  const slotsConDatos = ([1, 2, 3] as const).filter(
    (s) => opTelas.some((t) => t.slot === s) || opTelaLotes.some((r) => r.slot === s)
  )

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

      {/* Curva de materiales: colores por material y capas por lote */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-5">
        <h2 className="text-sm font-semibold text-stone-700 border-b border-stone-100 pb-2">
          Materiales de la curva — colores y capas por lote
        </h2>
        {slotsConDatos.length === 0 ? (
          <p className="text-sm text-stone-400 py-4 text-center">
            La curva de esta orden aún no tiene materiales configurados.
          </p>
        ) : (() => {
          // Tabla unificada: colores de M1/M2/M3 lado a lado relacionados por
          // posición (fila); las capas son compartidas y se toman de Material 1
          const refSlot = slotsConDatos.includes(1) ? 1 : slotsConDatos[0]
          const materiales = slotsConDatos.map((s) => ({
            slot: s,
            telas: opTelas
              .filter((t) => t.slot === s)
              .sort((a, b) => (a.fila ?? 0) - (b.fila ?? 0)),
          }))
          const refTelas = materiales.find((m) => m.slot === refSlot)?.telas ?? []
          const filasRef = opTelaLotes.filter((r) => r.slot === refSlot)
          const nombresLote = [...new Set(filasRef.map((r) => r.lote_nombre))]
          const capa = (fila: number, lote: string) =>
            filasRef.find((r) => (r.fila ?? 0) === fila && r.lote_nombre === lote)?.capas ?? 0
          const numFilas = Math.max(...materiales.map((m) => m.telas.length))
          const granTotal = refTelas.reduce(
            (s, t) => s + nombresLote.reduce((ls, l) => ls + capa(t.fila ?? 0, l), 0), 0
          )
          return (
            <div className="overflow-x-auto rounded-xl border border-stone-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50">
                    {materiales.map((m) => (
                      <th key={m.slot} className="px-3 py-2 text-left font-semibold text-stone-500 whitespace-nowrap">
                        Material {m.slot}
                        {m.telas[0]?.tipo_tela && (
                          <span className="block font-normal text-stone-400">{m.telas[0].tipo_tela}</span>
                        )}
                      </th>
                    ))}
                    {nombresLote.map((l) => (
                      <th key={l} className="px-3 py-2 text-center font-semibold text-stone-500 whitespace-nowrap">
                        {l}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-center font-semibold text-stone-600 bg-stone-100">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: numFilas }, (_, i) => {
                    const refFila = refTelas[i]?.fila ?? i
                    const totalFila = nombresLote.reduce((s, l) => s + capa(refFila, l), 0)
                    return (
                      <tr key={i} className="border-b border-stone-100 last:border-0">
                        {materiales.map((m) => (
                          <td key={m.slot} className="px-3 py-2 font-medium text-stone-800">
                            {m.telas[i]?.color ?? "—"}
                          </td>
                        ))}
                        {nombresLote.map((l) => (
                          <td key={l} className="px-3 py-2 text-center font-mono text-stone-700">
                            {capa(refFila, l) || "—"}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-center font-mono font-semibold text-stone-800 bg-stone-50">
                          {totalFila}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-stone-200 bg-stone-50">
                    <td colSpan={materiales.length} className="px-3 py-2 font-semibold text-stone-600">
                      Capas
                    </td>
                    {nombresLote.map((l) => (
                      <td key={l} className="px-3 py-2 text-center font-mono font-bold" style={{ color: "#344966" }}>
                        {refTelas.reduce((s, t) => s + capa(t.fila ?? 0, l), 0)}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center font-mono font-bold bg-stone-100" style={{ color: "#344966" }}>
                      {granTotal}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        })()}
      </div>

      {/* Diseño por lote: imagen de referencia + datos de cada lote */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-2">
          <h2 className="text-sm font-semibold text-stone-700">
            Lotes de la orden — imagen de referencia por lote
          </h2>
          {lotes.length > 0 && (
            <button
              type="button"
              onClick={imprimirRejilla}
              className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir rejilla de imágenes
            </button>
          )}
        </div>
        {lotes.length === 0 ? (
          <p className="text-sm text-stone-400 py-4 text-center">
            Esta orden aún no tiene lotes. Se crean desde la pestaña Curva de la OP.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...lotes]
              .sort((a, b) =>
                (a.descripcion ?? "").localeCompare(b.descripcion ?? "", "es", { numeric: true })
              )
              .map((l) => (
                <LoteDisenoCard
                  key={l.id}
                  lote={l}
                  ordenId={orden.id}
                  estampadores={estampadores}
                  estampadorAsignado={estampadorPorLote[l.id] ?? null}
                  onMsg={showToast}
                />
              ))}
          </div>
        )}
      </div>

      {/* Aprobar diseño */}
      {!isAprobado && (
        <div className="flex justify-end items-center gap-3">
          {lotesSinImagen.length > 0 && (
            <p className="text-xs text-amber-600">
              {lotesSinImagen.length} lote{lotesSinImagen.length !== 1 ? "s" : ""} sin imagen de referencia
            </p>
          )}
          {/* Aprobar y enviar directo a estampación (salta el paso por Corte) */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                disabled={isPendingEnvio}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
                style={{ backgroundColor: "#be185d" }}
              >
                <Send className="h-4 w-4" />
                {isPendingEnvio ? "Enviando…" : "Aprobar y enviar a estampación"}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Aprobar y enviar a estampación?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se aprobará el diseño y los lotes de la orden{" "}
                  <strong>{padOP(orden.numero_op)}</strong> pasarán directamente a{" "}
                  <strong>Estampación</strong>, sin pasar por Corte. Empezarán a aparecer en la
                  bandeja de ese módulo.
                  {lotesSinImagen.length > 0 && (
                    <> Hay {lotesSinImagen.length} lote{lotesSinImagen.length !== 1 ? "s" : ""} sin imagen de referencia.</>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleAprobarYEnviar}
                  style={{ backgroundColor: "#be185d" }}
                >
                  Aprobar y enviar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                disabled={isPendingApprove}
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
                  {lotesSinImagen.length > 0 && (
                    <> Hay {lotesSinImagen.length} lote{lotesSinImagen.length !== 1 ? "s" : ""} sin imagen de referencia.</>
                  )}
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
        </div>
      )}

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
