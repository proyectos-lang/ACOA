"use client"

import * as React from "react"
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Save,
  Printer,
  Ban,
  FileText,
  Receipt,
  History,
  X,
  PackageMinus,
  ChevronRight,
  ChevronDown,
  Users,
  Layers,
} from "lucide-react"
import type { ClienteRow, ReferenciaVentaRow } from "@/lib/db/venta"
import type { SaldoInventario } from "@/lib/db/inventario-producto"
import type {
  OrdenSalidaConDetalle,
  FaltanteSalida,
  HistorialOSConOrden,
} from "@/lib/db/orden-salida"
import {
  ESTADO_OS_LABEL,
  ESTADO_OS_COLOR,
  MOTIVOS_ORDEN_SALIDA,
} from "@/lib/db/orden-salida"
import {
  guardarOrdenSalidaAction,
  confirmarOrdenSalidaAction,
  anularOrdenSalidaAction,
  eliminarOrdenSalidaAction,
  verificarDisponibleSalidaAction,
  prepararVentaDesdeOrdenesAction,
  cargarHistorialOrdenesAction,
} from "@/app/(dashboard)/inventario/orden-salida-actions"
import { ReferenciaCombobox } from "@/components/ui/referencia-combobox"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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

function hoyBogota() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
}
function miles(n: number) {
  return n.toLocaleString("es-CO")
}

const inputCls =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
const filtroCls =
  "rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"

interface LineaEdit {
  key: string
  referencia: string
  descripcion: string
  talla: string
  cantidad: number
}

function nuevaLinea(): LineaEdit {
  return {
    key: Math.random().toString(36).slice(2),
    referencia: "",
    descripcion: "",
    talla: "",
    cantidad: 0,
  }
}

export function OrdenSalidaClient({
  ordenes,
  clientes,
  referencias,
  saldos,
  esAdmin,
}: {
  ordenes: OrdenSalidaConDetalle[]
  clientes: ClienteRow[]
  referencias: ReferenciaVentaRow[]
  saldos: SaldoInventario[]
  esAdmin: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)
  const [vista, setVista] = React.useState<
    "nueva" | "ordenes" | "agrupar" | "historial"
  >("ordenes")

  // Formulario
  const [ordenId, setOrdenId] = React.useState<number | null>(null)
  const [fecha, setFecha] = React.useState(hoyBogota())
  const [clienteId, setClienteId] = React.useState<number | null>(null)
  const [clienteNombre, setClienteNombre] = React.useState("")
  const [ciudad, setCiudad] = React.useState("")
  const [motivo, setMotivo] = React.useState<string>(MOTIVOS_ORDEN_SALIDA[0])
  const [observacion, setObservacion] = React.useState("")
  const [lineas, setLineas] = React.useState<LineaEdit[]>([nuevaLinea()])
  const [faltantes, setFaltantes] = React.useState<FaltanteSalida[]>([])

  // Filtros del listado
  const [fDesde, setFDesde] = React.useState("")
  const [fHasta, setFHasta] = React.useState("")
  const [fTexto, setFTexto] = React.useState("")
  const [fEstado, setFEstado] = React.useState("")

  // Agrupacion por cliente: que ordenes se van a facturar juntas
  const [seleccion, setSeleccion] = React.useState<Set<number>>(new Set())
  const [gDesde, setGDesde] = React.useState("")
  const [gHasta, setGHasta] = React.useState("")

  function alternarSeleccion(id: number) {
    setSeleccion((prev) => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })
  }

  // Historial
  const [historial, setHistorial] = React.useState<HistorialOSConOrden[]>([])
  const [hCargado, setHCargado] = React.useState(false)
  const [hTexto, setHTexto] = React.useState("")
  // Ordenes cuyo detalle esta desplegado
  const [abiertas, setAbiertas] = React.useState<Set<number>>(new Set())

  function alternarOrden(id: number) {
    setAbiertas((prev) => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })
  }

  const aviso = (tipo: "ok" | "error", msg: string) => {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 6000)
  }

  // Disponible por referencia + talla
  const disponiblePor = React.useMemo(() => {
    const m = new Map<string, number>()
    for (const s of saldos) {
      const k = `${(s.referencia ?? "").trim().toUpperCase()}|${s.talla.trim().toUpperCase()}`
      m.set(k, (m.get(k) ?? 0) + s.disponible)
    }
    return m
  }, [saldos])

  const tallasDe = React.useCallback(
    (referencia: string) => {
      const ref = referencia.trim().toUpperCase()
      const t = saldos
        .filter((s) => (s.referencia ?? "").trim().toUpperCase() === ref && s.disponible > 0)
        .map((s) => s.talla.trim())
      return [...new Set(t)].sort((a, b) => a.localeCompare(b, "es", { numeric: true }))
    },
    [saldos]
  )

  const disponibleDe = (referencia: string, talla: string) =>
    disponiblePor.get(
      `${referencia.trim().toUpperCase()}|${talla.trim().toUpperCase()}`
    ) ?? 0

  const opcionesReferencia = React.useMemo(() => {
    const conSaldo = new Map<string, number>()
    for (const s of saldos) {
      const r = (s.referencia ?? "").trim().toUpperCase()
      if (!r) continue
      conSaldo.set(r, (conSaldo.get(r) ?? 0) + s.disponible)
    }
    return [...conSaldo.entries()]
      .filter(([, d]) => d > 0)
      .map(([referencia, disponible]) => ({
        referencia,
        descripcion:
          referencias.find((x) => x.referencia.trim().toUpperCase() === referencia)
            ?.descripcion ?? null,
        disponible,
      }))
      .sort((a, b) => a.referencia.localeCompare(b.referencia, "es", { numeric: true }))
  }, [saldos, referencias])

  const totalUnidades = lineas.reduce((s, l) => s + (l.cantidad || 0), 0)

  function setLinea(key: string, campos: Partial<LineaEdit>) {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...campos } : l)))
    setFaltantes([])
  }

  function aplicarReferencia(key: string, referencia: string) {
    const r = referencias.find(
      (x) => x.referencia.trim().toUpperCase() === referencia.trim().toUpperCase()
    )
    setLinea(key, { referencia, descripcion: r?.descripcion ?? "", talla: "" })
  }

  function limpiar() {
    setOrdenId(null)
    setFecha(hoyBogota())
    setClienteId(null)
    setClienteNombre("")
    setCiudad("")
    setMotivo(MOTIVOS_ORDEN_SALIDA[0])
    setObservacion("")
    setLineas([nuevaLinea()])
    setFaltantes([])
  }

  function cargar(o: OrdenSalidaConDetalle) {
    setOrdenId(o.id)
    setFecha(o.fecha)
    setClienteId(o.cliente_id)
    setClienteNombre(o.cliente_nombre)
    setCiudad(o.ciudad ?? "")
    setMotivo(o.motivo)
    setObservacion(o.observacion ?? "")
    setLineas(
      o.detalle.map((d) => ({
        key: Math.random().toString(36).slice(2),
        referencia: d.referencia,
        descripcion: d.descripcion ?? "",
        talla: d.talla,
        cantidad: d.cantidad,
      }))
    )
    setFaltantes([])
    setVista("nueva")
  }

  function payload() {
    return {
      id: ordenId,
      fecha,
      cliente_id: clienteId,
      cliente_nombre: clienteNombre,
      ciudad,
      motivo,
      observacion,
      lineas: lineas
        .filter((l) => l.referencia.trim() && l.talla.trim() && l.cantidad > 0)
        .map(({ key: _k, ...l }) => l),
    }
  }

  function guardar() {
    const p = payload()
    if (p.lineas.length === 0) {
      aviso("error", "Agrega al menos una referencia con talla y cantidad")
      return
    }
    startTransition(async () => {
      const r = await guardarOrdenSalidaAction(p)
      if (r.error) return aviso("error", r.error)
      if (r.ordenId) setOrdenId(r.ordenId)
      setHCargado(false)
      aviso("ok", "Orden guardada como borrador")
      router.refresh()
    })
  }

  function confirmar() {
    const p = payload()
    if (p.lineas.length === 0) {
      aviso("error", "Agrega al menos una referencia con talla y cantidad")
      return
    }
    startTransition(async () => {
      const chequeo = await verificarDisponibleSalidaAction(
        p.lineas.map((l) => ({ referencia: l.referencia, talla: l.talla, cantidad: l.cantidad }))
      )
      if (chequeo.error) return aviso("error", chequeo.error)
      if (chequeo.faltantes && chequeo.faltantes.length > 0) {
        setFaltantes(chequeo.faltantes)
        return aviso("error", "No hay inventario suficiente para esta salida")
      }

      const g = await guardarOrdenSalidaAction(p)
      if (g.error || !g.ordenId) return aviso("error", g.error ?? "Error guardando")

      const c = await confirmarOrdenSalidaAction(g.ordenId)
      if (c.error) {
        router.refresh()
        return aviso("error", c.error)
      }
      aviso("ok", "Orden confirmada: el inventario ya se descontó")
      limpiar()
      setHCargado(false)
      router.refresh()
      setVista("ordenes")
    })
  }

  function anular(id: number) {
    startTransition(async () => {
      const r = await anularOrdenSalidaAction(id)
      if (r.error) aviso("error", r.error)
      else {
        aviso("ok", "Orden anulada: el inventario volvió")
        setHCargado(false)
        router.refresh()
      }
    })
  }

  function eliminar(id: number) {
    startTransition(async () => {
      const r = await eliminarOrdenSalidaAction(id)
      if (r.error) aviso("error", r.error)
      else {
        aviso("ok", "Orden eliminada")
        router.refresh()
      }
    })
  }

  // Lleva al formulario de registrar venta con los datos cargados. No
  // crea la venta: eso lo hace el usuario desde el modulo de ventas.
  function irARegistrarVenta(ids: number[]) {
    startTransition(async () => {
      const r = await prepararVentaDesdeOrdenesAction(ids)
      if (r.error) return aviso("error", r.error)
      if (!r.precarga) return aviso("error", "No se pudo preparar la venta")

      try {
        sessionStorage.setItem("vanessa_precarga_venta", JSON.stringify(r.precarga))
      } catch {
        return aviso("error", "El navegador no permitió pasar los datos a ventas")
      }
      router.push("/ventas")
    })
  }

  const cargarHistorial = React.useCallback(() => {
    startTransition(async () => {
      const r = await cargarHistorialOrdenesAction()
      if (r.error) return aviso("error", r.error)
      setHistorial(r.historialGlobal ?? [])
      setHCargado(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    if (vista === "historial" && !hCargado) cargarHistorial()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, hCargado])

  // El historial se agrupa por orden: se listan las cabeceras y el detalle
  // de cada una se despliega al abrirla.
  const historialPorOrden = React.useMemo(() => {
    const map = new Map<
      number,
      {
        orden_salida_id: number
        numero: string
        cliente_nombre: string
        fecha_orden: string
        cabecera: HistorialOSConOrden[]
        detalle: HistorialOSConOrden[]
        ultimo: string
      }
    >()
    for (const h of historial) {
      let g = map.get(h.orden_salida_id)
      if (!g) {
        g = {
          orden_salida_id: h.orden_salida_id,
          numero: h.numero,
          cliente_nombre: h.cliente_nombre,
          fecha_orden: h.fecha_orden,
          cabecera: [],
          detalle: [],
          ultimo: h.creado_en,
        }
        map.set(h.orden_salida_id, g)
      }
      if (h.nivel === "cabecera") g.cabecera.push(h)
      else g.detalle.push(h)
      if (h.creado_en > g.ultimo) g.ultimo = h.creado_en
    }
    // La orden con el movimiento mas reciente va primero
    return [...map.values()].sort((a, b) => b.ultimo.localeCompare(a.ultimo))
  }, [historial])

  const historialFiltrado = React.useMemo(() => {
    if (!hTexto.trim()) return historialPorOrden
    const t = hTexto.trim().toLowerCase()
    return historialPorOrden.filter(
      (g) =>
        g.numero.toLowerCase().includes(t) || g.cliente_nombre.toLowerCase().includes(t)
    )
  }, [historialPorOrden, hTexto])

  // ── Listado filtrado ──
  const filtradas = React.useMemo(() => {
    return ordenes.filter((o) => {
      if (fDesde && o.fecha < fDesde) return false
      if (fHasta && o.fecha > fHasta) return false
      if (fEstado && o.estado !== fEstado) return false
      if (fTexto) {
        const t = fTexto.toLowerCase()
        if (
          !o.numero.toLowerCase().includes(t) &&
          !o.cliente_nombre.toLowerCase().includes(t) &&
          !(o.ciudad ?? "").toLowerCase().includes(t)
        )
          return false
      }
      return true
    })
  }, [ordenes, fDesde, fHasta, fEstado, fTexto])

  // ── Agrupacion por cliente ──
  // Solo se pueden agrupar las ordenes confirmadas que aun no se facturaron
  const agrupables = React.useMemo(
    () =>
      ordenes.filter((o) => {
        if (o.estado !== "confirmada" || o.venta_id) return false
        if (gDesde && o.fecha < gDesde) return false
        if (gHasta && o.fecha > gHasta) return false
        return true
      }),
    [ordenes, gDesde, gHasta]
  )

  // Un grupo por cliente y fecha: es la unidad que se factura junta
  const gruposCliente = React.useMemo(() => {
    const map = new Map<
      string,
      {
        clave: string
        cliente: string
        ciudad: string | null
        fecha: string
        ordenes: OrdenSalidaConDetalle[]
        unidades: number
      }
    >()
    for (const o of agrupables) {
      const cliente = o.cliente_nombre.trim().toUpperCase()
      const clave = `${cliente}|${o.fecha}`
      let g = map.get(clave)
      if (!g) {
        g = { clave, cliente: o.cliente_nombre, ciudad: o.ciudad, fecha: o.fecha, ordenes: [], unidades: 0 }
        map.set(clave, g)
      }
      g.ordenes.push(o)
      g.unidades += o.total_unidades
    }
    return [...map.values()].sort(
      (a, b) => b.fecha.localeCompare(a.fecha) || a.cliente.localeCompare(b.cliente, "es")
    )
  }, [agrupables])

  // Lo seleccionado tiene que ser de un solo cliente para poder facturarse
  const seleccionadas = React.useMemo(
    () => agrupables.filter((o) => seleccion.has(o.id)),
    [agrupables, seleccion]
  )
  const clientesSeleccionados = [
    ...new Set(seleccionadas.map((o) => o.cliente_nombre.trim().toUpperCase())),
  ]
  const unidadesSeleccionadas = seleccionadas.reduce((s, o) => s + o.total_unidades, 0)

  // Cuantas lineas quedarian tras consolidar referencia + talla
  const lineasConsolidadas = React.useMemo(() => {
    const k = new Set<string>()
    for (const o of seleccionadas) {
      for (const d of o.detalle) {
        k.add(`${d.referencia.trim().toUpperCase()}|${d.talla.trim().toUpperCase()}`)
      }
    }
    return k.size
  }, [seleccionadas])
  const lineasOriginales = seleccionadas.reduce((s, o) => s + o.detalle.length, 0)

  function seleccionarGrupo(g: { ordenes: OrdenSalidaConDetalle[] }) {
    const ids = g.ordenes.map((o) => o.id)
    const todas = ids.every((id) => seleccion.has(id))
    setSeleccion((prev) => {
      const s = new Set(prev)
      // Al elegir un grupo se limpia lo de otros clientes: un documento
      // es de un solo cliente
      if (!todas) {
        s.clear()
        for (const id of ids) s.add(id)
      } else {
        for (const id of ids) s.delete(id)
      }
      return s
    })
  }

  function generarVentaAgrupada() {
    if (seleccionadas.length === 0) {
      aviso("error", "Selecciona las órdenes que vas a facturar")
      return
    }
    if (clientesSeleccionados.length > 1) {
      aviso("error", "Las órdenes seleccionadas son de clientes distintos")
      return
    }
    irARegistrarVenta(seleccionadas.map((o) => o.id))
  }

  // ── Imprimible de la orden ──
  function imprimir(o: OrdenSalidaConDetalle) {
    const filas = o.detalle
      .map(
        (d) =>
          `<tr><td>${d.referencia}</td><td>${d.descripcion ?? ""}</td><td class="c">${d.talla}</td><td class="r">${miles(d.cantidad)}</td></tr>`
      )
      .join("")
    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(`<html><head><title>${o.numero}</title><style>
      @page { size: letter; margin: 14mm }
      body { font-family: Arial, sans-serif; font-size: 11px; color: #1c1917 }
      .cab { display: flex; justify-content: space-between; align-items: flex-start;
             border-bottom: 2px solid #344966; padding-bottom: 8px; margin-bottom: 12px }
      h1 { font-size: 17px; margin: 0; color: #344966 }
      .num { font-size: 15px; font-weight: bold; text-align: right }
      .meta { margin-bottom: 12px }
      .meta div { margin-bottom: 2px }
      .et { display: inline-block; width: 92px; color: #78716c }
      table { width: 100%; border-collapse: collapse; margin-top: 6px }
      th { background: #344966; color: #fff; padding: 6px; text-align: left; font-size: 10px }
      td { border-bottom: 1px solid #e7e5e4; padding: 5px 6px }
      td.r { text-align: right } td.c { text-align: center }
      tfoot td { font-weight: bold; border-top: 2px solid #344966 }
      .firmas { margin-top: 42px; display: flex; gap: 40px }
      .firma { flex: 1; border-top: 1px solid #78716c; padding-top: 4px;
               text-align: center; font-size: 10px; color: #57534e }
      .pie { margin-top: 18px; font-size: 9px; color: #a8a29e }
    </style></head><body>
      <div class="cab">
        <div>
          <h1>ORDEN DE SALIDA DE INVENTARIO</h1>
          <div style="font-size:10px;color:#78716c">ACOA</div>
        </div>
        <div class="num">${o.numero}<div style="font-size:10px;font-weight:normal;color:#78716c">${ESTADO_OS_LABEL[o.estado]}</div></div>
      </div>
      <div class="meta">
        <div><span class="et">Fecha:</span> ${o.fecha}</div>
        <div><span class="et">Cliente:</span> <strong>${o.cliente_nombre}</strong></div>
        <div><span class="et">Ciudad:</span> ${o.ciudad ?? "-"}</div>
        <div><span class="et">Motivo:</span> ${o.motivo}</div>
        ${o.observacion ? `<div><span class="et">Observacion:</span> ${o.observacion}</div>` : ""}
      </div>
      <table>
        <thead><tr><th>Referencia</th><th>Descripcion</th><th style="text-align:center">Talla</th><th style="text-align:right">Cantidad</th></tr></thead>
        <tbody>${filas}</tbody>
        <tfoot><tr><td colspan="3">TOTAL</td><td class="r">${miles(o.total_unidades)}</td></tr></tfoot>
      </table>
      <div class="firmas">
        <div class="firma">Entrega (bodega)</div>
        <div class="firma">Transporta</div>
        <div class="firma">Recibe (cliente)</div>
      </div>
      <p class="pie">Documento generado el ${hoyBogota()}${o.venta_documento ? ` &middot; Facturado con el documento ${o.venta_documento}` : ""}</p>
      <script>window.addEventListener("load", function(){ window.print() })<\/script>
    </body></html>`)
    w.document.close()
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
            toast.tipo === "ok"
              ? "border border-green-200 bg-green-50 text-green-800"
              : "border border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {toast.tipo === "ok" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          {toast.msg}
        </div>
      )}

      {/* Pestanas */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { k: "nueva" as const, label: ordenId ? "Editando orden" : "Nueva orden", icon: PackageMinus },
            { k: "ordenes" as const, label: `Ordenes (${ordenes.length})`, icon: FileText },
            ...(esAdmin
              ? [{ k: "agrupar" as const, label: "Agrupar por cliente", icon: Users }]
              : []),
            ...(esAdmin
              ? [{ k: "historial" as const, label: "Historial", icon: History }]
              : []),
          ]
        ).map((t) => (
          <button
            key={t.k}
            onClick={() => setVista(t.k)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              vista === t.k
                ? "bg-[#344966] text-white"
                : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
            }`}
          >
            <t.icon className="mr-2 inline h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Nueva orden ── */}
      {vista === "nueva" && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-stone-700">
                {ordenId ? "Editando la orden" : "Nueva orden de salida"}
              </h2>
              {ordenId && (
                <button
                  onClick={limpiar}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-stone-500 hover:bg-stone-100"
                >
                  <X className="h-3 w-3" /> Cancelar edicion
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="text-[11px] font-medium text-stone-500">Fecha</label>
                <input
                  type="date"
                  className={inputCls}
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-stone-500">Cliente</label>
                <select
                  className={inputCls}
                  value={clienteId ?? ""}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : null
                    setClienteId(id)
                    const c = clientes.find((x) => x.id === id)
                    if (c) {
                      setClienteNombre(c.nombre)
                      setCiudad(c.ciudad ?? "")
                    }
                  }}
                >
                  <option value="">Selecciona el cliente</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                      {c.ciudad ? ` - ${c.ciudad}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-stone-500">Ciudad</label>
                <input
                  className={inputCls}
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                  placeholder="MEDELLIN"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-stone-500">Motivo</label>
                <select
                  className={inputCls}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                >
                  {MOTIVOS_ORDEN_SALIDA.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3">
              <label className="text-[11px] font-medium text-stone-500">Observacion</label>
              <input
                className={inputCls}
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                placeholder="Opcional: remision, transportadora, etc."
              />
            </div>
          </Card>

          {faltantes.length > 0 && (
            <Card className="border-red-200 bg-red-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-800">
                <AlertTriangle className="h-4 w-4" />
                No hay inventario suficiente
              </div>
              <ul className="space-y-1 text-sm text-red-700">
                {faltantes.map((f) => (
                  <li key={`${f.referencia}_${f.talla}`}>
                    <strong>{f.referencia}</strong> talla <strong>{f.talla}</strong>: pides{" "}
                    {miles(f.solicitado)}, disponible {miles(f.disponible)}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-stone-700">Producto a despachar</h2>
              <button
                onClick={() => setLineas((p) => [...p, nuevaLinea()])}
                className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
              >
                <Plus className="h-3 w-3" /> Agregar linea
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-stone-200">
                    {["Referencia", "Descripcion", "Talla", "Cantidad", "Disponible", ""].map(
                      (h, i) => (
                        <th
                          key={`${h}_${i}`}
                          className="px-2 py-2 text-left text-xs font-semibold uppercase text-stone-500"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l) => {
                    const disp = l.referencia && l.talla ? disponibleDe(l.referencia, l.talla) : 0
                    const excede = !!l.talla && l.cantidad > disp
                    return (
                      <tr key={l.key} className="border-b border-stone-100 last:border-0">
                        <td className="px-2 py-2">
                          <ReferenciaCombobox
                            opciones={opcionesReferencia}
                            value={l.referencia}
                            onChange={(ref) => aplicarReferencia(l.key, ref)}
                            vacioLabel="Ref."
                            className="min-w-[170px]"
                          />
                        </td>
                        <td className="px-2 py-2 text-xs text-stone-500">{l.descripcion}</td>
                        <td className="px-2 py-2">
                          <select
                            className={inputCls}
                            value={l.talla}
                            onChange={(e) => setLinea(l.key, { talla: e.target.value })}
                            disabled={!l.referencia}
                          >
                            <option value="">Talla</option>
                            {tallasDe(l.referencia).map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min={0}
                            className={`${inputCls} text-right ${
                              excede ? "border-red-300 bg-red-50" : ""
                            }`}
                            value={l.cantidad || ""}
                            onChange={(e) =>
                              setLinea(l.key, { cantidad: Number(e.target.value) || 0 })
                            }
                          />
                        </td>
                        <td className="px-2 py-2 text-right text-xs">
                          {l.referencia && l.talla ? (
                            <span className={excede ? "font-semibold text-red-600" : "text-stone-500"}>
                              {miles(disp)}
                            </span>
                          ) : (
                            <span className="text-stone-300">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {lineas.length > 1 && (
                            <button
                              onClick={() => setLineas((p) => p.filter((x) => x.key !== l.key))}
                              className="rounded-lg p-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-stone-300">
                    <td colSpan={3} className="px-2 py-2 text-sm font-semibold text-stone-700">
                      Total a despachar
                    </td>
                    <td className="px-2 py-2 text-right text-sm font-bold text-stone-900">
                      {miles(totalUnidades)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={guardar}
                disabled={isPending}
                className="flex items-center gap-2 rounded-xl bg-[#344966] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a3b52] disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> Guardar borrador
              </button>
              <button
                onClick={confirmar}
                disabled={isPending}
                className="flex items-center gap-2 rounded-xl bg-[#15803d] px-4 py-2 text-sm font-medium text-white hover:bg-[#166534] disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" /> Confirmar y descontar inventario
              </button>
            </div>
            <p className="mt-2 text-xs text-stone-400">
              El borrador no toca el inventario. Al confirmar, cada linea genera una salida por
              referencia y talla.
            </p>
          </Card>
        </div>
      )}

      {/* ── Listado de ordenes ── */}
      {vista === "ordenes" && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[11px] font-medium text-stone-500">Desde</label>
                <input
                  type="date"
                  className={filtroCls}
                  value={fDesde}
                  onChange={(e) => setFDesde(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-stone-500">Hasta</label>
                <input
                  type="date"
                  className={filtroCls}
                  value={fHasta}
                  onChange={(e) => setFHasta(e.target.value)}
                />
              </div>
              <div className="min-w-[200px] flex-1">
                <label className="block text-[11px] font-medium text-stone-500">
                  Numero, cliente o ciudad
                </label>
                <input
                  className={`${filtroCls} w-full`}
                  value={fTexto}
                  onChange={(e) => setFTexto(e.target.value)}
                  placeholder="Buscar..."
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-stone-500">Estado</label>
                <select
                  className={filtroCls}
                  value={fEstado}
                  onChange={(e) => setFEstado(e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="borrador">Borrador</option>
                  <option value="confirmada">Confirmada</option>
                  <option value="anulada">Anulada</option>
                </select>
              </div>
              <span className="ml-auto text-xs text-stone-400">
                {filtradas.length} de {ordenes.length}
              </span>
            </div>
          </Card>

          {filtradas.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText className="mx-auto mb-3 h-10 w-10 text-stone-300" />
              <p className="text-sm text-stone-400">No hay ordenes de salida con esos filtros.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtradas.map((o) => (
                <Card key={o.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-[220px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-semibold text-stone-800">{o.numero}</span>
                        <Badge className={ESTADO_OS_COLOR[o.estado]}>
                          {ESTADO_OS_LABEL[o.estado]}
                        </Badge>
                        {o.venta_documento && (
                          <Badge className="bg-sky-100 text-sky-800">
                            Facturada: {o.venta_documento}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-stone-700">{o.cliente_nombre}</p>
                      <p className="text-xs text-stone-400">
                        {o.fecha}
                        {o.ciudad ? ` · ${o.ciudad}` : ""} · {o.motivo}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-bold text-stone-900">
                        {miles(o.total_unidades)}
                      </p>
                      <p className="text-xs text-stone-400">
                        unidades · {o.detalle.length} linea(s)
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => imprimir(o)}
                        className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50"
                      >
                        <Printer className="h-3 w-3" /> PDF
                      </button>

                      {o.estado === "borrador" && (
                        <button
                          onClick={() => cargar(o)}
                          className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50"
                        >
                          Editar
                        </button>
                      )}

                      {o.estado === "confirmada" && !o.venta_id && (
                        <button
                          onClick={() => irARegistrarVenta([o.id])}
                          disabled={isPending}
                          className="flex items-center gap-1 rounded-lg bg-[#15803d] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#166534] disabled:opacity-50"
                        >
                          <Receipt className="h-3 w-3" /> Facturar
                        </button>
                      )}

                      {o.estado === "confirmada" && !o.venta_id && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="flex items-center gap-1 rounded-lg border border-amber-200 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50">
                              <Ban className="h-3 w-3" /> Anular
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Anular la orden {o.numero}</AlertDialogTitle>
                              <AlertDialogDescription>
                                Se devuelven {miles(o.total_unidades)} unidades al inventario y la
                                orden queda anulada.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => anular(o.id)}>
                                Anular
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}

                      {esAdmin && !o.venta_id && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminar la orden {o.numero}</AlertDialogTitle>
                              <AlertDialogDescription>
                                Se devuelve el inventario que haya descontado y la orden se borra.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => eliminar(o.id)}>
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>

                  {/* Detalle de la orden */}
                  <div className="mt-3 overflow-x-auto rounded-lg border border-stone-100">
                    <table className="w-full text-xs">
                      <thead className="bg-stone-50">
                        <tr>
                          {["Referencia", "Descripcion", "Talla", "Cantidad"].map((h) => (
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
                        {o.detalle.map((d) => (
                          <tr key={d.id} className="border-t border-stone-100">
                            <td className="px-3 py-1.5 font-semibold text-stone-800">
                              {d.referencia}
                            </td>
                            <td className="px-3 py-1.5 text-stone-500">{d.descripcion ?? "—"}</td>
                            <td className="px-3 py-1.5 text-stone-700">{d.talla}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-stone-800">
                              {miles(d.cantidad)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Agrupar por cliente ── */}
      {vista === "agrupar" && esAdmin && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[11px] font-medium text-stone-500">Desde</label>
                <input
                  type="date"
                  className={filtroCls}
                  value={gDesde}
                  onChange={(e) => {
                    setGDesde(e.target.value)
                    setSeleccion(new Set())
                  }}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-stone-500">Hasta</label>
                <input
                  type="date"
                  className={filtroCls}
                  value={gHasta}
                  onChange={(e) => {
                    setGHasta(e.target.value)
                    setSeleccion(new Set())
                  }}
                />
              </div>
              {(gDesde || gHasta) && (
                <button
                  onClick={() => {
                    setGDesde("")
                    setGHasta("")
                    setSeleccion(new Set())
                  }}
                  className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-500 hover:bg-stone-50"
                >
                  Limpiar fechas
                </button>
              )}
              <p className="ml-auto text-xs text-stone-400">
                Solo se listan las órdenes confirmadas que aún no se han facturado
              </p>
            </div>
          </Card>

          {/* Resumen de lo seleccionado */}
          {seleccionadas.length > 0 && (
            <Card
              className={`p-4 ${
                clientesSeleccionados.length > 1
                  ? "border-red-200 bg-red-50"
                  : "border-[#344966]/30 bg-[#344966]/5"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  {clientesSeleccionados.length > 1 ? (
                    <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
                      <AlertTriangle className="h-4 w-4" />
                      Hay órdenes de {clientesSeleccionados.length} clientes distintos: una venta
                      es de un solo cliente
                    </p>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-stone-800">
                        {seleccionadas.length} orden(es) de {clientesSeleccionados[0]}
                      </p>
                      <p className="text-xs text-stone-500">
                        {miles(unidadesSeleccionadas)} unidades ·{" "}
                        {lineasOriginales === lineasConsolidadas ? (
                          <>{lineasConsolidadas} línea(s)</>
                        ) : (
                          <>
                            {lineasOriginales} líneas se consolidan en{" "}
                            <strong>{lineasConsolidadas}</strong> (misma referencia y talla)
                          </>
                        )}
                      </p>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSeleccion(new Set())}
                    className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50"
                  >
                    Quitar selección
                  </button>
                  <button
                    onClick={generarVentaAgrupada}
                    disabled={isPending || clientesSeleccionados.length > 1}
                    className="flex items-center gap-2 rounded-xl bg-[#15803d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#166534] disabled:opacity-50"
                  >
                    <Receipt className="h-4 w-4" />
                    Facturar juntas
                  </button>
                </div>
              </div>
            </Card>
          )}

          {gruposCliente.length === 0 ? (
            <Card className="p-12 text-center">
              <Users className="mx-auto mb-3 h-10 w-10 text-stone-300" />
              <p className="text-sm text-stone-400">
                No hay órdenes confirmadas pendientes de facturar en ese rango.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {gruposCliente.map((g) => {
                const idsGrupo = g.ordenes.map((o) => o.id)
                const todas = idsGrupo.every((id) => seleccion.has(id))
                const algunas = idsGrupo.some((id) => seleccion.has(id))
                return (
                  <Card key={g.clave} className="p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <label className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={todas}
                          ref={(el) => {
                            if (el) el.indeterminate = algunas && !todas
                          }}
                          onChange={() => seleccionarGrupo(g)}
                          className="h-4 w-4 cursor-pointer accent-[#344966]"
                        />
                        <span>
                          <span className="font-semibold text-stone-800">{g.cliente}</span>
                          {g.ciudad && (
                            <span className="ml-1.5 text-xs text-stone-400">{g.ciudad}</span>
                          )}
                          <span className="block text-xs text-stone-500">
                            {g.fecha} · {g.ordenes.length} orden(es) · {miles(g.unidades)} unidades
                          </span>
                        </span>
                      </label>
                      <Badge className="bg-[#344966]/10 text-[#344966]">
                        <Layers className="mr-1 inline h-3 w-3" />
                        {g.ordenes.length === 1 ? "1 orden" : `${g.ordenes.length} órdenes`}
                      </Badge>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-stone-100">
                      <table className="w-full text-xs">
                        <thead className="bg-stone-50">
                          <tr>
                            <th className="w-10 px-3 py-1.5" />
                            {["Orden", "Motivo", "Lineas", "Unidades"].map((h) => (
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
                          {g.ordenes.map((o) => (
                            <tr
                              key={o.id}
                              className={`border-t border-stone-100 ${
                                seleccion.has(o.id) ? "bg-[#344966]/5" : ""
                              }`}
                            >
                              <td className="px-3 py-1.5">
                                <input
                                  type="checkbox"
                                  checked={seleccion.has(o.id)}
                                  onChange={() => alternarSeleccion(o.id)}
                                  className="h-4 w-4 cursor-pointer accent-[#344966]"
                                />
                              </td>
                              <td className="px-3 py-1.5 font-mono font-semibold text-stone-800">
                                {o.numero}
                              </td>
                              <td className="px-3 py-1.5 text-stone-500">{o.motivo}</td>
                              <td className="px-3 py-1.5 text-stone-600">
                                {o.detalle.length}
                              </td>
                              <td className="px-3 py-1.5 text-right tabular-nums text-stone-800">
                                {miles(o.total_unidades)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Historial (solo administrador) ── */}
      {vista === "historial" && esAdmin && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <label className="block text-[11px] font-medium text-stone-500">
                  Orden o cliente
                </label>
                <input
                  className={`${filtroCls} w-full`}
                  value={hTexto}
                  onChange={(e) => setHTexto(e.target.value)}
                  placeholder="Buscar..."
                />
              </div>
              <button
                onClick={() => cargarHistorial()}
                disabled={isPending}
                className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                Actualizar
              </button>
              <p className="text-xs text-stone-400">
                {historialFiltrado.length} orden(es) &middot; abre una para ver el detalle de sus
                movimientos
              </p>
            </div>
          </Card>

          <Card className="p-0">
            <div className="max-h-[620px] overflow-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="sticky top-0 bg-stone-50">
                  <tr className="border-b border-stone-200">
                    {["", "Orden", "Cliente", "Fecha", "Eventos", "Ultimo movimiento"].map(
                      (h, i) => (
                        <th
                          key={`${h}_${i}`}
                          className="px-3 py-2 text-left text-xs font-semibold uppercase text-stone-500"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {historialFiltrado.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-sm text-stone-400">
                        {hCargado ? "No hay ordenes registradas" : "Cargando..."}
                      </td>
                    </tr>
                  ) : (
                    historialFiltrado.map((g) => {
                      const abierta = abiertas.has(g.orden_salida_id)
                      const eventos = g.cabecera.length + g.detalle.length
                      return (
                        <React.Fragment key={g.orden_salida_id}>
                          <tr
                            onClick={() => alternarOrden(g.orden_salida_id)}
                            className={`cursor-pointer border-b border-stone-100 transition-colors hover:bg-stone-50 ${
                              abierta ? "bg-[#344966]/5" : ""
                            }`}
                          >
                            <td className="px-3 py-2 text-stone-400">
                              {abierta ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono font-semibold text-stone-800">
                              {g.numero}
                            </td>
                            <td className="px-3 py-2 text-stone-700">{g.cliente_nombre}</td>
                            <td className="px-3 py-2 font-mono text-xs text-stone-600">
                              {g.fecha_orden}
                            </td>
                            <td className="px-3 py-2 text-xs text-stone-500">
                              {eventos} evento{eventos === 1 ? "" : "s"}
                              {g.detalle.length > 0 && (
                                <span className="ml-1 text-stone-400">
                                  ({g.detalle.length} de producto)
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono text-[11px] text-stone-500">
                              {new Date(g.ultimo).toLocaleString("es-CO", {
                                timeZone: "America/Bogota",
                              })}
                            </td>
                          </tr>

                          {abierta && (
                            <tr className="border-b border-stone-100 bg-stone-50/60">
                              <td colSpan={6} className="px-3 py-3">
                                {/* Ciclo de la orden */}
                                {g.cabecera.length > 0 && (
                                  <div className="mb-3">
                                    <p className="mb-1 text-[11px] font-semibold uppercase text-stone-500">
                                      Ciclo de la orden
                                    </p>
                                    <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                                      <table className="w-full text-xs">
                                        <thead className="bg-stone-50">
                                          <tr>
                                            {["Fecha y hora", "Accion", "Descripcion", "Usuario"].map(
                                              (h) => (
                                                <th
                                                  key={h}
                                                  className="px-3 py-1.5 text-left font-semibold uppercase text-stone-500"
                                                >
                                                  {h}
                                                </th>
                                              )
                                            )}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {g.cabecera.map((h) => (
                                            <tr key={h.id} className="border-t border-stone-100">
                                              <td className="px-3 py-1.5 font-mono text-[11px] text-stone-500">
                                                {new Date(h.creado_en).toLocaleString("es-CO", {
                                                  timeZone: "America/Bogota",
                                                })}
                                              </td>
                                              <td className="px-3 py-1.5 font-medium text-stone-700">
                                                {h.accion}
                                              </td>
                                              <td className="px-3 py-1.5 text-stone-500">
                                                {h.descripcion ?? "—"}
                                                {h.total_unidades != null && (
                                                  <span className="ml-1 text-stone-400">
                                                    ({miles(h.total_unidades)} und)
                                                  </span>
                                                )}
                                              </td>
                                              <td className="px-3 py-1.5 text-stone-500">
                                                {h.usuario_nombre ?? "—"}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}

                                {/* Movimientos de producto */}
                                {g.detalle.length > 0 ? (
                                  <div>
                                    <p className="mb-1 text-[11px] font-semibold uppercase text-stone-500">
                                      Movimientos de producto
                                    </p>
                                    <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                                      <table className="w-full text-xs">
                                        <thead className="bg-stone-50">
                                          <tr>
                                            {[
                                              "Fecha y hora",
                                              "Accion",
                                              "Referencia",
                                              "Talla",
                                              "Cantidad",
                                              "Usuario",
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
                                          {g.detalle.map((h) => (
                                            <tr key={h.id} className="border-t border-stone-100">
                                              <td className="px-3 py-1.5 font-mono text-[11px] text-stone-500">
                                                {new Date(h.creado_en).toLocaleString("es-CO", {
                                                  timeZone: "America/Bogota",
                                                })}
                                              </td>
                                              <td className="px-3 py-1.5 text-stone-600">
                                                {h.accion}
                                              </td>
                                              <td className="px-3 py-1.5 font-semibold text-stone-800">
                                                {h.referencia ?? "—"}
                                              </td>
                                              <td className="px-3 py-1.5 text-stone-700">
                                                {h.talla ?? "—"}
                                              </td>
                                              <td className="px-3 py-1.5 text-right tabular-nums text-stone-800">
                                                {miles(h.cantidad ?? 0)}
                                              </td>
                                              <td className="px-3 py-1.5 text-stone-500">
                                                {h.usuario_nombre ?? "—"}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-stone-400">
                                    Esta orden no tiene movimientos de producto registrados.
                                  </p>
                                )}
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
          </Card>
        </div>
      )}
    </div>
  )
}
