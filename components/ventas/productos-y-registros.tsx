"use client"

import * as React from "react"
import { TablaInteractiva } from "@/components/ui/tabla-interactiva"
import { useTransition } from "react"
import {
  CheckCircle2,
  AlertTriangle,
  Building2,
  Package,
  FileSpreadsheet,
  Search,
  ChevronRight,
  ChevronDown,
  Save,
  Plus,
  Printer,
  Pencil,
  Ban,
  Trash2,
} from "lucide-react"
import type {
  ReferenciaVentaRow,
  EmpresaProducto,
  VentaPorEmpresa,
  ResumenEmpresa,
} from "@/lib/db/venta"
import { EMPRESAS, EMPRESA_COLOR, ESTADO_VENTA_LABEL, ESTADO_VENTA_COLOR } from "@/lib/db/venta"
import {
  guardarProductoAction,
  cambiarEmpresaProductoAction,
  cargarVentasPorEmpresaAction,
  cargarResumenEmpresasAction,
} from "@/app/(dashboard)/ventas/productos-actions"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

function pesos(n: number) {
  return "$" + Math.round(n).toLocaleString("es-CO")
}
function miles(n: number) {
  return n.toLocaleString("es-CO")
}

const inputCls =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
const filtroCls =
  "rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"

// ── Maestro de productos ────────────────────────────────────────

export function MaestroProductos({
  referencias,
  onMsg,
  onRefrescar,
}: {
  referencias: ReferenciaVentaRow[]
  onMsg: (tipo: "ok" | "error", msg: string) => void
  onRefrescar: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [busca, setBusca] = React.useState("")
  const [fEmpresa, setFEmpresa] = React.useState<EmpresaProducto | "">("")
  const [nuevo, setNuevo] = React.useState(false)

  const [nRef, setNRef] = React.useState("")
  const [nDesc, setNDesc] = React.useState("")
  const [nPrecio, setNPrecio] = React.useState(0)
  const [nEmpresa, setNEmpresa] = React.useState<EmpresaProducto>("ACOA")

  const filtradas = React.useMemo(() => {
    const q = busca.trim().toLowerCase()
    return referencias.filter((r) => {
      if (fEmpresa && r.empresa !== fEmpresa) return false
      if (!q) return true
      return (
        r.referencia.toLowerCase().includes(q) ||
        (r.descripcion ?? "").toLowerCase().includes(q)
      )
    })
  }, [referencias, busca, fEmpresa])

  function guardar() {
    if (!nRef.trim()) return onMsg("error", "Indica la referencia")
    startTransition(async () => {
      const r = await guardarProductoAction({
        referencia: nRef,
        descripcion: nDesc,
        valor_unidad: nPrecio,
        empresa: nEmpresa,
      })
      if (r.error) return onMsg("error", r.error)
      onMsg("ok", `Producto ${nRef.toUpperCase()} guardado`)
      setNRef("")
      setNDesc("")
      setNPrecio(0)
      setNuevo(false)
      onRefrescar()
    })
  }

  function cambiarEmpresa(id: number, empresa: EmpresaProducto) {
    startTransition(async () => {
      const r = await cambiarEmpresaProductoAction(id, empresa)
      if (r.error) return onMsg("error", r.error)
      onMsg("ok", `Producto movido a ${empresa}`)
      onRefrescar()
    })
  }

  const porEmpresa = EMPRESAS.map((e) => ({
    empresa: e,
    cuantos: referencias.filter((r) => r.empresa === e).length,
  }))

  return (
    <div className="space-y-4">
      <Card className="p-0">
        <div className="flex flex-wrap divide-x divide-stone-100">
          <div className="min-w-[160px] flex-1 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-stone-400">Productos</p>
            <p className="text-xl font-bold text-stone-900">{miles(referencias.length)}</p>
          </div>
          {porEmpresa.map((p) => (
            <div key={p.empresa} className="min-w-[160px] flex-1 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-stone-400">{p.empresa}</p>
              <p className="text-xl font-bold text-stone-900">{miles(p.cuantos)}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="block text-[11px] font-medium text-stone-500">
              Referencia o descripcion
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
              <input
                className={`${filtroCls} w-full pl-8`}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar..."
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-stone-500">Empresa</label>
            <select
              className={filtroCls}
              value={fEmpresa}
              onChange={(e) => setFEmpresa(e.target.value as EmpresaProducto | "")}
            >
              <option value="">Todas</option>
              {EMPRESAS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setNuevo((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600 hover:bg-stone-50"
          >
            <Plus className="h-4 w-4" /> Nuevo producto
          </button>
          <span className="ml-auto text-xs text-stone-400">
            {filtradas.length} de {referencias.length}
          </span>
        </div>

        {nuevo && (
          <div className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3 sm:grid-cols-5">
            <input
              className={inputCls}
              value={nRef}
              onChange={(e) => setNRef(e.target.value)}
              placeholder="Referencia"
            />
            <input
              className={`${inputCls} sm:col-span-2`}
              value={nDesc}
              onChange={(e) => setNDesc(e.target.value)}
              placeholder="Descripcion"
            />
            <input
              type="number"
              min={0}
              className={inputCls}
              value={nPrecio || ""}
              onChange={(e) => setNPrecio(Number(e.target.value) || 0)}
              placeholder="Precio"
            />
            <div className="flex gap-2">
              <select
                className={inputCls}
                value={nEmpresa}
                onChange={(e) => setNEmpresa(e.target.value as EmpresaProducto)}
              >
                {EMPRESAS.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
              <button
                onClick={guardar}
                disabled={isPending}
                className="shrink-0 rounded-xl bg-[#344966] px-3 py-2 text-sm font-medium text-white hover:bg-[#2a3b52] disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-0">
        <TablaInteractiva>
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="sticky top-0 bg-stone-50">
              <tr className="border-b border-stone-200">
                {["Referencia", "Descripcion", "Precio", "Empresa", ""].map((h, i) => (
                  <th
                    key={`${h}_${i}`}
                    className="px-3 py-2 text-left text-xs font-semibold uppercase text-stone-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-stone-400">
                    Sin productos con esos filtros
                  </td>
                </tr>
              ) : (
                filtradas.map((r) => (
                  <tr key={r.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                    <td className="px-3 py-2 font-semibold text-stone-800">{r.referencia}</td>
                    <td className="px-3 py-2 text-stone-600">{r.descripcion ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-stone-800">
                      {pesos(Number(r.valor_unidad))}
                    </td>
                    <td className="px-3 py-2">
                      <Badge className={EMPRESA_COLOR[r.empresa]}>{r.empresa}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={r.empresa}
                        onChange={(e) =>
                          cambiarEmpresa(r.id, e.target.value as EmpresaProducto)
                        }
                        disabled={isPending}
                        className="rounded-lg border border-stone-200 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-[#344966]"
                      >
                        {EMPRESAS.map((e) => (
                          <option key={e} value={e}>
                            {e}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </TablaInteractiva>
      </Card>
    </div>
  )
}

// ── Registro de ventas: global o por empresa ────────────────────

export function RegistroVentas({
  empresa,
  descripcion,
  onMsg,
  onImprimir,
  onEditar,
  onAnular,
  onEliminar,
  onCambiarEmpresa,
  recargarToken,
}: {
  empresa: EmpresaProducto | null
  descripcion: string
  onMsg: (tipo: "ok" | "error", msg: string) => void
  // Imprime la factura completa: la reimpresion siempre es del documento
  onImprimir?: (ventaId: number) => void
  onEditar?: (ventaId: number) => void
  // Anular conserva el documento y devuelve el inventario; eliminar lo
  // borra y libera el consecutivo
  onAnular?: (ventaId: number) => void
  onEliminar?: (ventaId: number) => void
  onCambiarEmpresa?: (e: EmpresaProducto | null) => void
  // Cambia su valor para forzar la recarga de la tabla tras anular o eliminar
  recargarToken?: number
}) {
  const [isPending, startTransition] = useTransition()
  const [ventas, setVentas] = React.useState<VentaPorEmpresa[]>([])
  const [resumen, setResumen] = React.useState<ResumenEmpresa[]>([])
  const [mixtas, setMixtas] = React.useState(0)
  const [cargado, setCargado] = React.useState(false)
  const [abiertas, setAbiertas] = React.useState<Set<number>>(new Set())

  const [fDesde, setFDesde] = React.useState("")
  const [fHasta, setFHasta] = React.useState("")
  const [fTexto, setFTexto] = React.useState("")

  const cargar = React.useCallback(
    (desde: string, hasta: string) => {
      startTransition(async () => {
        const [v, r] = await Promise.all([
          cargarVentasPorEmpresaAction({ empresa, desde, hasta }),
          cargarResumenEmpresasAction({ desde, hasta }),
        ])
        if (v.error) return onMsg("error", v.error)
        setVentas(v.ventas ?? [])
        setResumen(r.resumen ?? [])
        setMixtas(r.mixtas ?? 0)
        setCargado(true)
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [empresa]
  )

  React.useEffect(() => {
    setCargado(false)
    cargar(fDesde, fHasta)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa, recargarToken])

  const filtradas = React.useMemo(() => {
    const q = fTexto.trim().toLowerCase()
    if (!q) return ventas
    return ventas.filter(
      (v) =>
        v.numero_documento.toLowerCase().includes(q) ||
        v.cliente_nombre.toLowerCase().includes(q) ||
        (v.ciudad ?? "").toLowerCase().includes(q)
    )
  }, [ventas, fTexto])

  const totalValor = filtradas
    .filter((v) => v.estado !== "anulada")
    .reduce((s, v) => s + v.total_valor, 0)
  const totalUnidades = filtradas
    .filter((v) => v.estado !== "anulada")
    .reduce((s, v) => s + v.total_unidades, 0)
  const lineas = filtradas.reduce((s, v) => s + v.detalle.length, 0)

  function alternar(id: number) {
    setAbiertas((prev) => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })
  }

  function exportar() {
    const enc = [
      "FECHA",
      "DOCUMENTO",
      "CLIENTE",
      "CIUDAD",
      "REFERENCIA",
      "DESCRIPCION",
      "EMPRESA",
      "TALLA",
      "CANTIDAD",
      "VR UNIDAD",
      "TOTAL",
      "ESTADO",
    ]
    const filas: string[] = []
    for (const v of filtradas) {
      for (const d of v.detalle) {
        filas.push(
          `<tr><td>${v.fecha}</td><td>${v.numero_documento}</td><td>${v.cliente_nombre}</td><td>${
            v.ciudad ?? ""
          }</td><td>${d.referencia}</td><td>${d.descripcion ?? ""}</td><td>${
            d.empresa ?? ""
          }</td><td>${d.talla ?? ""}</td><td>${d.cantidad}</td><td>${Number(
            d.valor_unidad
          )}</td><td>${Number(d.valor_total)}</td><td>${ESTADO_VENTA_LABEL[v.estado]}</td></tr>`
        )
      }
    }
    const html = `<table border="1"><thead><tr>${enc
      .map((h) => `<th>${h}</th>`)
      .join("")}</tr></thead><tbody>${filas.join("")}</tbody></table>`
    const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ventas_${empresa ?? "global"}_${new Date()
      .toLocaleDateString("en-CA", { timeZone: "America/Bogota" })}.xls`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <Card className="p-0">
        <div className="flex flex-wrap divide-x divide-stone-100">
          <div className="min-w-[170px] flex-1 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-stone-400">
              {empresa ? `Facturado ${empresa}` : "Facturado total"}
            </p>
            <p className="text-2xl font-bold" style={{ color: "#2a78d6" }}>
              {pesos(totalValor)}
            </p>
            <p className="text-xs text-stone-400">{descripcion}</p>
          </div>
          <div className="min-w-[150px] flex-1 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-stone-400">Facturas</p>
            <p className="text-2xl font-bold text-stone-900">{miles(filtradas.length)}</p>
            <p className="text-xs text-stone-400">{miles(lineas)} lineas</p>
          </div>
          <div className="min-w-[150px] flex-1 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-stone-400">Unidades</p>
            <p className="text-2xl font-bold text-stone-900">{miles(totalUnidades)}</p>
          </div>
          {!empresa &&
            resumen.map((r) => (
              <div key={r.empresa} className="min-w-[170px] flex-1 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-stone-400">{r.empresa}</p>
                <p className="text-lg font-bold text-stone-800">{pesos(r.valor)}</p>
                <p className="text-xs text-stone-400">
                  {miles(r.facturas)} fact. · {miles(r.unidades)} und
                </p>
              </div>
            ))}
        </div>
      </Card>

      {!empresa && mixtas > 0 && (
        <Card className="border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-2 text-xs text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {mixtas} factura(s) mezclan productos de ACOA y GOODFATHER. En el registro de cada
            empresa aparecen solo con las lineas que le corresponden.
          </p>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] font-medium text-stone-500">Desde</label>
            <input
              type="date"
              className={filtroCls}
              value={fDesde}
              onChange={(e) => {
                setFDesde(e.target.value)
                cargar(e.target.value, fHasta)
              }}
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-stone-500">Hasta</label>
            <input
              type="date"
              className={filtroCls}
              value={fHasta}
              onChange={(e) => {
                setFHasta(e.target.value)
                cargar(fDesde, e.target.value)
              }}
            />
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="block text-[11px] font-medium text-stone-500">
              Documento, cliente o ciudad
            </label>
            <input
              className={`${filtroCls} w-full`}
              value={fTexto}
              onChange={(e) => setFTexto(e.target.value)}
              placeholder="Buscar..."
            />
          </div>
          {onCambiarEmpresa && (
            <div>
              <label className="block text-[11px] font-medium text-stone-500">Ver</label>
              <select
                className={filtroCls}
                value={empresa ?? ""}
                onChange={(e) =>
                  onCambiarEmpresa((e.target.value || null) as EmpresaProducto | null)
                }
              >
                <option value="">Global (todo)</option>
                {EMPRESAS.map((e) => (
                  <option key={e} value={e}>
                    Solo {e}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={exportar}
            className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600 hover:bg-stone-50"
          >
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </button>
        </div>
      </Card>

      <Card className="p-0">
        <TablaInteractiva>
        <div className="max-h-[620px] overflow-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="sticky top-0 bg-stone-50">
              <tr className="border-b border-stone-200">
                {[
                  "",
                  "Documento",
                  "Fecha",
                  "Cliente",
                  "Lineas",
                  "Unidades",
                  empresa ? `Valor ${empresa}` : "Valor",
                  "Estado",
                  "",
                ].map((h, i) => (
                  <th
                    key={`${h}_${i}`}
                    className="px-3 py-2 text-left text-xs font-semibold uppercase text-stone-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-sm text-stone-400">
                    {cargado ? "Sin facturas en este registro" : "Cargando..."}
                  </td>
                </tr>
              ) : (
                filtradas.map((v) => {
                  const ab = abiertas.has(v.id)
                  return (
                    <React.Fragment key={v.id}>
                      <tr
                        onClick={() => alternar(v.id)}
                        className={`cursor-pointer border-b border-stone-100 hover:bg-stone-50 ${
                          ab ? "bg-[#344966]/5" : ""
                        }`}
                      >
                        <td className="px-3 py-2 text-stone-400">
                          {ab ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </td>
                        <td className="px-3 py-2 font-semibold text-stone-800">
                          {v.numero_documento}
                          {v.mixta && (
                            <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                              mixta
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-stone-600">{v.fecha}</td>
                        <td className="px-3 py-2 text-stone-700">
                          {v.cliente_nombre}
                          {v.ciudad && (
                            <span className="block text-[11px] text-stone-400">{v.ciudad}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-stone-600">{v.detalle.length}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-stone-700">
                          {miles(v.total_unidades)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-stone-900">
                          {pesos(v.total_valor)}
                          {empresa && v.mixta && (
                            <span className="block text-[10px] font-normal text-stone-400">
                              de {pesos(v.total_valor_documento)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Badge className={ESTADO_VENTA_COLOR[v.estado]}>
                            {ESTADO_VENTA_LABEL[v.estado]}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            {onImprimir && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onImprimir(v.id)
                                }}
                                title={`Reimprimir la factura ${v.numero_documento}`}
                                className="rounded-lg border border-stone-200 p-1.5 text-stone-500 hover:bg-stone-50 hover:text-stone-700"
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {onEditar && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onEditar(v.id)
                                }}
                                title={`Editar la factura ${v.numero_documento}`}
                                className="rounded-lg border border-stone-200 p-1.5 text-stone-500 hover:bg-stone-50 hover:text-stone-700"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {onAnular && v.estado !== "anulada" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onAnular(v.id)
                                }}
                                title={`Anular la factura ${v.numero_documento} — conserva el documento y devuelve el inventario`}
                                className="rounded-lg border border-stone-200 p-1.5 text-stone-500 hover:bg-amber-50 hover:text-amber-700"
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {onEliminar && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onEliminar(v.id)
                                }}
                                title={`Eliminar la factura ${v.numero_documento} — borra el documento y libera el consecutivo`}
                                className="rounded-lg border border-stone-200 p-1.5 text-stone-500 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {ab && (
                        <tr className="border-b border-stone-100 bg-stone-50/60">
                          <td colSpan={9} className="px-3 py-3">
                            <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                              <table className="w-full text-xs">
                                <thead className="bg-stone-50">
                                  <tr>
                                    {[
                                      "Referencia",
                                      "Descripcion",
                                      "Empresa",
                                      "Talla",
                                      "Cant.",
                                      "Vr. unidad",
                                      "Total",
                                    ].map((h) => (
                                      <th
                                        key={h}
                                        className="px-3 py-1.5 text-left font-semibold uppercase text-stone-500"
                                      >
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {v.detalle.map((d) => (
                                    <tr key={d.id} className="border-t border-stone-100">
                                      <td className="px-3 py-1.5 font-semibold text-stone-800">
                                        {d.referencia}
                                      </td>
                                      <td className="px-3 py-1.5 text-stone-500">
                                        {d.descripcion ?? "—"}
                                      </td>
                                      <td className="px-3 py-1.5">
                                        <Badge
                                          className={
                                            EMPRESA_COLOR[
                                              (d.empresa ?? "ACOA") as EmpresaProducto
                                            ]
                                          }
                                        >
                                          {d.empresa ?? "ACOA"}
                                        </Badge>
                                      </td>
                                      <td className="px-3 py-1.5 text-stone-700">
                                        {d.talla ?? "—"}
                                      </td>
                                      <td className="px-3 py-1.5 text-right tabular-nums">
                                        {miles(d.cantidad)}
                                      </td>
                                      <td className="px-3 py-1.5 text-right tabular-nums text-stone-600">
                                        {pesos(Number(d.valor_unidad))}
                                      </td>
                                      <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-stone-800">
                                        {pesos(Number(d.valor_total))}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        </TablaInteractiva>
      </Card>
    </div>
  )
}
