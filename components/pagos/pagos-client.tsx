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
  Paperclip,
  FileDown,
  FileSpreadsheet,
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
  const [recibo, setRecibo] = React.useState<File | null>(null)

  function guardar() {
    const v = parseFloat(valor)
    if (!(v > 0)) return onMsg("error", "Ingresa un valor válido para el abono")
    startTransition(async () => {
      const fd = new FormData()
      fd.set("valor", valor)
      fd.set("fecha", fecha)
      fd.set("observacion", obs)
      if (recibo) fd.set("recibo", recibo)
      const res = await editarAbonoAction(abono.id, fd)
      if (res.error) onMsg("error", res.error)
      else {
        onMsg("ok", "Abono actualizado")
        setEditando(false)
        setRecibo(null)
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
        <label
          className="flex items-center gap-1 text-[11px] text-stone-500 cursor-pointer hover:text-stone-700"
          title="Adjuntar/reemplazar recibo"
        >
          <Paperclip className="h-3.5 w-3.5" />
          {recibo ? recibo.name : "Recibo"}
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setRecibo(e.target.files?.[0] ?? null)}
            className="hidden"
          />
        </label>
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
      {abono.url_recibo && (
        <a
          href={abono.url_recibo}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-0.5 text-teal-700 hover:underline shrink-0"
          title="Ver recibo adjunto"
        >
          <Paperclip className="h-3 w-3" /> Recibo
        </a>
      )}
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
  const [recibo, setRecibo] = React.useState<File | null>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)

  const saldo = Number(pago.total) - Number(pago.pagado)

  function abonar() {
    const v = parseFloat(valor)
    if (!(v > 0)) {
      onMsg("error", "Ingresa el valor del abono")
      return
    }
    startTransition(async () => {
      const fd = new FormData()
      fd.set("valor", valor)
      fd.set("fecha", fecha || hoyBogota())
      fd.set("observacion", obs.trim())
      if (recibo) fd.set("recibo", recibo)
      const res = await registrarAbonoAction(pago.id, fd)
      if (res.error) onMsg("error", res.error)
      else {
        onMsg("ok", `Abono de ${cop(v)} registrado a ${pago.beneficiario}`)
        setValor("")
        setObs("")
        setRecibo(null)
        if (fileRef.current) fileRef.current.value = ""
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
                  <label
                    className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-2 text-xs text-stone-500 cursor-pointer hover:bg-stone-100"
                    title="Adjuntar recibo de pago (imagen o PDF)"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    {recibo ? recibo.name.slice(0, 18) : "Recibo"}
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setRecibo(e.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                  </label>
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
  const [vista, setVista] = React.useState<"pagos" | "resumen" | "historial">("pagos")

  const [fOP, setFOP] = React.useState("")
  const [fLote, setFLote] = React.useState("")
  const [fProceso, setFProceso] = React.useState("")
  const [fPersona, setFPersona] = React.useState("")
  const [fEstado, setFEstado] = React.useState("")
  // Rango de fechas de los pagos realizados (vista Historial)
  const [hDesde, setHDesde] = React.useState("")
  const [hHasta, setHHasta] = React.useState("")

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

  // ── Historial: cada abono es un pago realizado (día, persona, valor) ──
  const movimientos = filtrados
    .flatMap((p) =>
      p.abonos.map((a) => ({
        fecha: a.fecha,
        beneficiario: p.beneficiario,
        proceso: p.proceso,
        numero_op: p.numero_op,
        lote: p.lote_nombre,
        prenda: p.prenda_nombre,
        valor: Number(a.valor),
        observacion: a.observacion,
        url_recibo: a.url_recibo,
      }))
    )
    .filter((m) => (!hDesde || m.fecha >= hDesde) && (!hHasta || m.fecha <= hHasta))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || a.beneficiario.localeCompare(b.beneficiario))

  const dias: Array<{ fecha: string; movs: typeof movimientos; total: number }> = []
  for (const m of movimientos) {
    const ultimo = dias[dias.length - 1]
    if (ultimo && ultimo.fecha === m.fecha) {
      ultimo.movs.push(m)
      ultimo.total += m.valor
    } else {
      dias.push({ fecha: m.fecha, movs: [m], total: m.valor })
    }
  }
  const totalHistorial = movimientos.reduce((s, m) => s + m.valor, 0)

  // ── Exportaciones (PDF impreso / Excel) ─────────────────────
  const esc = (s: string | null | undefined) =>
    (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  function filtrosTexto() {
    const partes: string[] = []
    if (fOP) partes.push(`OP: ${fOP}`)
    if (fLote) partes.push(`Lote: ${fLote}`)
    if (fProceso) partes.push(`Proceso: ${fProceso === "estampacion" ? "Estampación" : "Confección"}`)
    if (fPersona) partes.push(`Persona: ${fPersona}`)
    if (fEstado) partes.push(`Estado: ${fEstado}`)
    if (hDesde) partes.push(`Desde: ${hDesde}`)
    if (hHasta) partes.push(`Hasta: ${hHasta}`)
    return partes.length ? partes.join("  ·  ") : "Sin filtros"
  }

  function abrirPdf(titulo: string, cuerpo: string) {
    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(`<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: letter; margin: 10mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #111; padding: 16px; }
  .encabezado { border: 1.5px solid #111; margin-bottom: 8px; }
  .titulo { background: #f2e14c; font-weight: bold; font-size: 12px; padding: 4px 8px; display: flex; justify-content: space-between; }
  .sub { padding: 3px 8px; color: #444; border-top: 1px solid #111; font-size: 9px; }
  .totales { border: 1.5px solid #111; background: #dcefe4; display: flex; justify-content: space-between; padding: 5px 8px; font-weight: bold; margin-bottom: 8px; }
  h2 { font-size: 10px; margin: 8px 0 3px; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; table-layout: fixed; }
  th, td { border: 1px solid #111; padding: 2px 3px; font-size: 8.5px; text-align: center; word-wrap: break-word; overflow-wrap: break-word; }
  th { background: #eee; text-transform: uppercase; font-size: 8px; }
  td.izq, th.izq { text-align: left; }
  td.num { text-align: right; }
  tr.dia td { background: #eee; font-weight: bold; text-align: left; }
  tr.dia td.num, tr.gran td.num { text-align: right; }
  tr.gran td { background: #dcefe4; font-weight: bold; text-align: left; }
  tr { page-break-inside: avoid; }
  thead { display: table-header-group; }
  @media print { body { padding: 0; } }
</style></head><body>${cuerpo}</body></html>`)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 300)
  }

  function tablaResumenPdf(titulo: string, rows: typeof resumenEst) {
    if (rows.length === 0) return ""
    const filas = rows
      .map(
        (r) =>
          `<tr><td class="izq">${esc(r.nombre)}</td><td class="num">${r.pagos}</td><td class="num">${cop(r.total)}</td><td class="num">${cop(r.pagado)}</td><td class="num">${cop(r.saldo)}</td></tr>`
      )
      .join("")
    return `<h2>${titulo}</h2><table><thead><tr><th class="izq">Nombre</th><th>Pagos</th><th>Total</th><th>Pagado</th><th>Se debe</th></tr></thead><tbody>${filas}</tbody></table>`
  }

  function exportarPdfPagos() {
    const filas = filtrados
      .map(
        (p) => `<tr>
      <td>${p.proceso === "estampacion" ? "Estampación" : "Confección"}</td>
      <td>${padOP(p.numero_op)}</td>
      <td class="izq">${esc(p.lote_nombre)}${p.prenda_nombre ? " · " + esc(p.prenda_nombre) : ""}</td>
      <td class="izq">${esc(p.beneficiario)}</td>
      <td class="num">${p.cantidad.toLocaleString("es-CO")}</td>
      <td class="num">${cop(p.precio_unitario)}</td>
      <td class="num">${cop(p.total)}</td>
      <td class="num">${cop(p.pagado)}</td>
      <td class="num">${cop(Number(p.total) - Number(p.pagado))}</td>
      <td>${PAGO_ESTADO_LABEL[p.estado]}</td>
    </tr>`
      )
      .join("")
    abrirPdf(
      `Pagos consolidado ${hoyBogota()}`,
      `<div class="encabezado">
        <div class="titulo"><span>PAGOS — CONSOLIDADO</span><span>${hoyBogota()}</span></div>
        <div class="sub">Filtros: ${esc(filtrosTexto())}</div>
      </div>
      <div class="totales"><span>TOTAL A PAGAR: ${cop(totalAPagar)}</span><span>PAGADO: ${cop(totalPagado)}</span><span>SE DEBE: ${cop(saldoPendiente)}</span></div>
      <table><thead><tr><th>Proceso</th><th>OP</th><th class="izq">Lote</th><th class="izq">Beneficiario</th><th>Cant.</th><th>Precio</th><th>Total</th><th>Pagado</th><th>Saldo</th><th>Estado</th></tr></thead><tbody>${filas}</tbody></table>
      ${tablaResumenPdf("Relación por estampador", resumenEst)}
      ${tablaResumenPdf("Relación por confeccionista", resumenConf)}`
    )
  }

  function exportarPdfHistorial() {
    const cuerpo = dias
      .map(
        (d) =>
          `<tr class="dia"><td colspan="4">${d.fecha}</td><td class="num">${cop(d.total)}</td><td></td></tr>` +
          d.movs
            .map(
              (m) =>
                `<tr><td></td><td class="izq">${esc(m.beneficiario)}</td><td>${m.proceso === "estampacion" ? "Estampación" : "Confección"}</td><td class="izq">${padOP(m.numero_op)} · ${esc(m.lote)}${m.prenda ? " · " + esc(m.prenda) : ""}</td><td class="num">${cop(m.valor)}</td><td class="izq">${esc(m.observacion)}</td></tr>`
            )
            .join("")
      )
      .join("")
    abrirPdf(
      `Historial de pagos ${hoyBogota()}`,
      `<div class="encabezado">
        <div class="titulo"><span>HISTORIAL DE PAGOS</span><span>${hoyBogota()}</span></div>
        <div class="sub">Filtros: ${esc(filtrosTexto())}</div>
      </div>
      <table><thead><tr><th>Fecha</th><th class="izq">Persona</th><th>Proceso</th><th class="izq">OP / Lote</th><th>Valor</th><th class="izq">Observación</th></tr></thead><tbody>${cuerpo}<tr class="gran"><td colspan="4">TOTAL PAGADO</td><td class="num">${cop(totalHistorial)}</td><td></td></tr></tbody></table>`
    )
  }

  function exportarExcelHistorial() {
    const filas = movimientos
      .map(
        (m) =>
          `<tr><td>${esc(m.fecha)}</td><td>${esc(m.beneficiario)}</td><td>${m.proceso === "estampacion" ? "Estampación" : "Confección"}</td><td>${padOP(m.numero_op)}</td><td>${esc(m.lote)}${m.prenda ? " - " + esc(m.prenda) : ""}</td><td>${m.valor}</td><td>${esc(m.observacion)}</td></tr>`
      )
      .join("")
    const tabla = `<html><head><meta charset="utf-8"></head><body><table border="1"><tr><th>Fecha</th><th>Persona</th><th>Proceso</th><th>OP</th><th>Lote</th><th>Valor</th><th>Observación</th></tr>${filas}<tr><td colspan="5"><b>TOTAL PAGADO</b></td><td><b>${totalHistorial}</b></td><td></td></tr></table></body></html>`
    const blob = new Blob(["﻿" + tabla], { type: "application/vnd.ms-excel" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `historial-pagos-${hoyBogota()}.xls`
    a.click()
    URL.revokeObjectURL(a.href)
  }

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
        <div className="space-y-0.5">
          <label className="text-[11px] font-medium text-stone-500">Pagos desde</label>
          <input
            type="date"
            value={hDesde}
            onChange={(e) => setHDesde(e.target.value)}
            className={filtroCls}
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-[11px] font-medium text-stone-500">Hasta</label>
          <input
            type="date"
            value={hHasta}
            onChange={(e) => setHHasta(e.target.value)}
            className={filtroCls}
          />
        </div>
        {(fOP || fLote || fProceso || fPersona || fEstado || hDesde || hHasta) && (
          <button
            type="button"
            onClick={() => {
              setFOP("")
              setFLote("")
              setFProceso("")
              setFPersona("")
              setFEstado("")
              setHDesde("")
              setHHasta("")
            }}
            className="rounded-xl px-3 py-2 text-xs font-medium border border-stone-200 text-stone-500 hover:bg-stone-50"
          >
            Limpiar filtros
          </button>
        )}

        {/* Exportaciones de la información filtrada */}
        <button
          type="button"
          onClick={vista === "historial" ? exportarPdfHistorial : exportarPdfPagos}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white"
          style={{ backgroundColor: "#344966" }}
          title="PDF consolidado de la información filtrada"
        >
          <FileDown className="h-3.5 w-3.5" /> PDF
        </button>
        {vista === "historial" && (
          <button
            type="button"
            onClick={exportarExcelHistorial}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white"
            style={{ backgroundColor: "#0f766e" }}
            title="Exportar el historial filtrado a Excel"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
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
          <button
            type="button"
            onClick={() => setVista("historial")}
            className={`px-4 py-2 text-xs font-semibold ${
              vista === "historial" ? "bg-[#344966] text-white" : "bg-white text-stone-600"
            }`}
          >
            Historial
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

      {/* ── Vista historial: día por día, qué se pagó a quién ── */}
      {vista === "historial" && (
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-stone-700">
              Historial de pagos realizados ({movimientos.length})
            </h2>
            <span className="text-sm font-mono font-bold text-emerald-700">
              Total pagado: {cop(totalHistorial)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100">
                  <th className="px-3 py-2 text-left text-xs text-stone-500 font-medium">Fecha</th>
                  <th className="px-3 py-2 text-left text-xs text-stone-500 font-medium">Persona</th>
                  <th className="px-3 py-2 text-left text-xs text-stone-500 font-medium">Proceso</th>
                  <th className="px-3 py-2 text-left text-xs text-stone-500 font-medium">OP / Lote</th>
                  <th className="px-3 py-2 text-right text-xs text-stone-500 font-medium">Valor</th>
                  <th className="px-3 py-2 text-left text-xs text-stone-500 font-medium">Observación</th>
                  <th className="px-3 py-2 text-left text-xs text-stone-500 font-medium">Recibo</th>
                </tr>
              </thead>
              <tbody>
                {dias.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-stone-400">
                      No hay pagos realizados con los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  dias.map((d) => (
                    <React.Fragment key={d.fecha}>
                      <tr className="bg-stone-100/70 border-b border-stone-200">
                        <td colSpan={4} className="px-3 py-1.5 text-xs font-bold text-stone-700">
                          {d.fecha}
                          <span className="ml-2 font-normal text-stone-500">
                            ({d.movs.length} {d.movs.length === 1 ? "pago" : "pagos"})
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-xs font-bold text-stone-800">
                          {cop(d.total)}
                        </td>
                        <td colSpan={2} />
                      </tr>
                      {d.movs.map((m, i) => (
                        <tr
                          key={`${d.fecha}_${i}`}
                          className="border-b border-stone-100 hover:bg-stone-50"
                        >
                          <td className="px-3 py-2 font-mono text-xs text-stone-400">{m.fecha}</td>
                          <td className="px-3 py-2 font-medium text-stone-800">{m.beneficiario}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                m.proceso === "estampacion"
                                  ? "bg-pink-100 text-pink-800"
                                  : "bg-teal-100 text-teal-800"
                              }`}
                            >
                              {m.proceso === "estampacion" ? "Estampación" : "Confección"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-stone-600">
                            <span className="font-mono">{padOP(m.numero_op)}</span> · {m.lote}
                            {m.prenda && <span className="text-stone-400"> · {m.prenda}</span>}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-700">
                            {cop(m.valor)}
                          </td>
                          <td className="px-3 py-2 text-xs text-stone-500">{m.observacion ?? ""}</td>
                          <td className="px-3 py-2">
                            {m.url_recibo ? (
                              <a
                                href={m.url_recibo}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-0.5 text-xs text-teal-700 hover:underline"
                              >
                                <Paperclip className="h-3 w-3" /> Ver
                              </a>
                            ) : (
                              <span className="text-xs text-stone-300">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))
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
