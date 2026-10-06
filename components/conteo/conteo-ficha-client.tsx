"use client"

import * as React from "react"
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Save, Plus, Trash2, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react"
import type { OrdenProduccionRow } from "@/lib/db/orden-produccion"
import type { CurvaTallaRow } from "@/lib/db/curva-talla"
import type { LoteRow } from "@/lib/db/lote"
import { LoteImagenRef } from "@/components/produccion/lote-imagen-ref"
import type { LotePrendaRow } from "@/lib/db/lote-prenda"
import { PRENDA_ESTADO_COLOR, PRENDA_ESTADO_LABEL } from "@/lib/db/lote-prenda"
import { LOTE_ESTADO_COLOR, LOTE_ESTADO_LABEL } from "@/lib/db/lote"
import type { ConteoRow, ConteoDetalleRow, ConteoDetalleInput } from "@/lib/db/conteo"
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

// El conteo se registra por talla. En los conjuntos, ademas, por pieza:
// la camiseta y la pantaloneta se cuentan por separado y cada una se
// compara contra lo programado.
interface DetalleFila {
  key: string
  prenda_id: number | null
  color: string
  talla: string
  cantidad_contada: number
  imperfectos: number
}

// Un grupo es una pieza del conjunto, o el lote entero en OPs de una prenda
interface Grupo {
  prenda_id: number | null
  nombre: string
  estado: string | null
  // Lo que entro a conteo: lo que volvio de confeccion, o lo programado
  entraron: number
}

interface Props {
  lote: LoteRow
  orden: OrdenProduccionRow
  curvaTallas: CurvaTallaRow[]
  conteo: ConteoRow | null
  conteoDetalle: ConteoDetalleRow[]
  prendas: LotePrendaRow[]
  // Unidades que volvieron de confeccion (OPs de una prenda)
  entraronLote: number | null
}

function padOP(n: number) {
  return `OP-${String(n).padStart(4, "0")}`
}
function padLote(n: number) {
  return `LOTE-${String(n).padStart(4, "0")}`
}
const fmt = (n: number) => n.toLocaleString("es-CO")

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

const inputNum =
  "rounded-lg border border-stone-200 px-2 py-1 text-xs text-right font-mono outline-none focus:ring-1 focus:ring-[#344966]"

export function ConteoFichaClient({
  lote,
  orden,
  curvaTallas,
  conteo,
  conteoDetalle,
  prendas,
  entraronLote,
}: Props) {
  const router = useRouter()
  const formRef = React.useRef<HTMLFormElement>(null)
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)
  const [isPendingGuardar, startGuardar] = useTransition()
  const [isPendingValidar, startValidar] = useTransition()

  const esConjunto = orden.tipo_prenda === "conjunto"
  const programado = lote.cantidad_programada

  const grupos = React.useMemo<Grupo[]>(() => {
    if (!esConjunto) {
      return [
        {
          prenda_id: null,
          nombre: lote.descripcion ?? padLote(lote.numero_lote),
          estado: null,
          entraron: entraronLote ?? programado,
        },
      ]
    }
    const dePiezas: Grupo[] = prendas.map((p) => ({
      prenda_id: p.id,
      nombre: p.nombre,
      estado: p.estado,
      entraron: p.conf_cantidad_recibida ?? p.est_cantidad_recibida ?? programado,
    }))
    // Conteos registrados antes del detalle por pieza: se muestran aparte
    // para no perderlos ni atribuirlos a una pieza al azar
    if (conteoDetalle.some((d) => d.prenda_id == null)) {
      dePiezas.push({
        prenda_id: null,
        nombre: "Sin pieza (registro anterior)",
        estado: null,
        entraron: programado,
      })
    }
    return dePiezas
  }, [esConjunto, prendas, conteoDetalle, lote.descripcion, lote.numero_lote, entraronLote, programado])

  const [filas, setFilas] = React.useState<DetalleFila[]>(() => {
    const out: DetalleFila[] = []
    for (const g of grupos) {
      const delGrupo = conteoDetalle.filter((d) => (d.prenda_id ?? null) === g.prenda_id)
      if (delGrupo.length > 0) {
        // Agrupar el detalle existente por talla
        const porTalla = new Map<string, { cantidad: number; imperfectos: number }>()
        const ordenTallas: string[] = []
        for (const d of delGrupo) {
          const t = d.talla.trim()
          if (!porTalla.has(t)) {
            ordenTallas.push(t)
            porTalla.set(t, { cantidad: 0, imperfectos: 0 })
          }
          const acc = porTalla.get(t) as { cantidad: number; imperfectos: number }
          acc.cantidad += d.cantidad_contada
          acc.imperfectos += d.imperfectos ?? 0
        }
        for (const t of ordenTallas) {
          out.push({
            key: `${g.prenda_id ?? "l"}_t_${t}`,
            prenda_id: g.prenda_id,
            color: "",
            talla: t,
            cantidad_contada: porTalla.get(t)?.cantidad ?? 0,
            imperfectos: porTalla.get(t)?.imperfectos ?? 0,
          })
        }
      } else if (g.prenda_id !== null || !esConjunto) {
        // Pre-llenar con las tallas de la OP
        for (const ct of curvaTallas) {
          out.push({
            key: `${g.prenda_id ?? "l"}_ct_${ct.id}`,
            prenda_id: g.prenda_id,
            color: "",
            talla: ct.talla,
            cantidad_contada: 0,
            imperfectos: 0,
          })
        }
      }
    }
    return out
  })

  function showToast(tipo: "ok" | "error", msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 4000)
  }

  function addFila(prendaId: number | null) {
    setFilas((prev) => [
      ...prev,
      {
        key: `new_${prendaId ?? "l"}_${Date.now()}`,
        prenda_id: prendaId,
        color: "",
        talla: "",
        cantidad_contada: 0,
        imperfectos: 0,
      },
    ])
  }

  function removeFila(key: string) {
    setFilas((prev) => prev.filter((f) => f.key !== key))
  }

  function updateFila(key: string, field: keyof DetalleFila, value: string) {
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

  // Resumen de un grupo: contado, imperfectos y diferencia frente a lo
  // programado (contadas + imperfectos deben cubrir lo programado)
  function resumen(g: Grupo) {
    const delGrupo = filas.filter((f) => f.prenda_id === g.prenda_id)
    const contado = delGrupo.reduce((s, f) => s + (f.cantidad_contada || 0), 0)
    const imperfectos = delGrupo.reduce((s, f) => s + (f.imperfectos || 0), 0)
    const registrado = contado + imperfectos
    return { contado, imperfectos, registrado, faltan: Math.max(0, programado - registrado) }
  }

  const totalContado = filas.reduce((s, f) => s + (f.cantidad_contada || 0), 0)
  const totalImperfectos = filas.reduce((s, f) => s + (f.imperfectos || 0), 0)
  const gruposReales = grupos.filter((g) => g.prenda_id !== null || !esConjunto)
  const faltantes = gruposReales
    .map((g) => ({ g, r: resumen(g) }))
    .filter((x) => x.r.faltan > 0)
  const hayFaltante = faltantes.length > 0
  const [justificacion, setJustificacion] = React.useState("")

  // Piezas que aun no han llegado a conteo: el lote no se valida sin ellas
  const sinLlegar = esConjunto
    ? prendas.filter((p) => p.estado === "estampacion" || p.estado === "confeccion")
    : []
  const todasConCantidad = gruposReales.every((g) => resumen(g).contado > 0)

  function filasLimpias(): ConteoDetalleInput[] {
    return filas
      .filter((f) => f.talla.trim())
      .map((f) => ({
        prenda_id: f.prenda_id,
        color: f.color.trim(),
        talla: f.talla.trim(),
        cantidad_contada: f.cantidad_contada,
        imperfectos: f.imperfectos,
      }))
  }

  function handleGuardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startGuardar(async () => {
      const res = await guardarConteoAction(lote.id, fd, filasLimpias())
      if (res.error) showToast("error", res.error)
      else {
        showToast("ok", `Conteo guardado — total: ${fmt(res.total_contado ?? 0)} uds`)
        router.refresh()
      }
    })
  }

  function handleValidar() {
    const fd = formRef.current ? new FormData(formRef.current) : new FormData()
    startValidar(async () => {
      const res = await validarConteoAction(
        lote.id,
        fd,
        filasLimpias(),
        justificacion.trim() || undefined
      )
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
  const soloLectura = yaValidado || yaEnEmpaque

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
            <p className="text-xs text-stone-500">Tipo</p>
            <p className="font-medium text-stone-800">
              {esConjunto ? `Conjunto · ${prendas.length} pieza(s)` : "Prenda"}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Programado{esConjunto ? " (por pieza)" : ""}</p>
            <p className="font-mono font-semibold text-stone-700">{fmt(programado)} uds</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Total contado</p>
            <p className="font-mono font-semibold text-teal-700">
              {fmt(conteo?.total_contado ?? totalContado)} uds
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Imperfectos</p>
            <p className="font-mono font-semibold text-red-700">{fmt(totalImperfectos)} uds</p>
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

      {sinLlegar.length > 0 && !soloLectura && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Aún no han llegado a conteo:{" "}
            {sinLlegar.map((p) => `${p.nombre} (${PRENDA_ESTADO_LABEL[p.estado]})`).join(", ")}.
            Puedes ir contando las que ya llegaron; el lote se valida cuando estén todas.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Formulario conteo ──────────────────────────────── */}
        <form ref={formRef} onSubmit={handleGuardar} className="lg:col-span-2">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-5 h-full">
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
                  disabled={soloLectura}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-stone-700">Observación</label>
                <input
                  type="text"
                  name="observacion"
                  defaultValue={conteo?.observacion ?? ""}
                  className={fieldCls}
                  placeholder="Observaciones del conteo…"
                  disabled={soloLectura}
                />
              </div>
            </div>

            {/* Una grilla por pieza (o una sola en OPs de una prenda) */}
            {grupos.map((g) => {
              const delGrupo = filas.filter((f) => f.prenda_id === g.prenda_id)
              const r = resumen(g)
              const llego = !g.estado || (g.estado !== "estampacion" && g.estado !== "confeccion")
              const editable = !soloLectura && llego
              return (
                <div key={g.prenda_id ?? "lote"} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-stone-800">
                        {esConjunto ? g.nombre : "Detalle por talla"}
                      </span>
                      {g.estado && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            PRENDA_ESTADO_COLOR[g.estado as keyof typeof PRENDA_ESTADO_COLOR] ??
                            "bg-stone-100 text-stone-600"
                          }`}
                        >
                          {PRENDA_ESTADO_LABEL[g.estado as keyof typeof PRENDA_ESTADO_LABEL] ?? g.estado}
                        </span>
                      )}
                      <span className="text-[11px] text-stone-400">
                        programadas {fmt(programado)}
                        {g.entraron !== programado && ` · entraron ${fmt(g.entraron)}`}
                      </span>
                    </div>
                    {editable && (
                      <button
                        type="button"
                        onClick={() => addFila(g.prenda_id)}
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
                          {editable && <th className="w-8" />}
                        </tr>
                      </thead>
                      <tbody>
                        {delGrupo.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-3 py-3 text-center text-xs text-stone-400">
                              {llego ? "Sin filas — agrega una talla" : "Esta pieza aún no llega a conteo"}
                            </td>
                          </tr>
                        )}
                        {delGrupo.map((f) => (
                          <tr key={f.key} className="border-b border-stone-100 last:border-0">
                            <td className="px-3 py-1.5">
                              {!editable ? (
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
                              {!editable ? (
                                <span className="font-mono text-stone-700">{fmt(f.cantidad_contada)}</span>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  value={f.cantidad_contada || ""}
                                  onChange={(e) => updateFila(f.key, "cantidad_contada", e.target.value)}
                                  className={`w-24 ${inputNum}`}
                                />
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              {!editable ? (
                                <span className="font-mono text-red-700">{fmt(f.imperfectos)}</span>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  value={f.imperfectos || ""}
                                  onChange={(e) => updateFila(f.key, "imperfectos", e.target.value)}
                                  className={`w-20 ${inputNum} focus:ring-red-300`}
                                  placeholder="0"
                                />
                              )}
                            </td>
                            {editable && (
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
                        <tr className={r.faltan > 0 ? "bg-amber-50" : "bg-stone-50"}>
                          <td className="px-3 py-2 text-xs font-semibold text-stone-700">
                            Total
                            {r.faltan > 0 && (
                              <span className="ml-2 font-normal text-amber-700">
                                faltan {fmt(r.faltan)} frente a lo programado
                              </span>
                            )}
                            {r.faltan === 0 && r.registrado > programado && (
                              <span className="ml-2 font-normal text-emerald-700">
                                +{fmt(r.registrado - programado)} sobre lo programado
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-stone-800 text-xs">
                            {fmt(r.contado)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-red-700 text-xs">
                            {fmt(r.imperfectos)}
                          </td>
                          {editable && <td />}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}

            {!soloLectura && (
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
                      disabled={filas.length === 0 || totalContado === 0 || sinLlegar.length > 0 || !todasConCantidad}
                      title={
                        sinLlegar.length > 0
                          ? "Faltan piezas por llegar a conteo"
                          : !todasConCantidad
                            ? "Todas las piezas deben tener cantidades"
                            : "Validar y enviar a empaque"
                      }
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
                      <AlertDialogDescription asChild>
                        <div className="space-y-2 text-sm">
                          <p>
                            Se validarán{" "}
                            <strong className="text-stone-800">{fmt(totalContado)} unidades</strong>
                            {totalImperfectos > 0 && (
                              <>
                                {" "}(+ <strong className="text-red-700">{fmt(totalImperfectos)} imperfectos</strong>)
                              </>
                            )}{" "}
                            para el lote{" "}
                            <strong className="text-stone-800">{lote.descripcion ?? padLote(lote.numero_lote)}</strong>.
                          </p>
                          {esConjunto && (
                            <ul className="list-disc pl-5 text-stone-600">
                              {gruposReales.map((g) => {
                                const r = resumen(g)
                                return (
                                  <li key={g.prenda_id ?? "l"}>
                                    {g.nombre}: {fmt(r.contado)} contadas
                                    {r.imperfectos > 0 && `, ${fmt(r.imperfectos)} imperfectos`}
                                  </li>
                                )
                              })}
                            </ul>
                          )}
                          <p>
                            El lote pasará a <strong className="text-stone-800">Empaque</strong>. Esta
                            acción no se puede revertir.
                          </p>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    {hayFaltante && (
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>
                            Se registraron menos unidades (contadas + imperfectos) de las{" "}
                            <strong>{fmt(programado)}</strong> programadas:{" "}
                            {faltantes
                              .map((x) => `${x.g.nombre} faltan ${fmt(x.r.faltan)}`)
                              .join("; ")}
                            . Debes justificar la diferencia.
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
                        disabled={isPendingValidar || (hayFaltante && !justificacion.trim())}
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

        {/* ── Programado vs real ─────────────────────────────────── */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-stone-700 border-b border-stone-100 pb-2">
            Programado vs real
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left py-2 text-xs text-stone-500 font-medium">
                    {esConjunto ? "Pieza" : "Concepto"}
                  </th>
                  <th className="text-right py-2 text-xs text-stone-500 font-medium">Prog.</th>
                  <th className="text-right py-2 text-xs text-stone-500 font-medium">Entraron</th>
                  <th className="text-right py-2 text-xs text-stone-500 font-medium">Contado</th>
                  <th className="text-right py-2 text-xs text-stone-500 font-medium">Dif.</th>
                </tr>
              </thead>
              <tbody>
                {gruposReales.map((g) => {
                  const r = resumen(g)
                  const dif = r.registrado - programado
                  return (
                    <tr key={g.prenda_id ?? "l"} className="border-b border-stone-100 last:border-0">
                      <td className="py-2 font-medium text-stone-800">{g.nombre}</td>
                      <td className="py-2 text-right font-mono text-stone-500">{fmt(programado)}</td>
                      <td className="py-2 text-right font-mono text-stone-500">{fmt(g.entraron)}</td>
                      <td className="py-2 text-right font-mono text-stone-800">
                        {fmt(r.contado)}
                        {r.imperfectos > 0 && (
                          <span className="block text-[10px] text-red-600">+{fmt(r.imperfectos)} imp.</span>
                        )}
                      </td>
                      <td
                        className={`py-2 text-right font-mono font-semibold ${
                          dif < 0 ? "text-red-600" : dif > 0 ? "text-emerald-600" : "text-stone-400"
                        }`}
                      >
                        {dif > 0 ? "+" : ""}
                        {fmt(dif)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-stone-400">
            La diferencia compara contadas + imperfectos contra lo programado en la OP.
            {esConjunto && " Cada pieza del conjunto lleva las mismas unidades programadas que el lote."}
          </p>
        </div>
      </div>
    </div>
  )
}
