"use client"

import * as React from "react"
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Save,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Send,
} from "lucide-react"
import type { OrdenProduccionRow } from "@/lib/db/orden-produccion"
import type { CorteRow } from "@/lib/db/corte"
import type { CurvaTallaRow } from "@/lib/db/curva-talla"
import type { LoteRow } from "@/lib/db/lote"
import type { EstampadorRow } from "@/lib/db/estampador"
import { LoteImagenUpload } from "@/components/produccion/lote-imagen-upload"
import { PrendasConjuntoSection } from "@/components/produccion/prendas-conjunto-section"
import type { LotePrendaRow } from "@/lib/db/lote-prenda"
import { LOTE_ESTADO_COLOR, LOTE_ESTADO_LABEL } from "@/lib/db/lote"
import type { EstampacionRow } from "@/lib/db/estampacion"
import {
  guardarEstampacionAction,
  enviarAConfeccionAction,
} from "@/app/(dashboard)/estampacion/[id]/actions"
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
  lote: LoteRow
  orden: OrdenProduccionRow
  corte: CorteRow | null
  curvaTallas: CurvaTallaRow[]
  estampacion: EstampacionRow | null
  estampadores: EstampadorRow[]
  precioEstampacionOP: number | null
  prendas: LotePrendaRow[]
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

export function EstampacionFichaClient({
  lote,
  orden,
  corte,
  curvaTallas,
  estampacion,
  estampadores,
  precioEstampacionOP,
  prendas,
}: Props) {
  const router = useRouter()
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)
  const [isPendingEst, startEst] = useTransition()
  const [isPendingConf, startConf] = useTransition()

  function showToast(tipo: "ok" | "error", msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const curvaDeLote = curvaTallas
  const totalUds = lote.cantidad_programada

  // ── Estampación form ──────────────────────────────────────────
  function handleSaveEst(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startEst(async () => {
      const res = await guardarEstampacionAction(lote.id, fd)
      if (res.error) showToast("error", res.error)
      else {
        showToast("ok", "Estampación guardada")
        router.refresh()
      }
    })
  }

  // ── Enviar a confección ───────────────────────────────────────
  function handleEnviarConfeccion() {
    startConf(async () => {
      const res = await enviarAConfeccionAction(lote.id)
      if (res.error) showToast("error", res.error)
      else {
        showToast("ok", "Lote enviado a confección")
        router.refresh()
      }
    })
  }

  const fieldCls =
    "w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
  const yaEnConfeccion = lote.estado !== "estampacion"

  return (
    <div className="space-y-6">
      {toast && <Toast tipo={toast.tipo} msg={toast.msg} />}

      {/* ── Cabecera lote + OP ──────────────────────────────── */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3 flex-1">
            <div>
              <p className="text-xs text-stone-500">Lote</p>
              <p className="text-2xl font-bold text-stone-900">
                {lote.descripcion ?? padLote(lote.numero_lote)}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-6 text-sm">
              <div>
                <p className="text-xs text-stone-500">OP</p>
                <p className="font-mono font-semibold text-stone-700">{padOP(orden.numero_op)}</p>
              </div>
              <div>
                <p className="text-xs text-stone-500">Referencia</p>
                <p className="font-medium text-stone-800">{orden.referencia}</p>
              </div>
              <div>
                <p className="text-xs text-stone-500">Cantidad</p>
                <p className="font-mono font-semibold text-stone-700">
                  {lote.cantidad_programada.toLocaleString("es-CO")} uds
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

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium border border-stone-200 hover:bg-stone-50 transition-colors text-stone-600"
          >
            <Printer className="h-4 w-4" />
            Imprimir ficha
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Formulario estampación ───────────────────────── */}
        <form onSubmit={handleSaveEst}>
          <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4 h-full">
            <h2 className="text-sm font-semibold text-stone-700 border-b border-stone-100 pb-2">
              Datos de estampación
            </h2>

            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">Nombre del estampador</label>
              <select
                name="nombre_estampador"
                defaultValue={estampacion?.nombre_estampador ?? ""}
                className={fieldCls}
              >
                <option value="">— Selecciona un estampador —</option>
                {/* Valor guardado que no está en el módulo Estampadores */}
                {estampacion?.nombre_estampador &&
                  !estampadores.some((e) => e.nombre_completo === estampacion.nombre_estampador) && (
                    <option value={estampacion.nombre_estampador}>
                      {estampacion.nombre_estampador} (no registrado)
                    </option>
                  )}
                {estampadores.map((e) => (
                  <option key={e.id} value={e.nombre_completo}>{e.nombre_completo}</option>
                ))}
              </select>
              {estampadores.length === 0 && (
                <p className="text-xs text-amber-600">
                  No hay estampadores registrados. Créalos en el módulo Estampadores.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">
                Precio estampación (COP)
              </label>
              <input
                type="number"
                name="precio_estampacion"
                min="0"
                step="0.01"
                defaultValue={estampacion?.precio_estampacion ?? precioEstampacionOP ?? ""}
                className={fieldCls}
                placeholder="0.00"
              />
              {estampacion?.precio_estampacion == null && precioEstampacionOP != null && (
                <p className="text-xs text-stone-400">
                  Precargado desde el costo de estampación de la OP
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-stone-700">Fecha entrega lote</label>
                <input
                  type="date"
                  name="fecha_entrega_lote"
                  defaultValue={estampacion?.fecha_entrega_lote ?? ""}
                  className={fieldCls}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-stone-700">Fecha estimada de entrega</label>
                <input
                  type="date"
                  name="fecha_estimada_entrega"
                  defaultValue={estampacion?.fecha_estimada_entrega ?? ""}
                  className={fieldCls}
                />
                <p className="text-xs text-stone-400">Cuándo debe devolver el lote el estampador</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-stone-700">Fecha retorno lote</label>
                <input
                  type="date"
                  name="fecha_retorno_lote"
                  defaultValue={estampacion?.fecha_retorno_lote ?? ""}
                  className={fieldCls}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">Observaciones</label>
              <textarea
                name="observaciones_estampado"
                rows={3}
                defaultValue={estampacion?.observaciones_estampado ?? ""}
                className={`${fieldCls} resize-none`}
                placeholder="Técnica, posición, colores…"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={isPendingEst}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: "#344966" }}
              >
                <Save className="h-4 w-4" />
                {isPendingEst ? "Guardando…" : "Guardar estampación"}
              </button>

              {!yaEnConfeccion && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      disabled={isPendingConf}
                      className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                      style={{ backgroundColor: "#0f766e" }}
                    >
                      <Send className="h-4 w-4" />
                      {isPendingConf ? "Enviando…" : "Enviar a confección"}
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Enviar a confección?</AlertDialogTitle>
                      <AlertDialogDescription>
                        El lote <strong>{lote.descripcion ?? padLote(lote.numero_lote)}</strong> pasará a estado{" "}
                        <strong>Confección</strong>. Asegúrese de haber guardado todos los datos.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleEnviarConfeccion}>
                        Enviar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </form>

        {/* ── Imagen de referencia del lote (con subida) ────── */}
        <LoteImagenUpload lote={lote} onMsg={showToast} />
      </div>

      {/* ── Prendas del conjunto (OPs tipo conjunto) ─────── */}
      {orden.tipo_prenda === "conjunto" && (
        <PrendasConjuntoSection
          loteId={lote.id}
          prendas={prendas}
          etapa="estampacion"
          estampadores={estampadores.map((e) => e.nombre_completo)}
          onMsg={showToast}
        />
      )}

      {/* ── Sección de impresión (oculta en pantalla) ─────────── */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #print-ficha-estampacion { display: block !important; }
          #print-ficha-estampacion { position: fixed; top: 0; left: 0; width: 100%; padding: 20px; }
        }
        #print-ficha-estampacion { display: none; }
      `}</style>

      <div
        id="print-ficha-estampacion"
        style={{ fontFamily: "Arial, sans-serif", fontSize: 11, color: "#111" }}
      >
        {/* Encabezado */}
        <div
          style={{
            borderBottom: "2px solid #344966",
            paddingBottom: 10,
            marginBottom: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <h1 style={{ fontSize: 18, fontWeight: "bold", color: "#344966", margin: 0 }}>
              Ficha de Estampación
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 12 }}>
              {lote.descripcion ?? padLote(lote.numero_lote)} · {padOP(orden.numero_op)} — {orden.referencia}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 11 }}>
              Cantidad: <strong>{lote.cantidad_programada.toLocaleString("es-CO")} prendas</strong>
            </p>
          </div>
        </div>

        {/* Curva de tallas del lote */}
        <h2 style={{ fontSize: 12, fontWeight: "bold", marginBottom: 6 }}>
          Curva de tallas ({totalUds.toLocaleString("es-CO")} uds)
        </h2>
        {curvaDeLote.length > 0 ? (
          <table
            style={{ width: "50%", borderCollapse: "collapse", marginBottom: 16, fontSize: 10 }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f3f4f6" }}>
                {["Talla"].map((h) => (
                  <th
                    key={h}
                    style={{
                      border: "1px solid #d1d5db",
                      padding: "4px 10px",
                      textAlign: "left",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {curvaDeLote.map((ct) => (
                <tr key={ct.id}>
                  <td
                    style={{
                      border: "1px solid #d1d5db",
                      padding: "4px 10px",
                      fontWeight: "bold",
                    }}
                  >
                    {ct.talla}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: "#6b7280", fontSize: 10, marginBottom: 16 }}>
            Sin curva de tallas registrada para este color.
          </p>
        )}

        {/* Datos estampación */}
        <h2 style={{ fontSize: 12, fontWeight: "bold", marginBottom: 6 }}>
          Datos del estampador
        </h2>
        <table style={{ width: "50%", borderCollapse: "collapse", marginBottom: 16, fontSize: 10 }}>
          <tbody>
            <tr>
              <td
                style={{
                  border: "1px solid #d1d5db",
                  padding: "4px 10px",
                  fontWeight: "bold",
                  width: "40%",
                }}
              >
                Estampador
              </td>
              <td style={{ border: "1px solid #d1d5db", padding: "4px 10px" }}>
                {estampacion?.nombre_estampador ?? "—"}
              </td>
            </tr>
            <tr>
              <td style={{ border: "1px solid #d1d5db", padding: "4px 10px", fontWeight: "bold" }}>
                Fecha entrega
              </td>
              <td style={{ border: "1px solid #d1d5db", padding: "4px 10px" }}>
                {estampacion?.fecha_entrega_lote ?? "—"}
              </td>
            </tr>
            <tr>
              <td style={{ border: "1px solid #d1d5db", padding: "4px 10px", fontWeight: "bold" }}>
                Fecha retorno
              </td>
              <td style={{ border: "1px solid #d1d5db", padding: "4px 10px" }}>
                {estampacion?.fecha_retorno_lote ?? "—"}
              </td>
            </tr>
            {corte?.descripcion_piezas && (
              <tr>
                <td
                  style={{ border: "1px solid #d1d5db", padding: "4px 10px", fontWeight: "bold" }}
                >
                  Piezas
                </td>
                <td style={{ border: "1px solid #d1d5db", padding: "4px 10px" }}>
                  {corte.descripcion_piezas}
                </td>
              </tr>
            )}
            {estampacion?.observaciones_estampado && (
              <tr>
                <td
                  style={{ border: "1px solid #d1d5db", padding: "4px 10px", fontWeight: "bold" }}
                >
                  Observaciones
                </td>
                <td style={{ border: "1px solid #d1d5db", padding: "4px 10px" }}>
                  {estampacion.observaciones_estampado}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <p
          style={{
            marginTop: 24,
            fontSize: 9,
            color: "#9ca3af",
            borderTop: "1px solid #e5e7eb",
            paddingTop: 8,
          }}
        >
          ACOA · {new Date().toLocaleDateString("es-CO")}
        </p>
      </div>
    </div>
  )
}
