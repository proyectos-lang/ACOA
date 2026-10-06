"use client"

import * as React from "react"
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  PackageCheck,
  ShieldCheck,
  Save,
  LayoutGrid,
  ListPlus,
  Boxes,
  Unlock,
} from "lucide-react"
import type { OrdenProduccionRow } from "@/lib/db/orden-produccion"
import type { CurvaTallaRow } from "@/lib/db/curva-talla"
import type { LoteRow } from "@/lib/db/lote"
import { LoteImagenRef } from "@/components/produccion/lote-imagen-ref"
import { LOTE_ESTADO_COLOR, LOTE_ESTADO_LABEL } from "@/lib/db/lote"
import type { ConteoRow, ConteoDetalleRow } from "@/lib/db/conteo"
import type { EmpaqueRegistroRow } from "@/lib/db/empaque-registro"
import type { PersonaRow } from "@/lib/db/persona"
import type { LotePrendaRow } from "@/lib/db/lote-prenda"
import {
  reabrirLoteAction,
  crearEmpaqueRegistroAction,
  eliminarEmpaqueRegistroAction,
  finalizarLoteAction,
} from "@/app/(dashboard)/empaque/[id]/actions"
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
  curvaTallas: CurvaTallaRow[]
  conteo: ConteoRow | null
  conteoDetalle: ConteoDetalleRow[]
  registros: EmpaqueRegistroRow[]
  empacadoras: PersonaRow[]
  // Piezas del conjunto: cada una se empaca y paga por separado
  prendas: LotePrendaRow[]
  // Solo el administrador puede reabrir un lote finalizado
  esAdmin?: boolean
}

// Un grupo es una pieza del conjunto, o el lote entero en OPs de una prenda
interface Grupo {
  prenda_id: number | null
  nombre: string
}

interface ProgresoTalla {
  talla: string
  contado: number
  empacado: number
  imperfectos: number
  pendiente: number
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
const fmt = (n: number) => n.toLocaleString("es-CO")
const claveGrupo = (prendaId: number | null) => (prendaId == null ? "l" : String(prendaId))

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

export function EmpaqueRegistroClient({
  lote,
  orden,
  curvaTallas,
  conteo,
  conteoDetalle,
  registros,
  empacadoras,
  prendas,
  esAdmin = false,
}: Props) {
  const router = useRouter()
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)
  const [isPendingAdd, startAdd] = useTransition()
  const [isPendingDel, startDel] = useTransition()
  const [isPendingFin, startFin] = useTransition()

  const fechaHoyDefault = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
  const esConjunto = orden.tipo_prenda === "conjunto"

  // Grupos: una pieza por grupo en los conjuntos. Los conteos anteriores al
  // registro por pieza (prenda_id null) se muestran aparte para no perderlos.
  const grupos = React.useMemo<Grupo[]>(() => {
    if (!esConjunto) return [{ prenda_id: null, nombre: lote.descripcion ?? padLote(lote.numero_lote) }]
    const g: Grupo[] = prendas.map((p) => ({ prenda_id: p.id, nombre: p.nombre }))
    if (conteoDetalle.some((d) => d.prenda_id == null)) {
      g.push({ prenda_id: null, nombre: "Sin pieza (conteo anterior)" })
    }
    return g
  }, [esConjunto, prendas, conteoDetalle, lote.descripcion, lote.numero_lote])

  const nombrePieza = (prendaId: number | null) =>
    grupos.find((g) => g.prenda_id === prendaId)?.nombre ?? (prendaId == null ? "—" : `pieza ${prendaId}`)

  const [personaId, setPersonaId] = React.useState<string>(
    empacadoras[0] ? String(empacadoras[0].id) : ""
  )
  const [grupoSel, setGrupoSel] = React.useState<string>(claveGrupo(grupos[0]?.prenda_id ?? null))
  const [talla, setTalla] = React.useState("")
  // Segunda pulsacion para aceptar registrar mas de lo contado
  const [confirmoExceso, setConfirmoExceso] = React.useState(false)
  const [cantidad, setCantidad] = React.useState("")
  const [imperfectos, setImperfectos] = React.useState("")
  const [fecha, setFecha] = React.useState(fechaHoyDefault)
  const [justificacion, setJustificacion] = React.useState("")

  // ── Vista rápida por talla (pensada para móvil, como en conteo) ──
  const [vistaRapida, setVistaRapida] = React.useState(true)
  // Lo que se va a registrar en esta pasada, por grupo|talla
  const [gridEmp, setGridEmp] = React.useState<Record<string, string>>({})
  const [gridImp, setGridImp] = React.useState<Record<string, string>>({})
  const [isPendingGrid, startGrid] = useTransition()
  const kGrid = (prendaId: number | null, t: string) => `${claveGrupo(prendaId)}|${t}`

  function setGridValor(
    setter: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    key: string,
    valor: string
  ) {
    setter((prev) => ({ ...prev, [key]: valor }))
  }

  const totalGridEmp = Object.values(gridEmp).reduce((s, v) => s + (parseInt(v, 10) || 0), 0)
  const totalGridImp = Object.values(gridImp).reduce((s, v) => s + (parseInt(v, 10) || 0), 0)

  function showToast(tipo: "ok" | "error", msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 4000)
  }

  // Progreso por talla de un grupo. Se parte de las tallas de la curva para
  // que ninguna quede fuera: si una no se conto, igual queda en evidencia.
  const progresoDe = React.useCallback(
    (prendaId: number | null): ProgresoTalla[] => {
      const map = new Map<string, { talla: string; contado: number }>()
      for (const t of curvaTallas) {
        const k = t.talla.trim().toLowerCase()
        if (!map.has(k)) map.set(k, { talla: t.talla.trim(), contado: 0 })
      }
      for (const d of conteoDetalle) {
        if ((d.prenda_id ?? null) !== prendaId) continue
        const k = d.talla.trim().toLowerCase()
        const prev = map.get(k)
        if (prev) prev.contado += d.cantidad_contada
        else map.set(k, { talla: d.talla.trim(), contado: d.cantidad_contada })
      }
      return [...map.values()].map((p) => {
        const delTalla = registros.filter(
          (r) =>
            (r.prenda_id ?? null) === prendaId &&
            r.talla.trim().toLowerCase() === p.talla.toLowerCase()
        )
        const empacado = delTalla.reduce((s, r) => s + r.cantidad, 0)
        const imperfectosTalla = delTalla.reduce((s, r) => s + (r.imperfectos ?? 0), 0)
        return {
          talla: p.talla,
          contado: p.contado,
          empacado,
          imperfectos: imperfectosTalla,
          pendiente: p.contado - empacado - imperfectosTalla,
        }
      })
    },
    [curvaTallas, conteoDetalle, registros]
  )

  const progresoPorGrupo = grupos.map((g) => ({ g, filas: progresoDe(g.prenda_id) }))
  const hayProgreso = progresoPorGrupo.some((x) => x.filas.length > 0)

  // Totales del lote
  const totalEmpacado = registros.reduce((s, r) => s + r.cantidad, 0)
  const totalImperfectos = registros.reduce((s, r) => s + (r.imperfectos ?? 0), 0)
  const totalContado = conteo?.total_contado ?? 0
  const pct = totalContado > 0 ? Math.min(100, Math.round((totalEmpacado / totalContado) * 100)) : 0

  // Pendientes por grupo (empacado + imperfectos frente a lo contado): en
  // los conjuntos un sobrante de una pieza no tapa el faltante de otra
  const pendientesPorGrupo = progresoPorGrupo
    .map(({ g, filas }) => ({
      g,
      contado: filas.reduce((s, p) => s + p.contado, 0),
      pendiente: Math.max(0, filas.reduce((s, p) => s + Math.max(0, p.pendiente), 0)),
    }))
    .filter((x) => x.contado > 0)
  const faltantes = pendientesPorGrupo.filter((x) => x.pendiente > 0)
  const todoEmpacado = hayProgreso && faltantes.length === 0

  // Una talla se pasa de lo contado cuando lo que se va a registrar
  // supera lo pendiente. No se bloquea: se avisa y se pide justificar.
  function excedeTalla(prendaId: number | null, p: ProgresoTalla): boolean {
    const emp = parseInt(gridEmp[kGrid(prendaId, p.talla)] ?? "", 10) || 0
    const imp = parseInt(gridImp[kGrid(prendaId, p.talla)] ?? "", 10) || 0
    if (emp + imp === 0) return false
    return emp + imp > Math.max(0, p.pendiente)
  }

  const grupoSelId: number | null = grupoSel === "l" ? null : parseInt(grupoSel, 10)
  const progresoSel = progresoDe(grupoSelId)
  const tallasDisponibles = progresoSel.map((p) => p.talla)

  // Disponible por talla del grupo elegido (conteo - ya empacado)
  function disponibleParaTalla(t: string): number {
    const p = progresoSel.find((x) => x.talla.toLowerCase() === t.trim().toLowerCase())
    return p ? Math.max(0, p.pendiente) : 0
  }

  // ── Registrar empaque (individual) ─────────────────────────────
  function handleAdd(e: React.FormEvent, generaPago = true) {
    e.preventDefault()
    const cant = parseInt(cantidad, 10) || 0
    const imperf = parseInt(imperfectos, 10) || 0
    if (cant <= 0 && imperf <= 0)
      return showToast("error", "Ingrese la cantidad empacada o los imperfectos encontrados")
    if (!personaId) return showToast("error", "Seleccione la empacadora")
    if (!talla) return showToast("error", "Seleccione la talla")

    startAdd(async () => {
      const res = await crearEmpaqueRegistroAction({
        lote_id: lote.id,
        persona_id: parseInt(personaId, 10),
        prenda_id: grupoSelId,
        color: "",
        talla,
        cantidad: cant,
        imperfectos: imperf,
        fecha: fecha || undefined,
        genera_pago: generaPago,
      })
      if (res.error) showToast("error", res.error)
      else {
        showToast(
          "ok",
          generaPago
            ? "Registrado en inventario y pago"
            : "Registrado solo en inventario (sin pago)"
        )
        setCantidad("")
        setImperfectos("")
        router.refresh()
      }
    })
  }

  // Registra de una sola vez todas las piezas y tallas con cantidades escritas
  function handleGuardarGrid(generaPago: boolean) {
    if (!personaId) return showToast("error", "Seleccione la empacadora")

    const filas = progresoPorGrupo.flatMap(({ g, filas }) =>
      filas
        .map((p) => ({
          prenda_id: g.prenda_id,
          pieza: g.nombre,
          talla: p.talla,
          cantidad: parseInt(gridEmp[kGrid(g.prenda_id, p.talla)] ?? "", 10) || 0,
          imperfectos: parseInt(gridImp[kGrid(g.prenda_id, p.talla)] ?? "", 10) || 0,
          disponible: Math.max(0, p.pendiente),
        }))
        .filter((f) => f.cantidad > 0 || f.imperfectos > 0)
    )

    if (filas.length === 0) {
      showToast("error", "Ingresa al menos una cantidad o imperfecto")
      return
    }

    // Si se registra mas de lo contado, se avisa una vez y se deja pasar:
    // el conteo puede estar corto y la diferencia se justifica al cerrar.
    const excedidas = filas.filter((f) => f.cantidad + f.imperfectos > f.disponible)
    if (excedidas.length > 0 && !confirmoExceso) {
      setConfirmoExceso(true)
      showToast(
        "error",
        `${excedidas.map((e) => (esConjunto ? `${e.pieza} ${e.talla}` : `Talla ${e.talla}`)).join(", ")}: registras mas de lo contado. Vuelve a pulsar para confirmar; la diferencia se justifica al cerrar el lote.`
      )
      return
    }

    startGrid(async () => {
      let ok = 0
      for (const f of filas) {
        const res = await crearEmpaqueRegistroAction({
          lote_id: lote.id,
          persona_id: parseInt(personaId, 10),
          prenda_id: f.prenda_id,
          color: "",
          talla: f.talla,
          cantidad: f.cantidad,
          imperfectos: f.imperfectos,
          fecha: fecha || undefined,
          genera_pago: generaPago,
        })
        if (res.error) {
          showToast("error", `${esConjunto ? `${f.pieza} ` : "Talla "}${f.talla}: ${res.error}`)
          return
        }
        ok++
      }
      showToast(
        "ok",
        `${ok} registro${ok !== 1 ? "s" : ""}` +
          (generaPago ? " en inventario y pago" : " solo en inventario (sin pago)")
      )
      setGridEmp({})
      setGridImp({})
      setConfirmoExceso(false)
      router.refresh()
    })
  }

  // ── Eliminar registro ──────────────────────────────────────────
  function handleDelete(id: number) {
    startDel(async () => {
      const res = await eliminarEmpaqueRegistroAction(id, lote.id)
      if (res.error) showToast("error", res.error)
      else {
        showToast("ok", "Registro eliminado")
        router.refresh()
      }
    })
  }

  // ── Finalizar lote ─────────────────────────────────────────────
  function handleFinalizar() {
    startFin(async () => {
      const res = await finalizarLoteAction(lote.id, justificacion.trim() || undefined)
      if (res.error) showToast("error", res.error)
      else {
        showToast("ok", "Lote finalizado correctamente")
        router.refresh()
      }
    })
  }

  const [isPendingReabrir, startReabrir] = useTransition()

  function reabrir() {
    startReabrir(async () => {
      const res = await reabrirLoteAction(lote.id)
      if (res.error) showToast("error", res.error)
      else {
        showToast("ok", "Lote reabierto: ya puedes corregir los registros")
        router.refresh()
      }
    })
  }

  const loteActivo = lote.estado === "empaque"
  const fieldCls =
    "w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"

  return (
    <div className="space-y-6">
      {toast && <Toast tipo={toast.tipo} msg={toast.msg} />}

      {/* ── Lote finalizado: historial, solo lectura ─────────── */}
      {lote.estado === "finalizado" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
          <div className="flex items-center gap-3 text-sm text-stone-600">
            <PackageCheck className="h-4 w-4 shrink-0 text-stone-400" />
            <span>
              Este lote ya está finalizado. Lo ves como historial; para corregir lo empacado hay
              que reabrirlo.
            </span>
          </div>
          {esAdmin && (
            <button
              type="button"
              onClick={reabrir}
              disabled={isPendingReabrir}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-50"
            >
              <Unlock className="h-3.5 w-3.5" />
              {isPendingReabrir ? "Reabriendo…" : "Reabrir para corregir"}
            </button>
          )}
        </div>
      )}

      {/* ── Alerta conteo no validado ────────────────────────── */}
      {!conteo?.validado && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          El conteo no está validado. No se puede registrar empaque.
        </div>
      )}

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
            <p className="text-xs text-stone-500">Total contado</p>
            <p className="font-mono font-semibold text-stone-700">{fmt(totalContado)} uds</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Total empacado</p>
            <p className="font-mono font-semibold text-teal-700">{fmt(totalEmpacado)} uds</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Imperfectos</p>
            <p className="font-mono font-semibold text-red-700">{fmt(totalImperfectos)} uds</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Avance</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-20 h-2 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-green-500" : "bg-teal-400"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-stone-600 font-mono">{pct}%</span>
            </div>
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

        {/* Precio empaque/ud */}
        <div className="mt-3 flex items-center gap-1.5 text-xs text-stone-500">
          <ShieldCheck className="h-3.5 w-3.5" />
          Precio empaque: <strong className="text-stone-700 font-mono">{cop(Number(lote.precio_empaque_unidad))}</strong>
          /{esConjunto ? "pieza" : "ud"} (snapshot al momento del registro)
          {esConjunto && <span className="text-stone-400">· cada pieza empacada se paga aparte</span>}
        </div>
      </div>

      {/* ── Vista rápida por talla: pensada para registrar desde el móvil ── */}
      {loteActivo && conteo?.validado && hayProgreso && (
        <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-2">
            <h2 className="text-sm font-semibold text-stone-700">
              Registro rápido por {esConjunto ? "pieza y talla" : "talla"}
            </h2>
            <button
              type="button"
              onClick={() => setVistaRapida((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
            >
              {vistaRapida ? (
                <>
                  <ListPlus className="h-3.5 w-3.5" /> Registro individual
                </>
              ) : (
                <>
                  <LayoutGrid className="h-3.5 w-3.5" /> Vista por talla
                </>
              )}
            </button>
          </div>

          {vistaRapida && (
            <>
              {/* Empacadora y fecha, arriba y a lo ancho para el móvil */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-stone-700">Empacadora *</label>
                  <select value={personaId} onChange={(e) => setPersonaId(e.target.value)} className={fieldCls}>
                    <option value="">Seleccionar empacadora…</option>
                    {empacadoras.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-stone-700">Fecha *</label>
                  <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={fieldCls} />
                </div>
              </div>

              {/* Una grilla por pieza (o una sola en OPs de una prenda) */}
              {progresoPorGrupo.map(({ g, filas }) => {
                if (filas.length === 0) return null
                const pend = pendientesPorGrupo.find((x) => x.g.prenda_id === g.prenda_id)
                return (
                  <div key={claveGrupo(g.prenda_id)} className="space-y-1.5">
                    {esConjunto && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-stone-800">{g.nombre}</span>
                        {pend && (
                          <span className={`text-[11px] ${pend.pendiente === 0 ? "text-green-600" : "text-stone-500"}`}>
                            {pend.pendiente === 0 ? "completa" : `${fmt(pend.pendiente)} pendientes`}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="rounded-xl border border-stone-100 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-stone-50 border-b border-stone-100">
                            <th className="px-2 py-2 text-left text-xs text-stone-500 font-medium">Talla</th>
                            <th className="px-2 py-2 text-right text-xs text-stone-500 font-medium">Pend.</th>
                            <th className="px-2 py-2 text-center text-xs text-stone-500 font-medium">Empacado</th>
                            <th className="px-2 py-2 text-center text-xs text-stone-500 font-medium">Imperf.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filas.map((p) => {
                            const disp = Math.max(0, p.pendiente)
                            const completa = disp === 0
                            const k = kGrid(g.prenda_id, p.talla)
                            const excede = excedeTalla(g.prenda_id, p)
                            return (
                              <tr key={p.talla} className={`border-b border-stone-100 last:border-0 ${completa ? "bg-green-50" : ""}`}>
                                <td className="px-2 py-2 font-semibold text-stone-800">
                                  {p.talla}
                                  <span className="block text-[11px] font-normal text-stone-400">
                                    {fmt(p.empacado)} de {fmt(p.contado)}
                                  </span>
                                </td>
                                <td className="px-2 py-2 text-right">
                                  <span className={`font-mono text-sm font-semibold ${completa ? "text-green-600" : "text-stone-700"}`}>
                                    {completa ? "✓" : fmt(disp)}
                                  </span>
                                </td>
                                <td className="px-2 py-2">
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    min="0"
                                    value={gridEmp[k] ?? ""}
                                    onChange={(e) => setGridValor(setGridEmp, k, e.target.value)}
                                    className={`w-full min-w-16 rounded-lg border px-2 py-2 text-center text-base font-mono outline-none focus:ring-2 focus:ring-[#344966] ${
                                      excede ? "border-amber-400 bg-amber-50" : "border-stone-200"
                                    }`}
                                    placeholder="0"
                                  />
                                </td>
                                <td className="px-2 py-2">
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    min="0"
                                    value={gridImp[k] ?? ""}
                                    onChange={(e) => setGridValor(setGridImp, k, e.target.value)}
                                    className={`w-full min-w-16 rounded-lg border px-2 py-2 text-center text-base font-mono outline-none focus:ring-2 focus:ring-red-300 ${
                                      excede ? "border-amber-400 bg-amber-50" : "border-stone-200"
                                    }`}
                                    placeholder="0"
                                  />
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}

              <div className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-xs">
                <span className="font-semibold text-stone-700">Total a registrar</span>
                <span className="font-mono">
                  <strong className="text-teal-700">{fmt(totalGridEmp)}</strong> empacadas ·{" "}
                  <strong className="text-red-700">{fmt(totalGridImp)}</strong> imperfectos
                </span>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleGuardarGrid(true)}
                  disabled={isPendingGrid || (totalGridEmp === 0 && totalGridImp === 0)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: "#344966" }}
                >
                  <Save className="h-4 w-4" />
                  {isPendingGrid ? "Registrando…" : "Registrar en inventario y pago"}
                </button>
                <button
                  type="button"
                  onClick={() => handleGuardarGrid(false)}
                  disabled={isPendingGrid || (totalGridEmp === 0 && totalGridImp === 0)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                >
                  <Boxes className="h-4 w-4" />
                  {isPendingGrid ? "Registrando…" : "Registrar solo en inventario"}
                </button>
                <p className="text-center text-[11px] text-stone-400">
                  &quot;Solo inventario&quot; carga el producto pero no le genera pago por
                  produccion a la empacadora
                </p>
              </div>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Formulario nuevo registro (individual) ──────── */}
        {loteActivo && conteo?.validado && !vistaRapida && (
          <form onSubmit={handleAdd}>
            <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4 h-full">
              <h2 className="text-sm font-semibold text-stone-700 border-b border-stone-100 pb-2">
                Registrar empaque
              </h2>

              <div className="space-y-1">
                <label className="text-sm font-medium text-stone-700">Empacadora *</label>
                <select value={personaId} onChange={(e) => setPersonaId(e.target.value)} required className={fieldCls}>
                  <option value="">Seleccionar empacadora…</option>
                  {empacadoras.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {esConjunto && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-stone-700">Pieza *</label>
                  <select
                    value={grupoSel}
                    onChange={(e) => {
                      setGrupoSel(e.target.value)
                      setTalla("")
                    }}
                    className={fieldCls}
                  >
                    {grupos.map((g) => (
                      <option key={claveGrupo(g.prenda_id)} value={claveGrupo(g.prenda_id)}>
                        {g.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-sm font-medium text-stone-700">Talla *</label>
                <select value={talla} onChange={(e) => setTalla(e.target.value)} required className={fieldCls}>
                  <option value="">Seleccionar talla…</option>
                  {tallasDisponibles.map((t) => {
                    const disp = disponibleParaTalla(t)
                    return (
                      <option key={t} value={t} disabled={disp === 0}>
                        {t} (disp: {fmt(disp)})
                      </option>
                    )
                  })}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-stone-700">Fecha *</label>
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required className={fieldCls} />
              </div>

              {talla && (
                <p className="text-xs text-stone-500">
                  Disponible para {esConjunto ? `${nombrePieza(grupoSelId)} ` : ""}talla <strong>{talla}</strong>:{" "}
                  <strong className="text-teal-700">{fmt(disponibleParaTalla(talla))} uds</strong>
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-stone-700">Cantidad empacada</label>
                  <input
                    type="number"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    min="0"
                    max={talla ? disponibleParaTalla(talla) : undefined}
                    className={fieldCls}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-stone-700">Imperfectos</label>
                  <input
                    type="number"
                    value={imperfectos}
                    onChange={(e) => setImperfectos(e.target.value)}
                    min="0"
                    className={fieldCls}
                    placeholder="0"
                  />
                  <p className="text-xs text-stone-400">Problemas de calidad encontrados en esta talla</p>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="submit"
                  disabled={isPendingAdd}
                  className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 w-full justify-center"
                  style={{ backgroundColor: "#344966" }}
                >
                  <Plus className="h-4 w-4" />
                  {isPendingAdd ? "Registrando…" : "Registrar en inventario y pago"}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleAdd(e, false)}
                  disabled={isPendingAdd}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-5 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-60"
                >
                  <Boxes className="h-4 w-4" />
                  {isPendingAdd ? "Registrando…" : "Registrar solo en inventario"}
                </button>
                <p className="text-center text-[11px] text-stone-400">
                  &quot;Solo inventario&quot; no le genera pago por produccion a la empacadora
                </p>
              </div>
            </div>
          </form>
        )}

        {/* ── Finalizar lote (fuera del form) ──────────────────── */}
        {loteActivo && conteo?.validado && hayProgreso && (todoEmpacado || totalEmpacado + totalImperfectos > 0) && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                disabled={isPendingFin}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 w-full justify-center"
                style={{ backgroundColor: "#065f46" }}
              >
                <PackageCheck className="h-4 w-4" />
                {isPendingFin ? "Finalizando…" : "Finalizar lote"}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>¿Finalizar el lote?</AlertDialogTitle>
                <AlertDialogDescription>
                  El lote <strong>{lote.descripcion ?? padLote(lote.numero_lote)}</strong> pasará a estado{" "}
                  <strong>Finalizado</strong>. Si es el último lote de la OP, la orden se
                  marcará como <strong>Terminada</strong>. Esta acción no se puede revertir.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {faltantes.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      Quedan unidades contadas sin empacar ni reportar como imperfectas:{" "}
                      {faltantes
                        .map((x) => (esConjunto ? `${x.g.nombre} faltan ${fmt(x.pendiente)}` : `faltan ${fmt(x.pendiente)}`))
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
                  onClick={handleFinalizar}
                  disabled={isPendingFin || (faltantes.length > 0 && !justificacion.trim())}
                  className="rounded-xl"
                  style={{ backgroundColor: "#065f46" }}
                >
                  Finalizar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* ── Progreso del empaque ─────────────────────────── */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-stone-700 border-b border-stone-100 pb-2">
            Progreso del empaque
          </h2>
          {!hayProgreso ? (
            <p className="text-sm text-stone-400 text-center py-4">Sin detalle de conteo.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left py-2 text-xs text-stone-500 font-medium">{esConjunto ? "Pieza / talla" : "Talla"}</th>
                  <th className="text-right py-2 text-xs text-stone-500 font-medium">Contado</th>
                  <th className="text-right py-2 text-xs text-stone-500 font-medium">Empacado</th>
                  <th className="text-right py-2 text-xs text-stone-500 font-medium">Imperfectos</th>
                  <th className="text-right py-2 text-xs text-stone-500 font-medium">Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {progresoPorGrupo.map(({ g, filas }) => {
                  if (filas.length === 0) return null
                  const sub = {
                    contado: filas.reduce((s, p) => s + p.contado, 0),
                    empacado: filas.reduce((s, p) => s + p.empacado, 0),
                    imperfectos: filas.reduce((s, p) => s + p.imperfectos, 0),
                    pendiente: Math.max(0, filas.reduce((s, p) => s + p.pendiente, 0)),
                  }
                  return (
                    <React.Fragment key={claveGrupo(g.prenda_id)}>
                      {esConjunto && (
                        <tr className="bg-stone-50">
                          <td className="py-1.5 text-xs font-semibold text-stone-700">{g.nombre}</td>
                          <td className="py-1.5 text-right font-mono text-xs text-stone-600">{fmt(sub.contado)}</td>
                          <td className="py-1.5 text-right font-mono text-xs text-teal-700">{fmt(sub.empacado)}</td>
                          <td className="py-1.5 text-right font-mono text-xs text-red-700">{fmt(sub.imperfectos)}</td>
                          <td className={`py-1.5 text-right font-mono text-xs font-semibold ${sub.pendiente === 0 ? "text-green-600" : "text-stone-700"}`}>
                            {sub.pendiente === 0 ? "✓" : fmt(sub.pendiente)}
                          </td>
                        </tr>
                      )}
                      {filas.map((p) => (
                        <tr key={p.talla} className={`border-b border-stone-100 last:border-0 ${p.pendiente <= 0 ? "bg-green-50" : ""}`}>
                          <td className={`py-2 font-medium text-stone-800 ${esConjunto ? "pl-4 text-xs" : ""}`}>{p.talla}</td>
                          <td className="py-2 text-right font-mono text-stone-600">{fmt(p.contado)}</td>
                          <td className="py-2 text-right font-mono text-teal-700 font-semibold">{fmt(p.empacado)}</td>
                          <td className="py-2 text-right font-mono text-red-700">{fmt(p.imperfectos)}</td>
                          <td className={`py-2 text-right font-mono font-semibold ${p.pendiente <= 0 ? "text-green-600" : "text-stone-700"}`}>
                            {p.pendiente <= 0 ? "✓" : fmt(p.pendiente)}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  )
                })}
                <tr className="bg-stone-50">
                  <td className="py-2 text-xs font-semibold text-stone-700">Total</td>
                  <td className="py-2 text-right font-mono font-semibold text-stone-800 text-xs">
                    {fmt(progresoPorGrupo.reduce((s, x) => s + x.filas.reduce((a, p) => a + p.contado, 0), 0))}
                  </td>
                  <td className="py-2 text-right font-mono font-semibold text-teal-700 text-xs">{fmt(totalEmpacado)}</td>
                  <td className="py-2 text-right font-mono font-semibold text-red-700 text-xs">{fmt(totalImperfectos)}</td>
                  <td className="py-2 text-right font-mono font-semibold text-stone-800 text-xs">
                    {fmt(faltantes.reduce((s, x) => s + x.pendiente, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Historial de registros ───────────────────────────────── */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-stone-700 border-b border-stone-100 pb-2">
          Historial de registros
        </h2>
        {registros.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-4">Sin registros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  {[
                    "Fecha",
                    "Empacadora",
                    ...(esConjunto ? ["Pieza"] : []),
                    "Talla",
                    "Cantidad",
                    "Imperfectos",
                    "Precio/ud",
                    "Valor",
                    "",
                  ].map((h, i) => (
                    <th key={`${h}-${i}`} className="px-3 py-2 text-left text-xs text-stone-500 font-medium first:pl-0 last:pr-0">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => {
                  const empacadora = empacadoras.find((p) => p.id === r.persona_id)
                  return (
                    <tr key={r.id} className="border-b border-stone-100 last:border-0">
                      <td className="px-3 py-2 text-stone-600 text-xs first:pl-0">{r.fecha}</td>
                      <td className="px-3 py-2 text-stone-700">{empacadora?.nombre ?? `#${r.persona_id}`}</td>
                      {esConjunto && (
                        <td className="px-3 py-2 text-stone-700 text-xs">{nombrePieza(r.prenda_id ?? null)}</td>
                      )}
                      <td className="px-3 py-2 font-medium text-stone-800">
                        {r.talla}
                        {r.genera_pago === false && (
                          <span className="ml-1.5 rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold text-stone-500">
                            solo inventario
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-stone-700">{fmt(r.cantidad)}</td>
                      <td className="px-3 py-2 font-mono text-red-700">{fmt(r.imperfectos ?? 0)}</td>
                      <td className="px-3 py-2 font-mono text-stone-600 text-xs">{cop(Number(r.precio_unidad))}</td>
                      <td className="px-3 py-2 font-mono text-stone-700 text-xs">{cop(Number(r.valor_total))}</td>
                      <td className="px-3 py-2 last:pr-0">
                        {loteActivo && (
                          <button
                            type="button"
                            onClick={() => handleDelete(r.id)}
                            disabled={isPendingDel}
                            className="p-1 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
