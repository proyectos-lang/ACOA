"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import {
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Trash2,
  Plus,
  Wallet,
  Banknote,
  CircleDollarSign,
  Pencil,
  Save,
  X,
} from "lucide-react"
import {
  type PagoConContexto,
  type PagoAbonoRow,
  PAGO_ESTADO_LABEL,
  PAGO_ESTADO_COLOR,
} from "@/lib/db/pago"
import {
  registrarAbonoAction,
  eliminarAbonoAction,
  eliminarPagoAction,
  editarPagoAction,
  editarAbonoAction,
} from "@/app/(dashboard)/pagos/actions"
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

function padOP(n: number) {
  return `OP-${String(n).padStart(4, "0")}`
}
function cop(n: number) {
  return `$${Number(n).toLocaleString("es-CO")}`
}
function hoyBogota() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
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

const filtroCls =
  "rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"

// Abono individual: vista, edición inline y eliminación
function AbonoItem({
  abono,
  onMsg,
}: {
  abono: PagoAbonoRow
  onMsg: (tipo: "ok" | "error", msg: string) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editando, setEditando] = React.useState(false)
  const [valor, setValor] = React.useState(String(abono.valor))
  const [fecha, setFecha] = React.useState(abono.fecha)
  const [obs, setObs] = React.useState(abono.observacion ?? "")

  function guardar() {
    const v = parseFloat(valor)
    if (!(v > 0)) return onMsg("error", "Ingresa un valor válido para el abono")
    startTransition(async () => {
      const res = await editarAbonoAction(abono.id, {
        valor: v,
        fecha: fecha || undefined,
        observacion: obs,
      })
      if (res.error) onMsg("error", res.error)
      else {
        onMsg("ok", "Abono actualizado")
        setEditando(false)
        router.refresh()
      }
    })
  }

  function eliminar() {
    startTransition(async () => {
      const res = await eliminarAbonoAction(abono.id)
      if (res.error) onMsg("error", res.error)
      else {
        onMsg("ok", "Abono eliminado")
        router.refresh()
      }
    })
  }

  if (editando) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white border border-[#344966] px-3 py-1.5 text-xs">
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className={`${filtroCls} text-xs py-1`}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className={`${filtroCls} w-28 text-xs py-1`}
        />
        <input
          type="text"
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          className={`${filtroCls} flex-1 min-w-32 text-xs py-1`}
          placeholder="Observación"
        />
        <button
          type="button"
          onClick={guardar}
          disabled={isPending}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: "#344966" }}
        >
          <Save className="h-3 w-3" /> Guardar
        </button>
        <button
          type="button"
          onClick={() => setEditando(false)}
          className="p-1 rounded hover:bg-stone-100 text-stone-400"
          title="Cancelar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-white border border-stone-200 px-3 py-1.5 text-xs">
      <span className="font-mono text-stone-600">{abono.fecha}</span>
      <span className="font-mono font-semibold text-emerald-700">{cop(abono.valor)}</span>
      <span className="flex-1 text-stone-500 truncate">{abono.observacion ?? ""}</span>
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="p-0.5 rounded hover:bg-stone-100 text-stone-400 hover:text-stone-600"
        title="Editar abono"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={eliminar}
        disabled={isPending}
        className="p-0.5 rounded hover:bg-red-50 text-stone-400 hover:text-red-500"
        title="Eliminar abono"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// Fila expandible de un pago: historial de abonos + registrar abono
function PagoFila({
  pago,
  onMsg,
}: {
  pago: PagoConContexto
  onMsg: (tipo: "ok" | "error", msg: string) => void
}) {
  const router = useRouter()
  const [abierto, setAbierto] = React.useState(false)
  const [isPending, startTransition] = useTransition()
  const [valor, setValor] = React.useState("")
  const [fecha, setFecha] = React.useState(hoyBogota())
  const [obs, setObs] = React.useState("")

  const saldo = Number(pago.total) - Number(pago.pagado)

  function abonar() {
    const v = parseFloat(valor)
    if (!(v > 0)) {
      onMsg("error", "Ingresa el valor del abono")
      return
    }
    startTransition(async () => {
      const res = await registrarAbonoAction(pago.id, {
        valor: v,
        fecha: fecha || hoyBogota(),
        observacion: obs.trim() || undefined,
      })
      if (res.error) onMsg("error", res.error)
      else {
        onMsg("ok", `Abono de ${cop(v)} registrado a ${pago.beneficiario}`)
        setValor("")
        setObs("")
        router.refresh()
      }
    })
  }

  // Edición de los datos del pago
  const [editBenef, setEditBenef] = React.useState(pago.beneficiario)
  const [editCant, setEditCant] = React.useState(String(pago.cantidad))
  const [editPrecio, setEditPrecio] = React.useState(String(pago.precio_unitario))

  function guardarPago() {
    const cant = parseInt(editCant, 10)
    const precio = parseFloat(editPrecio)
    if (isNaN(cant) || cant < 0 || isNaN(precio) || precio < 0) {
      return onMsg("error", "Cantidad y precio deben ser válidos")
    }
    startTransition(async () => {
      const res = await editarPagoAction(pago.id, {
        beneficiario: editBenef,
        cantidad: cant,
        precio_unitario: precio,
      })
      if (res.error) onMsg("error", res.error)
      else {
        onMsg("ok", "Pago actualizado")
        router.refresh()
      }
    })
  }

  function quitarPago() {
    startTransition(async () => {
      const res = await eliminarPagoAction(pago.id)
      if (res.error) onMsg("error", res.error)
      else {
        onMsg("ok", "Pago eliminado")
        router.refresh()
      }
    })
  }

  return (
    <>
      <tr
        className="border-b border-stone-100 last:border-0 hover:bg-stone-50 cursor-pointer"
        onClick={() => setAbierto((a) => !a)}
      >
        <td className="px-3 py-2 text-stone-400">
          {abierto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </td>
        <td className="px-3 py-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              pago.proceso === "estampacion"
                ? "bg-pink-100 text-pink-800"
                : "bg-teal-100 text-teal-800"
            }`}
          >
            {pago.proceso === "estampacion" ? "Estampación" : "Confección"}
          </span>
        </td>
        <td className="px-3 py-2 font-mono text-xs text-stone-600">{padOP(pago.numero_op)}</td>
        <td className="px-3 py-2 text-stone-800 font-medium">
          {pago.lote_nombre}
          {pago.prenda_nombre && (
            <span className="ml-1 text-xs text-stone-500">· {pago.prenda_nombre}</span>
          )}
        </td>
        <td className="px-3 py-2 text-stone-800">{pago.beneficiario}</td>
        <td className="px-3 py-2 text-right font-mono text-stone-700">
          {pago.cantidad.toLocaleString("es-CO")}
        </td>
        <td className="px-3 py-2 text-right font-mono text-stone-700">
          {cop(pago.precio_unitario)}
        </td>
        <td className="px-3 py-2 text-right font-mono font-semibold text-stone-800">
          {cop(pago.total)}
        </td>
        <td className="px-3 py-2 text-right font-mono text-emerald-700">{cop(pago.pagado)}</td>
        <td className="px-3 py-2 text-right font-mono font-semibold text-red-700">
          {cop(saldo)}
        </td>
        <td className="px-3 py-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PAGO_ESTADO_COLOR[pago.estado]}`}
          >
            {PAGO_ESTADO_LABEL[pago.estado]}
          </span>
        </td>
      </tr>
      {abierto && (
        <tr className="border-b border-stone-100 bg-stone-50/60">
          <td colSpan={11} className="px-6 py-3">
            <div className="space-y-3">
            {/* Editar datos del pago */}
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-0.5">
                <label className="text-[11px] font-medium text-stone-500">Beneficiario</label>
                <input
                  type="text"
                  value={editBenef}
                  onChange={(e) => setEditBenef(e.target.value)}
                  className={`${filtroCls} w-48 text-xs py-1.5`}
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[11px] font-medium text-stone-500">Cantidad</label>
                <input
                  type="number"
                  min="0"
                  value={editCant}
                  onChange={(e) => setEditCant(e.target.value)}
                  className={`${filtroCls} w-24 text-xs py-1.5`}
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[11px] font-medium text-stone-500">Precio unit. (COP)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editPrecio}
                  onChange={(e) => setEditPrecio(e.target.value)}
                  className={`${filtroCls} w-32 text-xs py-1.5`}
                />
              </div>
              <button
                type="button"
                onClick={guardarPago}
                disabled={isPending}
                className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: "#344966" }}
              >
                <Pencil className="h-3 w-3" /> Guardar cambios
              </button>
              <span className="text-[11px] text-stone-400">
                Total = cantidad × precio; el estado se recalcula con los abonos
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Historial de abonos */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-stone-600">
                  Historial de abonos ({pago.abonos.length})
                </p>
                {pago.abonos.length === 0 ? (
                  <p className="text-xs text-stone-400">Sin abonos registrados.</p>
                ) : (
                  <div className="space-y-1">
                    {pago.abonos.map((a) => (
                      <AbonoItem key={a.id} abono={a} onMsg={onMsg} />
                    ))}
                  </div>
                )}
              </div>

              {/* Registrar abono */}
              <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                <p className="text-xs font-semibold text-stone-600">Registrar abono</p>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[11px] font-medium text-stone-500">Valor (COP)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
                      className={`${filtroCls} w-32 text-xs py-1.5`}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[11px] font-medium text-stone-500">Fecha</label>
                    <input
                      type="date"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      className={`${filtroCls} text-xs py-1.5`}
                    />
                  </div>
                  <div className="space-y-0.5 flex-1 min-w-40">
                    <label className="text-[11px] font-medium text-stone-500">Observación</label>
                    <input
                      type="text"
                      value={obs}
                      onChange={(e) => setObs(e.target.value)}
                      className={`${filtroCls} w-full text-xs py-1.5`}
                      placeholder="Transferencia, efectivo…"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={abonar}
                    disabled={isPending}
                    className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: "#0f766e" }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Abonar
                  </button>
                  {saldo > 0 && (
                    <button
                      type="button"
                      onClick={() => setValor(String(saldo))}
                      className="rounded-lg px-2.5 py-2 text-xs font-medium border border-stone-200 text-stone-600 hover:bg-stone-100"
                    >
                      Saldo completo
                    </button>
                  )}
                </div>

                <div className="pt-1">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-1 text-xs text-stone-400 hover:text-red-500"
                      >
                        <Trash2 className="h-3 w-3" /> Eliminar este pago
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="max-w-md rounded-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar pago?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Se eliminará el pago de <strong>{pago.beneficiario}</strong> (
                          {cop(pago.total)}) y sus {pago.abonos.length} abonos. Esta acción no
                          se puede revertir.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={quitarPago}
                          className="rounded-xl bg-red-600 hover:bg-red-700"
                        >
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export function PagosClient({ pagos }: { pagos: PagoConContexto[] }) {
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)
  const [vista, setVista] = React.useState<"pagos" | "resumen">("pagos")

  const [fOP, setFOP] = React.useState("")
  const [fLote, setFLote] = React.useState("")
  const [fProceso, setFProceso] = React.useState("")
  const [fPersona, setFPersona] = React.useState("")
  const [fEstado, setFEstado] = React.useState("")

  function showToast(tipo: "ok" | "error", msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 4000)
  }

  // Personas para el desplegable de filtro, separadas por proceso
  const estampadoresUnicos = [
    ...new Set(pagos.filter((p) => p.proceso === "estampacion").map((p) => p.beneficiario)),
  ].sort()
  const confeccionistasUnicos = [
    ...new Set(pagos.filter((p) => p.proceso === "confeccion").map((p) => p.beneficiario)),
  ].sort()

  const filtrados = pagos.filter((p) => {
    if (fOP && !padOP(p.numero_op).toLowerCase().includes(fOP.toLowerCase())) return false
    if (fLote && !p.lote_nombre.toLowerCase().includes(fLote.toLowerCase())) return false
    if (fProceso && p.proceso !== fProceso) return false
    if (fPersona && p.beneficiario !== fPersona) return false
    if (fEstado && p.estado !== fEstado) return false
    return true
  })

  const totalAPagar = filtrados.reduce((s, p) => s + Number(p.total), 0)
  const totalPagado = filtrados.reduce((s, p) => s + Number(p.pagado), 0)
  const saldoPendiente = totalAPagar - totalPagado

  // Resumen por persona (sobre los pagos filtrados)
  function resumenPorPersona(proceso: "estampacion" | "confeccion") {
    const map = new Map<
      string,
      { pagos: number; total: number; pagado: number }
    >()
    for (const p of filtrados.filter((x) => x.proceso === proceso)) {
      const r = map.get(p.beneficiario) ?? { pagos: 0, total: 0, pagado: 0 }
      r.pagos += 1
      r.total += Number(p.total)
      r.pagado += Number(p.pagado)
      map.set(p.beneficiario, r)
    }
    return [...map.entries()]
      .map(([nombre, r]) => ({ nombre, ...r, saldo: r.total - r.pagado }))
      .sort((a, b) => b.saldo - a.saldo)
  }

  const resumenEst = resumenPorPersona("estampacion")
  const resumenConf = resumenPorPersona("confeccion")

  const cardCls = "rounded-2xl border border-stone-200 bg-white p-5 flex items-center gap-4"

  return (
    <div className="space-y-4">
      {toast && <Toast tipo={toast.tipo} msg={toast.msg} />}

      {/* ── Tarjetas de totales ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={cardCls}>
          <div className="rounded-xl bg-stone-100 p-3">
            <CircleDollarSign className="h-6 w-6 text-stone-600" />
          </div>
          <div>
            <p className="text-xs text-stone-500">Total a pagar</p>
            <p className="text-xl font-bold text-stone-900 font-mono">{cop(totalAPagar)}</p>
          </div>
        </div>
        <div className={cardCls}>
          <div className="rounded-xl bg-emerald-50 p-3">
            <Banknote className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-stone-500">Total pagado</p>
            <p className="text-xl font-bold text-emerald-700 font-mono">{cop(totalPagado)}</p>
          </div>
        </div>
        <div className={cardCls}>
          <div className="rounded-xl bg-red-50 p-3">
            <Wallet className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <p className="text-xs text-stone-500">Se debe</p>
            <p className="text-xl font-bold text-red-700 font-mono">{cop(saldoPendiente)}</p>
          </div>
        </div>
      </div>

      {/* ── Filtros ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 flex flex-wrap items-end gap-3">
        <div className="space-y-0.5">
          <label className="text-[11px] font-medium text-stone-500">OP</label>
          <input
            type="text"
            value={fOP}
            onChange={(e) => setFOP(e.target.value)}
            className={`${filtroCls} w-32`}
            placeholder="OP-0001"
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-[11px] font-medium text-stone-500">Lote</label>
          <input
            type="text"
            value={fLote}
            onChange={(e) => setFLote(e.target.value)}
            className={`${filtroCls} w-36`}
            placeholder="Lote 1"
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-[11px] font-medium text-stone-500">Proceso</label>
          <select
            value={fProceso}
            onChange={(e) => {
              setFProceso(e.target.value)
              setFPersona("")
            }}
            className={filtroCls}
          >
            <option value="">Todos</option>
            <option value="estampacion">Estampación</option>
            <option value="confeccion">Confección</option>
          </select>
        </div>
        <div className="space-y-0.5">
          <label className="text-[11px] font-medium text-stone-500">
            Estampador / Confeccionista
          </label>
          <select
            value={fPersona}
            onChange={(e) => setFPersona(e.target.value)}
            className={`${filtroCls} min-w-44`}
          >
            <option value="">Todos</option>
            {(fProceso === "" || fProceso === "estampacion") &&
              estampadoresUnicos.map((n) => (
                <option key={`e_${n}`} value={n}>
                  {n} (estampación)
                </option>
              ))}
            {(fProceso === "" || fProceso === "confeccion") &&
              confeccionistasUnicos.map((n) => (
                <option key={`c_${n}`} value={n}>
                  {n} (confección)
                </option>
              ))}
          </select>
        </div>
        <div className="space-y-0.5">
          <label className="text-[11px] font-medium text-stone-500">Estado</label>
          <select
            value={fEstado}
            onChange={(e) => setFEstado(e.target.value)}
            className={filtroCls}
          >
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="parcial">Parcial</option>
            <option value="pagado">Pagado</option>
          </select>
        </div>
        {(fOP || fLote || fProceso || fPersona || fEstado) && (
          <button
            type="button"
            onClick={() => {
              setFOP("")
              setFLote("")
              setFProceso("")
              setFPersona("")
              setFEstado("")
            }}
            className="rounded-xl px-3 py-2 text-xs font-medium border border-stone-200 text-stone-500 hover:bg-stone-50"
          >
            Limpiar filtros
          </button>
        )}

        {/* Selector de vista */}
        <div className="ml-auto flex rounded-xl border border-stone-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setVista("pagos")}
            className={`px-4 py-2 text-xs font-semibold ${
              vista === "pagos" ? "bg-[#344966] text-white" : "bg-white text-stone-600"
            }`}
          >
            Pagos
          </button>
          <button
            type="button"
            onClick={() => setVista("resumen")}
            className={`px-4 py-2 text-xs font-semibold ${
              vista === "resumen" ? "bg-[#344966] text-white" : "bg-white text-stone-600"
            }`}
          >
            Resumen
          </button>
        </div>
      </div>

      {/* ── Vista de pagos ──────────────────────────────────── */}
      {vista === "pagos" && (
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100">
                  <th className="w-8" />
                  <th className="px-3 py-2 text-left text-xs text-stone-500 font-medium">Proceso</th>
                  <th className="px-3 py-2 text-left text-xs text-stone-500 font-medium">OP</th>
                  <th className="px-3 py-2 text-left text-xs text-stone-500 font-medium">Lote</th>
                  <th className="px-3 py-2 text-left text-xs text-stone-500 font-medium">Beneficiario</th>
                  <th className="px-3 py-2 text-right text-xs text-stone-500 font-medium">Cant.</th>
                  <th className="px-3 py-2 text-right text-xs text-stone-500 font-medium">Precio unit.</th>
                  <th className="px-3 py-2 text-right text-xs text-stone-500 font-medium">Total</th>
                  <th className="px-3 py-2 text-right text-xs text-stone-500 font-medium">Pagado</th>
                  <th className="px-3 py-2 text-right text-xs text-stone-500 font-medium">Saldo</th>
                  <th className="px-3 py-2 text-left text-xs text-stone-500 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-sm text-stone-400">
                      No hay pagos habilitados con los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  filtrados.map((p) => <PagoFila key={p.id} pago={p} onMsg={showToast} />)
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Vista resumen por persona ───────────────────────── */}
      {vista === "resumen" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(
            [
              ["Relación por estampador", resumenEst],
              ["Relación por confeccionista", resumenConf],
            ] as const
          ).map(([titulo, rows]) => (
            <div key={titulo} className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
              <h2 className="text-sm font-semibold text-stone-700 border-b border-stone-100 pb-2">
                {titulo}
              </h2>
              {rows.length === 0 ? (
                <p className="text-sm text-stone-400 text-center py-3">Sin pagos registrados.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-100">
                        <th className="text-left py-2 text-xs text-stone-500 font-medium">Nombre</th>
                        <th className="text-right py-2 text-xs text-stone-500 font-medium">Pagos</th>
                        <th className="text-right py-2 text-xs text-stone-500 font-medium">Total</th>
                        <th className="text-right py-2 text-xs text-stone-500 font-medium">Pagado</th>
                        <th className="text-right py-2 text-xs text-stone-500 font-medium">Se debe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.nombre} className="border-b border-stone-100 last:border-0">
                          <td className="py-2 font-medium text-stone-800">{r.nombre}</td>
                          <td className="py-2 text-right font-mono text-stone-600">{r.pagos}</td>
                          <td className="py-2 text-right font-mono text-stone-800">{cop(r.total)}</td>
                          <td className="py-2 text-right font-mono text-emerald-700">{cop(r.pagado)}</td>
                          <td className="py-2 text-right font-mono font-semibold text-red-700">
                            {cop(r.saldo)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-stone-50">
                        <td className="py-2 text-xs font-semibold text-stone-700">Total</td>
                        <td className="py-2 text-right font-mono text-xs font-semibold text-stone-700">
                          {rows.reduce((s, r) => s + r.pagos, 0)}
                        </td>
                        <td className="py-2 text-right font-mono text-xs font-semibold text-stone-800">
                          {cop(rows.reduce((s, r) => s + r.total, 0))}
                        </td>
                        <td className="py-2 text-right font-mono text-xs font-semibold text-emerald-700">
                          {cop(rows.reduce((s, r) => s + r.pagado, 0))}
                        </td>
                        <td className="py-2 text-right font-mono text-xs font-semibold text-red-700">
                          {cop(rows.reduce((s, r) => s + r.saldo, 0))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
