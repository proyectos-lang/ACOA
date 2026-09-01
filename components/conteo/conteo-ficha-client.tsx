"use client"

import * as React from "react"
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Save, Plus, Trash2, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react"
import type { OrdenProduccionRow } from "@/lib/db/orden-produccion"
import type { CurvaTallaRow } from "@/lib/db/curva-talla"
import type { LoteRow } from "@/lib/db/lote"
import { LoteImagenRef } from "@/components/produccion/lote-imagen-ref"
import { PrendasConjuntoSection } from "@/components/produccion/prendas-conjunto-section"
import type { LotePrendaRow } from "@/lib/db/lote-prenda"
import { LOTE_ESTADO_COLOR, LOTE_ESTADO_LABEL } from "@/lib/db/lote"
import type { ConteoRow, ConteoDetalleRow } from "@/lib/db/conteo"
import {
  guardarConteoAction,
  validarConteoAction,
} from "@/app/(dashboard)/conteo/[id]/actions"
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

interface DetallaFila {
  key: string
  color: string
  talla: string
  cantidad_contada: number
  imperfectos: number
}

interface Props {
  lote: LoteRow
  orden: OrdenProduccionRow
  curvaTallas: CurvaTallaRow[]
  conteo: ConteoRow | null
  conteoDetalle: ConteoDetalleRow[]
  prendas: LotePrendaRow[]
}

function padOP(n: number) {
  return `OP-${String(n).padStart(4, "0")}`
}
function padLote(n: number) {
  return `LOTE-${String(n).padStart(4, "0")}`
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

export function ConteoFichaClient({
  lote,
  orden,
  curvaTallas,
  conteo,
  conteoDetalle,
  prendas,
}: Props) {
  const router = useRouter()
  const formRef = React.useRef<HTMLFormElement>(null)
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)
  const [isPendingGuardar, startGuardar] = useTransition()
  const [isPendingValidar, startValidar] = useTransition()

  const curvaDeLote = curvaTallas

  const [filas, setFilas] = React.useState<DetallaFila[]>(() => {
    if (conteoDetalle.length > 0) {
      // El conteo se registra solo por talla: agrupar detalle existente
      const porTalla = new Map<string, { cantidad: number; imperfectos: number }>()
      const ordenTallas: string[] = []
      for (const d of conteoDetalle) {
        const t = d.talla.trim()
        if (!porTalla.has(t)) {
          ordenTallas.push(t)
          porTalla.set(t, { cantidad: 0, imperfectos: 0 })
        }
        const acc = porTalla.get(t) as { cantidad: number; imperfectos: number }
        acc.cantidad += d.cantidad_contada
        acc.imperfectos += d.imperfectos ?? 0
      }
      return ordenTallas.map((t) => ({
        key: `t_${t}`,
        color: "",
        talla: t,
        cantidad_contada: porTalla.get(t)?.cantidad ?? 0,
        imperfectos: porTalla.get(t)?.imperfectos ?? 0,
      }))
    }
    // Pre-llenar con tallas de la OP
    return curvaTallas.map((ct) => ({
      key: `ct_${ct.id}`,
      color: "",
      talla: ct.talla,
      cantidad_contada: 0,
      imperfectos: 0,
    }))
  })

  function showToast(tipo: "ok" | "error", msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 4000)
  }

  function addFila() {
    setFilas((prev) => [
      ...prev,
      { key: `new_${Date.now()}`, color: "", talla: "", cantidad_contada: 0, imperfectos: 0 },
    ])
  }

  function removeFila(key: string) {
    setFilas((prev) => prev.filter((f) => f.key !== key))
  }

  function updateFila(key: string, field: keyof DetallaFila, value: string) {
    setFilas((prev) =>
      prev.map((f) =>
        f.key === key
          ? {
              ...f,
              [field]:
                field === "cantidad_contada" || field === "imperfectos"
                  ? parseInt(value, 10) || 0
                  : value,
            }
          : f
      )
    )
  }

  const totalContado = filas.reduce((s, f) => s + (f.cantidad_contada || 0), 0)
  const totalImperfectos = filas.reduce((s, f) => s + (f.imperfectos || 0), 0)

  // Diferencia frente a lo programado: si lo registrado (contadas +
  // imperfectos) es menor, hay que justificarla antes de validar
  const registrado = totalContado + totalImperfectos
  const diferencia = lote.cantidad_programada - registrado
  const [justificacion, setJustificacion] = React.useState("")

  // Comparación tallas de OP vs conteo
  const comparacion = curvaDeLote.map((ct) => {
    const conteoFila = filas.find(
      (f) => f.talla.toLowerCase() === ct.talla.toLowerCase()
    )
    return {
      talla: ct.talla,
      contado: conteoFila?.cantidad_contada ?? 0,
      imperfectos: conteoFila?.imperfectos ?? 0,
    }
  })

  function handleGuardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const filasLimpias = filas
      .filter((f) => f.talla.trim())
      .map((f) => ({
        color: f.color.trim(),
        talla: f.talla.trim(),
        cantidad_contada: f.cantidad_contada,
        imperfectos: f.imperfectos,
      }))
    startGuardar(async () => {
      const res = await guardarConteoAction(lote.id, fd, filasLimpias)
      if (res.error) showToast("error", res.error)
      else {
        showToast("ok", `Conteo guardado — total: ${res.total_contado?.toLocaleString("es-CO")} uds`)
        router.refresh()
      }
    })
  }

  function handleValidar() {
    const fd = formRef.current ? new FormData(formRef.current) : new FormData()
    const filasLimpias = filas
      .filter((f) => f.talla.trim())
      .map((f) => ({
        color: f.color.trim(),
        talla: f.talla.trim(),
        cantidad_contada: f.cantidad_contada,
        imperfectos: f.imperfectos,
      }))
    startValidar(async () => {
      const res = await validarConteoAction(lote.id, fd, filasLimpias, justificacion.trim() || undefined)
      if (res.error) showToast("error", res.error)
      else {
        showToast(
          "ok",
          res.pagos_habilitados
            ? "Conteo validado — pago al confeccionista habilitado en el módulo Pagos."
            : "Conteo validado. El lote está disponible para empaque."
        )
        router.refresh()
      }
    })
  }

  const yaValidado = conteo?.validado === true
  const yaEnEmpaque = lote.estado !== "conteo"

  const fieldCls =
    "w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"

  return (
    <div className="space-y-6">
      {toast && <Toast tipo={toast.tipo} msg={toast.msg} />}

      {/* ── Cabecera ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        {lote.url_imagen && (
          <div className="mb-4">
            <LoteImagenRef lote={lote} />
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-stone-500">Lote</p>
            <p className="font-bold text-stone-800 text-lg">{lote.descripcion ?? padLote(lote.numero_lote)}</p>
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
            <p className="text-xs text-stone-500">Total contado</p>
            <p className="font-mono font-semibold text-teal-700">
              {(conteo?.total_contado ?? totalContado).toLocaleString("es-CO")} uds
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Imperfectos</p>
            <p className="font-mono font-semibold text-red-700">
              {totalImperfectos.toLocaleString("es-CO")} uds
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Estado conteo</p>
            {yaValidado ? (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800">
                <ShieldCheck className="h-3 w-3" /> Validado
              </span>
            ) : (
              <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">
                Pendiente
              </span>
            )}
          </div>
          <div>
            <p className="text-xs text-stone-500">Estado lote</p>
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

      {/* ── Prendas del conjunto (OPs tipo conjunto) ─────── */}
      {orden.tipo_prenda === "conjunto" && (
        <PrendasConjuntoSection
          loteId={lote.id}
          prendas={prendas}
          etapa="conteo"
          onMsg={showToast}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Formulario conteo ──────────────────────────────── */}
        <form ref={formRef} onSubmit={handleGuardar}>
          <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4 h-full">
            <h2 className="text-sm font-semibold text-stone-700 border-b border-stone-100 pb-2">
              Registro de conteo
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-stone-700">Fecha conteo</label>
                <input
                  type="date"
                  name="fecha_conteo"
                  defaultValue={conteo?.fecha_conteo ?? ""}
                  className={fieldCls}
                />
              </div>
              <div />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">Observación</label>
              <textarea
                name="observacion"
                rows={2}
                defaultValue={conteo?.observacion ?? ""}
                className={`${fieldCls} resize-none`}
                placeholder="Observaciones del conteo…"
              />
            </div>

            {/* Filas de conteo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-stone-700">Detalle por talla</span>
                {!yaValidado && !yaEnEmpaque && (
                  <button
                    type="button"
                    onClick={addFila}
                    className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Agregar fila
                  </button>
                )}
              </div>

              <div className="rounded-xl border border-stone-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-100">
                      <th className="px-3 py-2 text-left text-xs text-stone-500 font-medium">Talla</th>
                      <th className="px-3 py-2 text-right text-xs text-stone-500 font-medium">Contado</th>
                      <th className="px-3 py-2 text-right text-xs text-stone-500 font-medium">Imperfectos</th>
                      {!yaValidado && !yaEnEmpaque && <th className="w-8" />}
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => (
                      <tr key={f.key} className="border-b border-stone-100 last:border-0">
                        <td className="px-3 py-1.5">
                          {yaValidado || yaEnEmpaque ? (
                            <span className="text-stone-700 font-medium">{f.talla}</span>
                          ) : (
                            <input
                              type="text"
                              value={f.talla}
                              onChange={(e) => updateFila(f.key, "talla", e.target.value)}
                              className="w-full rounded-lg border border-stone-200 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-[#344966]"
                            />
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {yaValidado || yaEnEmpaque ? (
                            <span className="font-mono text-stone-700">
                              {f.cantidad_contada.toLocaleString("es-CO")}
                            </span>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              value={f.cantidad_contada || ""}
                              onChange={(e) =>
                                updateFila(f.key, "cantidad_contada", e.target.value)
                              }
                              className="w-24 rounded-lg border border-stone-200 px-2 py-1 text-xs text-right font-mono outline-none focus:ring-1 focus:ring-[#344966]"
                            />
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {yaValidado || yaEnEmpaque ? (
                            <span className="font-mono text-red-700">
                              {f.imperfectos.toLocaleString("es-CO")}
                            </span>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              value={f.imperfectos || ""}
                              onChange={(e) =>
                                updateFila(f.key, "imperfectos", e.target.value)
                              }
                              className="w-20 rounded-lg border border-stone-200 px-2 py-1 text-xs text-right font-mono outline-none focus:ring-1 focus:ring-red-300"
                              placeholder="0"
                            />
                          )}
                        </td>
                        {!yaValidado && !yaEnEmpaque && (
                          <td className="px-3 py-1.5">
                            <button
                              type="button"
                              onClick={() => removeFila(f.key)}
                              className="p-1 rounded hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    <tr className="bg-stone-50">
                      <td className="px-3 py-2 text-xs font-semibold text-stone-700">
                        Total
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-stone-800 text-xs">
                        {totalContado.toLocaleString("es-CO")}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-red-700 text-xs">
                        {totalImperfectos.toLocaleString("es-CO")}
                      </td>
                      {!yaValidado && !yaEnEmpaque && <td />}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {!yaValidado && !yaEnEmpaque && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isPendingGuardar}
                  className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: "#344966" }}
                >
                  <Save className="h-4 w-4" />
                  {isPendingGuardar ? "Guardando…" : "Guardar conteo"}
                </button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      disabled={filas.length === 0 || totalContado === 0}
                      className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                      style={{ backgroundColor: "#0f766e" }}
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Validar y enviar a empaque
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="max-w-md rounded-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Validar conteo?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Se validarán{" "}
                        <strong className="text-stone-800">{totalContado.toLocaleString("es-CO")} unidades</strong>
                        {totalImperfectos > 0 && (
                          <>
                            {" "}(+{" "}
                            <strong className="text-red-700">
                              {totalImperfectos.toLocaleString("es-CO")} imperfectos
                            </strong>
                            )
                          </>
                        )}{" "}
                        para el lote <strong className="text-stone-800">{lote.descripcion ?? padLote(lote.numero_lote)}</strong>.
                        El lote pasará a <strong className="text-stone-800">Empaque</strong>.
                        Esta acción no se puede revertir.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    {diferencia > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>
                            Se registraron{" "}
                            <strong>{registrado.toLocaleString("es-CO")}</strong> unidades
                            (contadas + imperfectos) de{" "}
                            <strong>{lote.cantidad_programada.toLocaleString("es-CO")}</strong>{" "}
                            programadas. Debes justificar la diferencia de{" "}
                            <strong>{diferencia.toLocaleString("es-CO")}</strong> unidades.
                          </span>
                        </div>
                        <textarea
                          value={justificacion}
                          onChange={(e) => setJustificacion(e.target.value)}
                          rows={3}
                          className={`${fieldCls} resize-none`}
                          placeholder="Justificación de la diferencia (obligatoria)…"
                        />
                      </div>
                    )}
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleValidar}
                        disabled={isPendingValidar || (diferencia > 0 && !justificacion.trim())}
                        className="rounded-xl"
                        style={{ backgroundColor: "#0f766e" }}
                      >
                        {isPendingValidar ? "Validando…" : "Validar"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {yaValidado && (
              <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                Conteo validado — lote enviado a empaque
              </div>
            )}

            {conteo?.justificacion_diferencia && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                <p className="text-xs font-semibold mb-0.5">Justificación de la diferencia</p>
                {conteo.justificacion_diferencia}
              </div>
            )}
          </div>
        </form>

        {/* ── Conteo por talla ──────────────────────────────────── */}
        {comparacion.length > 0 && (
          <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-stone-700 border-b border-stone-100 pb-2">
              Conteo por talla
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100">
                    <th className="text-left py-2 text-xs text-stone-500 font-medium">Talla</th>
                    <th className="text-right py-2 text-xs text-stone-500 font-medium">Contado</th>
                    <th className="text-right py-2 text-xs text-stone-500 font-medium">Imperfectos</th>
                  </tr>
                </thead>
                <tbody>
                  {comparacion.map((row) => (
                    <tr key={row.talla} className="border-b border-stone-100 last:border-0">
                      <td className="py-2 font-medium text-stone-800">{row.talla}</td>
                      <td className="py-2 text-right font-mono text-stone-700">
                        {row.contado.toLocaleString("es-CO")}
                      </td>
                      <td className="py-2 text-right font-mono text-red-700">
                        {row.imperfectos.toLocaleString("es-CO")}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-stone-50">
                    <td className="py-2 text-xs font-semibold text-stone-700">Total</td>
                    <td className="py-2 text-right font-mono font-semibold text-stone-800 text-xs">
                      {comparacion.reduce((s, r) => s + r.contado, 0).toLocaleString("es-CO")}
                    </td>
                    <td className="py-2 text-right font-mono font-semibold text-red-700 text-xs">
                      {comparacion.reduce((s, r) => s + r.imperfectos, 0).toLocaleString("es-CO")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
