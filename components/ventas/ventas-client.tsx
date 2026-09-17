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
  ShoppingCart,
  FileSpreadsheet,
  Printer,
  Ban,
  Users,
  Pencil,
  X,
  CreditCard,
  Banknote,
  History,
  Wallet,
  Building2,
  BarChart3,
} from "lucide-react"
import type {
  VentaConDetalle,
  ClienteRow,
  ReferenciaVentaRow,
  LineaVentaInput,
  FaltanteInventario,
  EstadoVenta,
  FormaPago,
  RazonSocial,
  VentaAbonoRow,
  HistorialConVenta,
} from "@/lib/db/venta"
import {
  ESTADO_VENTA_LABEL,
  ESTADO_VENTA_COLOR,
  FORMA_PAGO_LABEL,
  FORMA_PAGO_COLOR,
  RAZONES_SOCIALES,
  RAZON_SOCIAL_COLOR,
} from "@/lib/db/venta"
import { ReferenciaCombobox } from "@/components/ui/referencia-combobox"
import { VentasDashboard } from "@/components/ventas/ventas-dashboard"
import type { DashboardVentas } from "@/lib/db/ventas-dashboard"
import type { SaldoInventario } from "@/lib/db/inventario-producto"
import {
  guardarVentaAction,
  confirmarVentaAction,
  anularVentaAction,
  eliminarVentaAction,
  verificarDisponibleAction,
  crearClienteAction,
  siguienteDocumentoAction,
  registrarAbonoAction,
  eliminarAbonoAction,
  cargarAbonosAction,
  cargarHistorialGlobalAction,
} from "@/app/(dashboard)/ventas/actions"
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

function pesos(n: number) {
  return "$" + Math.round(n).toLocaleString("es-CO")
}

const inputCls =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
const filtroCls =
  "rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"

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

// Una linea de la venta en edicion
interface LineaEdit extends LineaVentaInput {
  key: string
}

function nuevaLinea(): LineaEdit {
  return {
    key: Math.random().toString(36).slice(2),
    referencia: "",
    descripcion: "",
    linea: "",
    categoria: "",
    talla: "",
    cantidad: 0,
    valor_unidad: 0,
  }
}

export function VentasClient({
  ventas,
  clientes,
  referencias,
  saldos,
  dashboard,
}: {
  ventas: VentaConDetalle[]
  clientes: ClienteRow[]
  referencias: ReferenciaVentaRow[]
  saldos: SaldoInventario[]
  dashboard?: DashboardVentas
}) {
  const router = useRouter()
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [vista, setVista] = React.useState<
    "dashboard" | "registro" | "ventas" | "cartera" | "historial"
  >("dashboard")

  // ── Formulario de la venta ──
  const [ventaId, setVentaId] = React.useState<number | null>(null)
  const [documento, setDocumento] = React.useState("")
  const [fecha, setFecha] = React.useState(hoyBogota())
  const [clienteId, setClienteId] = React.useState<number | null>(null)
  const [clienteNombre, setClienteNombre] = React.useState("")
  const [ciudad, setCiudad] = React.useState("")
  const [observacion, setObservacion] = React.useState("")
  const [lineas, setLineas] = React.useState<LineaEdit[]>([nuevaLinea()])
  const [faltantes, setFaltantes] = React.useState<FaltanteInventario[]>([])
  const [formaPago, setFormaPago] = React.useState<FormaPago>("contado")
  const [diasCredito, setDiasCredito] = React.useState(30)
  const [razonSocial, setRazonSocial] = React.useState<RazonSocial>("ACOA")

  // Cartera: abonos de la venta abierta
  const [abonoDe, setAbonoDe] = React.useState<VentaConDetalle | null>(null)
  const [abonos, setAbonos] = React.useState<VentaAbonoRow[]>([])
  const [abValor, setAbValor] = React.useState(0)
  const [abFecha, setAbFecha] = React.useState(hoyBogota())
  const [abMedio, setAbMedio] = React.useState("")
  const [abReferencia, setAbReferencia] = React.useState("")

  // Historial
  const [historial, setHistorial] = React.useState<HistorialConVenta[]>([])
  const [hNivel, setHNivel] = React.useState<"factura" | "detalle" | "">("")
  const [hRazon, setHRazon] = React.useState<RazonSocial | "">("")
  const [hCargado, setHCargado] = React.useState(false)

  // ── Filtros de la cartera ──
  const [fDesde, setFDesde] = React.useState("")
  const [fHasta, setFHasta] = React.useState("")
  const [fCliente, setFCliente] = React.useState("")
  const [fEstado, setFEstado] = React.useState("")
  const [fRazon, setFRazon] = React.useState<RazonSocial | "">("")

  // Nuevo cliente
  const [nuevoCliente, setNuevoCliente] = React.useState(false)
  const [ncNombre, setNcNombre] = React.useState("")
  const [ncCiudad, setNcCiudad] = React.useState("")
  const [ncNit, setNcNit] = React.useState("")
  const [ncTelefono, setNcTelefono] = React.useState("")

  const aviso = (tipo: "ok" | "error", msg: string) => {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 4000)
  }

  // Consecutivo al abrir el formulario en blanco
  React.useEffect(() => {
    if (ventaId == null && !documento) {
      siguienteDocumentoAction().then((r) => {
        if (r.documento) setDocumento(r.documento)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventaId])

  // Disponible por referencia + talla, para mostrarlo junto a cada linea
  const disponiblePor = React.useMemo(() => {
    const m = new Map<string, number>()
    for (const s of saldos) {
      const key = `${(s.referencia ?? "").trim().toUpperCase()}|${s.talla.trim().toUpperCase()}`
      m.set(key, (m.get(key) ?? 0) + s.disponible)
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

  const disponibleDe = (referencia: string, talla: string | null | undefined) => {
    const key = `${referencia.trim().toUpperCase()}|${(talla ?? "").trim().toUpperCase()}`
    return disponiblePor.get(key) ?? 0
  }

  const totalUnidades = lineas.reduce((s, l) => s + (l.cantidad || 0), 0)
  const totalValor = lineas.reduce((s, l) => s + (l.cantidad || 0) * (l.valor_unidad || 0), 0)

  // ── Edicion de lineas ──
  function setLinea(key: string, campos: Partial<LineaEdit>) {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...campos } : l)))
    setFaltantes([])
  }

  // Al elegir la referencia se traen descripcion, linea, categoria y precio
  function aplicarReferencia(key: string, referencia: string) {
    const r = referencias.find(
      (x) => x.referencia.trim().toUpperCase() === referencia.trim().toUpperCase()
    )
    setLinea(key, {
      referencia,
      descripcion: r?.descripcion ?? "",
      linea: r?.linea ?? "",
      categoria: r?.categoria ?? "",
      valor_unidad: r?.valor_unidad ?? 0,
      talla: "",
    })
  }

  function limpiarFormulario() {
    setVentaId(null)
    setDocumento("")
    setFecha(hoyBogota())
    setClienteId(null)
    setClienteNombre("")
    setCiudad("")
    setObservacion("")
    setLineas([nuevaLinea()])
    setFaltantes([])
    setFormaPago("contado")
    setDiasCredito(30)
    setRazonSocial("ACOA")
  }

  function cargarVenta(v: VentaConDetalle) {
    setVentaId(v.id)
    setDocumento(v.numero_documento)
    setFecha(v.fecha)
    setClienteId(v.cliente_id)
    setClienteNombre(v.cliente_nombre)
    setCiudad(v.ciudad ?? "")
    setObservacion(v.observacion ?? "")
    setFormaPago(v.forma_pago)
    setDiasCredito(v.dias_credito || 30)
    setRazonSocial(v.razon_social)
    setLineas(
      v.detalle.map((d) => ({
        key: Math.random().toString(36).slice(2),
        referencia: d.referencia,
        descripcion: d.descripcion ?? "",
        linea: d.linea ?? "",
        categoria: d.categoria ?? "",
        talla: d.talla ?? "",
        cantidad: d.cantidad,
        valor_unidad: Number(d.valor_unidad),
      }))
    )
    setFaltantes([])
    setVista("registro")
  }

  function payload() {
    return {
      id: ventaId,
      // Al crear, el numero lo asigna la base de datos (consecutivo)
      numero_documento: ventaId ? documento : null,
      fecha,
      cliente_id: clienteId,
      cliente_nombre: clienteNombre,
      ciudad,
      observacion,
      forma_pago: formaPago,
      dias_credito: formaPago === "credito" ? diasCredito : 0,
      razon_social: razonSocial,
      lineas: lineas
        .filter((l) => l.referencia.trim() && l.cantidad > 0)
        .map(({ key: _key, ...l }) => l),
    }
  }

  function guardar(despues?: (id: number) => void) {
    const p = payload()
    if (p.lineas.length === 0) {
      aviso("error", "Agrega al menos una referencia con cantidad")
      return
    }
    startTransition(async () => {
      const r = await guardarVentaAction(p)
      if (r.error) {
        aviso("error", r.error)
        return
      }
      if (r.ventaId) setVentaId(r.ventaId)
      // El numero definitivo lo asigna la base de datos al crear
      if (r.documento) setDocumento(r.documento)
      // El historial cacheado queda viejo tras guardar
      setHCargado(false)
      router.refresh()
      if (despues && r.ventaId) despues(r.ventaId)
      else aviso("ok", "Venta guardada como borrador")
    })
  }

  // Revisa el inventario y, si alcanza, confirma y descuenta
  function confirmar() {
    const p = payload()
    if (p.lineas.length === 0) {
      aviso("error", "Agrega al menos una referencia con cantidad")
      return
    }
    const sinTalla = p.lineas.filter((l) => !l.talla?.trim())
    if (sinTalla.length > 0) {
      aviso("error", "Indica la talla de cada linea para descontar del inventario")
      return
    }
    startTransition(async () => {
      const chequeo = await verificarDisponibleAction(
        p.lineas.map((l) => ({
          referencia: l.referencia,
          talla: l.talla ?? null,
          cantidad: l.cantidad,
        }))
      )
      if (chequeo.error) {
        aviso("error", chequeo.error)
        return
      }
      if (chequeo.faltantes && chequeo.faltantes.length > 0) {
        setFaltantes(chequeo.faltantes)
        aviso("error", "No hay inventario suficiente para confirmar la venta")
        return
      }
      const g = await guardarVentaAction(p)
      if (g.error || !g.ventaId) {
        aviso("error", g.error ?? "Error guardando la venta")
        return
      }
      const c = await confirmarVentaAction(g.ventaId)
      if (c.error) {
        aviso("error", c.error)
        router.refresh()
        return
      }
      const eraCredito = formaPago === "credito"
      aviso(
        "ok",
        eraCredito
          ? "Venta confirmada, descontada del inventario y enviada a cartera"
          : "Venta confirmada y descontada del inventario"
      )
      limpiarFormulario()
      router.refresh()
      // El credito queda en cartera; el contado se ve en la lista de ventas
      setVista(eraCredito ? "cartera" : "ventas")
      setHCargado(false)
    })
  }

  function anular(id: number) {
    startTransition(async () => {
      const r = await anularVentaAction(id)
      if (r.error) aviso("error", r.error)
      else {
        aviso("ok", "Venta anulada y devuelta al inventario")
        router.refresh()
      }
    })
  }

  function eliminar(id: number) {
    startTransition(async () => {
      const r = await eliminarVentaAction(id)
      if (r.error) aviso("error", r.error)
      else {
        aviso("ok", "Venta eliminada")
        router.refresh()
      }
    })
  }

  function crearCliente() {
    if (!ncNombre.trim()) {
      aviso("error", "Indica el nombre del cliente")
      return
    }
    startTransition(async () => {
      const r = await crearClienteAction({
        nombre: ncNombre,
        ciudad: ncCiudad,
        nit: ncNit,
        telefono: ncTelefono,
      })
      if (r.error) {
        aviso("error", r.error)
        return
      }
      setClienteNombre(ncNombre.trim().toUpperCase())
      setCiudad(ncCiudad.trim().toUpperCase())
      setNuevoCliente(false)
      setNcNombre("")
      setNcCiudad("")
      setNcNit("")
      setNcTelefono("")
      aviso("ok", "Cliente creado")
      router.refresh()
    })
  }

  // ── Abonos de cartera ──
  function abrirAbonos(v: VentaConDetalle) {
    setAbonoDe(v)
    setAbValor(0)
    setAbFecha(hoyBogota())
    setAbMedio("")
    setAbReferencia("")
    startTransition(async () => {
      const r = await cargarAbonosAction(v.id)
      setAbonos(r.abonos ?? [])
    })
  }

  function guardarAbono() {
    if (!abonoDe) return
    if (!(abValor > 0)) {
      aviso("error", "Indica el valor del abono")
      return
    }
    startTransition(async () => {
      const r = await registrarAbonoAction({
        venta_id: abonoDe.id,
        fecha: abFecha,
        valor: abValor,
        medio_pago: abMedio,
        referencia: abReferencia,
      })
      if (r.error) {
        aviso("error", r.error)
        return
      }
      aviso("ok", "Abono registrado")
      const recarga = await cargarAbonosAction(abonoDe.id)
      setAbonos(recarga.abonos ?? [])
      setAbValor(0)
      setAbMedio("")
      setAbReferencia("")
      router.refresh()
    })
  }

  function borrarAbono(abonoId: number) {
    startTransition(async () => {
      const r = await eliminarAbonoAction(abonoId)
      if (r.error) {
        aviso("error", r.error)
        return
      }
      aviso("ok", "Abono eliminado")
      if (abonoDe) {
        const recarga = await cargarAbonosAction(abonoDe.id)
        setAbonos(recarga.abonos ?? [])
      }
      router.refresh()
    })
  }

  // ── Historial ──
  const cargarHistorial = React.useCallback(
    (nivel: "factura" | "detalle" | "", razon: RazonSocial | "" = "") => {
      startTransition(async () => {
        const r = await cargarHistorialGlobalAction({
          nivel: nivel || null,
          razon_social: razon || null,
        })
        if (r.error) {
          aviso("error", r.error)
          return
        }
        setHistorial(r.historialGlobal ?? [])
        setHCargado(true)
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  React.useEffect(() => {
    if (vista === "historial" && !hCargado) cargarHistorial(hNivel, hRazon)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, hCargado])

  // ── Cartera filtrada ──
  const ventasFiltradas = React.useMemo(() => {
    return ventas.filter((v) => {
      if (fDesde && v.fecha < fDesde) return false
      if (fHasta && v.fecha > fHasta) return false
      if (fEstado && v.estado !== fEstado) return false
      if (fRazon && v.razon_social !== fRazon) return false
      if (fCliente) {
        const t = fCliente.toLowerCase()
        const enCliente = v.cliente_nombre.toLowerCase().includes(t)
        const enCiudad = (v.ciudad ?? "").toLowerCase().includes(t)
        const enDoc = v.numero_documento.toLowerCase().includes(t)
        if (!enCliente && !enCiudad && !enDoc) return false
      }
      return true
    })
  }, [ventas, fDesde, fHasta, fCliente, fEstado, fRazon])

  // Cartera: solo las ventas a credito confirmadas con saldo o abonos
  const ventasCredito = React.useMemo(
    () => ventas.filter((v) => v.forma_pago === "credito" && v.estado === "confirmada"),
    [ventas]
  )

  const carteraFiltrada = React.useMemo(() => {
    return ventasCredito.filter((v) => {
      if (fDesde && v.fecha < fDesde) return false
      if (fHasta && v.fecha > fHasta) return false
      if (fCliente) {
        const t = fCliente.toLowerCase()
        if (
          !v.cliente_nombre.toLowerCase().includes(t) &&
          !(v.ciudad ?? "").toLowerCase().includes(t) &&
          !v.numero_documento.toLowerCase().includes(t)
        )
          return false
      }
      return true
    })
  }, [ventasCredito, fDesde, fHasta, fCliente])

  const saldoDe = (v: VentaConDetalle) => Number(v.total_valor) - Number(v.total_abonado)
  const totalPorCobrar = carteraFiltrada.reduce((s, v) => s + saldoDe(v), 0)
  const totalAbonadoCartera = carteraFiltrada.reduce((s, v) => s + Number(v.total_abonado), 0)
  const hoy = hoyBogota()
  const vencidas = carteraFiltrada.filter(
    (v) => saldoDe(v) > 0 && v.fecha_vencimiento && v.fecha_vencimiento < hoy
  )

  const totalCartera = ventasFiltradas
    .filter((v) => v.estado !== "anulada")
    .reduce((s, v) => s + Number(v.total_valor), 0)
  const unidadesCartera = ventasFiltradas
    .filter((v) => v.estado !== "anulada")
    .reduce((s, v) => s + v.total_unidades, 0)

  // Filas planas, como el formato de CARTERA
  const filasPlanas = React.useMemo(() => {
    const filas: Array<{
      fecha: string
      documento: string
      cliente: string
      ciudad: string
      referencia: string
      descripcion: string
      linea: string
      categoria: string
      cantidad: number
      valor: number
      total: number
      estado: EstadoVenta
      forma_pago: FormaPago
      razon_social: RazonSocial
    }> = []
    for (const v of ventasFiltradas) {
      for (const d of v.detalle) {
        filas.push({
          fecha: v.fecha,
          documento: v.numero_documento,
          cliente: v.cliente_nombre,
          ciudad: v.ciudad ?? "",
          referencia: d.referencia,
          descripcion: d.descripcion ?? "",
          linea: d.linea ?? "",
          categoria: d.categoria ?? "",
          cantidad: d.cantidad,
          valor: Number(d.valor_unidad),
          total: Number(d.valor_total),
          estado: v.estado,
          forma_pago: v.forma_pago,
          razon_social: v.razon_social,
        })
      }
    }
    return filas
  }, [ventasFiltradas])

  function exportarExcel() {
    const encabezados = [
      "FECHA",
      "NUMERO DE DOCUMENTO",
      "CLIENTE",
      "CIUDAD",
      "REFERENCIA",
      "DESCRIPCION",
      "LINEA",
      "CATEGORIA",
      "CANTIDAD",
      "VALOR POR UNIDAD",
      "TOTAL",
      "RAZON SOCIAL",
      "FORMA DE PAGO",
      "ESTADO",
    ]
    const filas = filasPlanas
      .map(
        (f) =>
          `<tr><td>${f.fecha}</td><td>${f.documento}</td><td>${f.cliente}</td><td>${f.ciudad}</td><td>${f.referencia}</td><td>${f.descripcion}</td><td>${f.linea}</td><td>${f.categoria}</td><td>${f.cantidad}</td><td>${f.valor}</td><td>${f.total}</td><td>${f.razon_social}</td><td>${FORMA_PAGO_LABEL[f.forma_pago]}</td><td>${ESTADO_VENTA_LABEL[f.estado]}</td></tr>`
      )
      .join("")
    const html = `<table border="1"><thead><tr>${encabezados
      .map((h) => `<th>${h}</th>`)
      .join("")}</tr></thead><tbody>${filas}</tbody></table>`
    const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `cartera_${hoyBogota()}.xls`
    a.click()
    URL.revokeObjectURL(url)
  }

  function imprimir() {
    const filas = filasPlanas
      .map(
        (f) =>
          `<tr><td>${f.fecha}</td><td>${f.documento}</td><td>${f.razon_social}</td><td>${f.cliente}</td><td>${f.ciudad}</td><td>${f.referencia}</td><td>${f.descripcion}</td><td class="c">${f.cantidad}</td><td class="r">${pesos(f.valor)}</td><td class="r">${pesos(f.total)}</td></tr>`
      )
      .join("")
    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(`<html><head><title>Cartera</title><style>
      @page { size: letter; margin: 10mm }
      body { font-family: Arial, sans-serif; font-size: 9px; color: #1c1917 }
      h1 { font-size: 14px; margin: 0 0 2px }
      p.sub { margin: 0 0 8px; color: #78716c; font-size: 9px }
      table { width: 100%; border-collapse: collapse }
      th { background: #344966; color: #fff; padding: 4px; text-align: left; font-size: 8px }
      td { border-bottom: 1px solid #e7e5e4; padding: 3px 4px }
      td.r { text-align: right } td.c { text-align: center }
      tfoot td { font-weight: bold; border-top: 2px solid #344966 }
    </style></head><body>
      <h1>Cartera de ventas</h1>
      <p class="sub">${fRazon ? `Razon social: ${fRazon} &middot; ` : ""}${filasPlanas.length} lineas &middot; ${unidadesCartera.toLocaleString("es-CO")} unidades &middot; ${pesos(totalCartera)}</p>
      <table>
        <thead><tr><th>Fecha</th><th>Documento</th><th>Factura</th><th>Cliente</th><th>Ciudad</th><th>Ref.</th><th>Descripcion</th><th>Cant.</th><th>Vr. unidad</th><th>Total</th></tr></thead>
        <tbody>${filas}</tbody>
        <tfoot><tr><td colspan="7">TOTAL</td><td class="c">${unidadesCartera}</td><td></td><td class="r">${pesos(totalCartera)}</td></tr></tfoot>
      </table>
      <script>window.addEventListener("load", function(){ window.print() })<\/script>
    </body></html>`)
    w.document.close()
  }

  const referenciasOrdenadas = [...referencias].sort((a, b) =>
    a.referencia.localeCompare(b.referencia, "es", { numeric: true })
  )

  // Para el combobox: cada referencia con su descripcion y su disponible total
  const opcionesReferencia = React.useMemo(
    () =>
      referenciasOrdenadas.map((r) => {
        const disponible = saldos
          .filter(
            (s) =>
              (s.referencia ?? "").trim().toUpperCase() === r.referencia.trim().toUpperCase()
          )
          .reduce((acc, s) => acc + s.disponible, 0)
        return { referencia: r.referencia, descripcion: r.descripcion, disponible }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [referencias, saldos]
  )

  return (
    <div className="space-y-4">
      {toast && <Toast tipo={toast.tipo} msg={toast.msg} />}

      {/* Pestanas */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { k: "dashboard", label: "Dashboard", icon: BarChart3 },
            { k: "registro", label: "Registrar venta", icon: ShoppingCart },
            { k: "ventas", label: `Ventas (${ventas.length})`, icon: FileSpreadsheet },
            { k: "cartera", label: `Cartera (${ventasCredito.length})`, icon: Wallet },
            { k: "historial", label: "Historial", icon: History },
          ] as const
        ).map((t) => (
          <button
            key={t.k}
            onClick={() => setVista(t.k)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              vista === t.k
                ? "bg-[#344966] text-white"
                : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
            }`}
          >
            <t.icon className="mr-2 inline h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {vista === "dashboard" && dashboard && <VentasDashboard datos={dashboard} />}

      {vista === "registro" && (
        <div className="space-y-4">
          {/* Cabecera de la venta */}
          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-stone-700">
                {ventaId ? `Editando la venta ${documento}` : "Nueva venta"}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setNuevoCliente((v) => !v)}
                  className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                >
                  <Users className="h-3.5 w-3.5" />
                  Nuevo cliente
                </button>
                {ventaId && (
                  <button
                    onClick={limpiarFormulario}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-stone-500 hover:bg-stone-100"
                  >
                    <X className="h-3 w-3" /> Cancelar edicion
                  </button>
                )}
              </div>
            </div>

            {nuevoCliente && (
              <div className="mb-3 rounded-xl border border-stone-200 bg-stone-50 p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <input
                    className={inputCls}
                    value={ncNombre}
                    onChange={(e) => setNcNombre(e.target.value)}
                    placeholder="Nombre del cliente"
                  />
                  <input
                    className={inputCls}
                    value={ncCiudad}
                    onChange={(e) => setNcCiudad(e.target.value)}
                    placeholder="Ciudad / sucursal"
                  />
                  <input
                    className={inputCls}
                    value={ncNit}
                    onChange={(e) => setNcNit(e.target.value)}
                    placeholder="NIT"
                  />
                  <input
                    className={inputCls}
                    value={ncTelefono}
                    onChange={(e) => setNcTelefono(e.target.value)}
                    placeholder="Telefono"
                  />
                </div>
                <button
                  onClick={crearCliente}
                  disabled={isPending}
                  className="mt-3 rounded-xl bg-[#344966] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a3b52] disabled:opacity-50"
                >
                  Guardar cliente
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="text-[11px] font-medium text-stone-500">
                  Numero de documento
                </label>
                <div
                  className={`${inputCls} flex items-center justify-between bg-stone-50 text-stone-500`}
                >
                  <span className="font-semibold text-stone-700">{documento || "..."}</span>
                  <span className="text-[10px] uppercase text-stone-400">
                    {ventaId ? "asignado" : "automatico"}
                  </span>
                </div>
              </div>
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
                <label className="text-[11px] font-medium text-stone-500">
                  Razon social que factura
                </label>
                <div className="flex gap-2">
                  {RAZONES_SOCIALES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRazonSocial(r)}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                        razonSocial === r
                          ? r === "ACOA"
                            ? "border-[#344966] bg-[#344966]/10 text-[#344966]"
                            : "border-violet-300 bg-violet-50 text-violet-800"
                          : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                      }`}
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      {r}
                    </button>
                  ))}
                </div>
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
                <label className="text-[11px] font-medium text-stone-500">Ciudad / sucursal</label>
                <input
                  className={inputCls}
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                  placeholder="BELLO"
                />
              </div>
            </div>

            {/* Forma de pago: contado o credito */}
            <div className="mt-3 rounded-xl border border-stone-200 bg-stone-50 p-3">
              <p className="mb-2 text-[11px] font-medium uppercase text-stone-500">
                Forma de pago
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFormaPago("contado")}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                    formaPago === "contado"
                      ? "border-sky-300 bg-sky-50 text-sky-800"
                      : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  <Banknote className="h-4 w-4" />
                  Pago inmediato
                </button>
                <button
                  type="button"
                  onClick={() => setFormaPago("credito")}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                    formaPago === "credito"
                      ? "border-amber-300 bg-amber-50 text-amber-800"
                      : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                  A credito
                </button>

                {formaPago === "credito" && (
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-medium text-stone-500">Plazo (dias)</label>
                    <input
                      type="number"
                      min={0}
                      className="w-24 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
                      value={diasCredito || ""}
                      onChange={(e) => setDiasCredito(Number(e.target.value) || 0)}
                    />
                  </div>
                )}

                <div className="min-w-[200px] flex-1">
                  <input
                    className={inputCls}
                    value={observacion}
                    onChange={(e) => setObservacion(e.target.value)}
                    placeholder="Observacion (opcional)"
                  />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-stone-400">
                {formaPago === "credito"
                  ? "Al confirmar, la venta pasa a cartera con su saldo pendiente y fecha de vencimiento."
                  : "La venta se da por pagada al confirmarla; no pasa a cartera."}
              </p>
            </div>
          </Card>

          {/* Faltantes de inventario */}
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
                    {f.solicitado}, disponible {f.disponible}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Lineas */}
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-stone-700">Referencias vendidas</h2>
              <button
                onClick={() => setLineas((p) => [...p, nuevaLinea()])}
                className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
              >
                <Plus className="h-3 w-3" /> Agregar linea
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-stone-200">
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-stone-500">
                      Referencia
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-stone-500">
                      Descripcion
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-stone-500">
                      Linea
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-stone-500">
                      Categoria
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-stone-500">
                      Talla
                    </th>
                    <th className="px-2 py-2 text-right text-xs font-semibold uppercase text-stone-500">
                      Cantidad
                    </th>
                    <th className="px-2 py-2 text-right text-xs font-semibold uppercase text-stone-500">
                      Vr. unidad
                    </th>
                    <th className="px-2 py-2 text-right text-xs font-semibold uppercase text-stone-500">
                      Total
                    </th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l) => {
                    const disp = l.referencia ? disponibleDe(l.referencia, l.talla) : 0
                    const excede = l.talla && l.cantidad > disp
                    return (
                      <tr key={l.key} className="border-b border-stone-100 last:border-0">
                        <td className="px-2 py-2">
                          <ReferenciaCombobox
                            opciones={opcionesReferencia}
                            value={l.referencia}
                            onChange={(ref) => aplicarReferencia(l.key, ref)}
                            vacioLabel="Ref."
                            className="min-w-[180px]"
                          />
                        </td>
                        <td className="px-2 py-2 text-xs text-stone-500">{l.descripcion}</td>
                        <td className="px-2 py-2 text-xs text-stone-500">{l.linea}</td>
                        <td className="px-2 py-2 text-xs text-stone-500">{l.categoria}</td>
                        <td className="px-2 py-2">
                          <select
                            className={inputCls}
                            value={l.talla ?? ""}
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
                          {l.referencia && l.talla ? (
                            <span
                              className={`mt-1 block text-[10px] ${
                                excede ? "text-red-600" : "text-stone-400"
                              }`}
                            >
                              Disp: {disp}
                            </span>
                          ) : null}
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
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min={0}
                            className={`${inputCls} text-right`}
                            value={l.valor_unidad || ""}
                            onChange={(e) =>
                              setLinea(l.key, { valor_unidad: Number(e.target.value) || 0 })
                            }
                          />
                        </td>
                        <td className="px-2 py-2 text-right font-semibold text-stone-800">
                          {pesos((l.cantidad || 0) * (l.valor_unidad || 0))}
                        </td>
                        <td className="px-2 py-2">
                          {lineas.length > 1 && (
                            <button
                              onClick={() =>
                                setLineas((p) => p.filter((x) => x.key !== l.key))
                              }
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
                    <td colSpan={5} className="px-2 py-2 text-sm font-semibold text-stone-700">
                      Total
                    </td>
                    <td className="px-2 py-2 text-right text-sm font-bold text-stone-900">
                      {totalUnidades.toLocaleString("es-CO")}
                    </td>
                    <td />
                    <td className="px-2 py-2 text-right text-sm font-bold text-[#344966]">
                      {pesos(totalValor)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => guardar()}
                disabled={isPending}
                className="flex items-center gap-2 rounded-xl bg-[#344966] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a3b52] disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Guardar borrador
              </button>
              <button
                onClick={confirmar}
                disabled={isPending}
                className="flex items-center gap-2 rounded-xl bg-[#15803d] px-4 py-2 text-sm font-medium text-white hover:bg-[#166534] disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                Confirmar y descontar inventario
              </button>
            </div>
            <p className="mt-2 text-xs text-stone-400">
              El borrador no toca el inventario. Al confirmar, cada linea genera una salida por
              referencia y talla.
            </p>
          </Card>
        </div>
      )}

      {vista === "ventas" && (
        <div className="space-y-4">
          {/* Totales */}
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-[11px] uppercase text-stone-400">Documentos</p>
                <p className="text-xl font-bold text-stone-900">{ventasFiltradas.length}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-stone-400">Lineas</p>
                <p className="text-xl font-bold text-stone-900">{filasPlanas.length}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-stone-400">Unidades</p>
                <p className="text-xl font-bold text-stone-900">
                  {unidadesCartera.toLocaleString("es-CO")}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-stone-400">Total</p>
                <p className="text-xl font-bold text-[#344966]">{pesos(totalCartera)}</p>
              </div>
            </div>

            {/* Cuanto factura cada razon social */}
            <div className="mt-4 flex flex-wrap gap-3 border-t border-stone-100 pt-3">
              {RAZONES_SOCIALES.map((r) => {
                const deLaRazon = ventasFiltradas.filter(
                  (v) => v.razon_social === r && v.estado !== "anulada"
                )
                const valor = deLaRazon.reduce((s, v) => s + Number(v.total_valor), 0)
                return (
                  <div key={r} className="flex items-center gap-2">
                    <Badge className={RAZON_SOCIAL_COLOR[r]}>{r}</Badge>
                    <span className="text-sm font-semibold text-stone-800">{pesos(valor)}</span>
                    <span className="text-xs text-stone-400">
                      ({deLaRazon.length} factura{deLaRazon.length === 1 ? "" : "s"})
                    </span>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Filtros */}
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
                  Cliente, ciudad o documento
                </label>
                <input
                  className={`${filtroCls} w-full`}
                  value={fCliente}
                  onChange={(e) => setFCliente(e.target.value)}
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
              <div>
                <label className="block text-[11px] font-medium text-stone-500">
                  Razon social
                </label>
                <select
                  className={filtroCls}
                  value={fRazon}
                  onChange={(e) => setFRazon(e.target.value as RazonSocial | "")}
                >
                  <option value="">Todas</option>
                  {RAZONES_SOCIALES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={exportarExcel}
                className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600 hover:bg-stone-50"
              >
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </button>
              <button
                onClick={imprimir}
                className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600 hover:bg-stone-50"
              >
                <Printer className="h-4 w-4" /> Imprimir
              </button>
            </div>
          </Card>

          {/* Tabla plana, como el formato de CARTERA */}
          <Card className="p-0">
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full min-w-[1000px] text-sm">
                <thead className="sticky top-0 bg-stone-50">
                  <tr className="border-b border-stone-200">
                    {[
                      "Fecha",
                      "Documento",
                      "Cliente",
                      "Ciudad",
                      "Ref.",
                      "Descripcion",
                      "Linea",
                      "Categoria",
                      "Cant.",
                      "Vr. unidad",
                      "Total",
                      "Factura",
                      "Pago",
                      "Estado",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left text-xs font-semibold uppercase text-stone-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filasPlanas.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="px-3 py-8 text-center text-sm text-stone-400">
                        No hay ventas registradas con esos filtros
                      </td>
                    </tr>
                  ) : (
                    filasPlanas.map((f, i) => (
                      <tr
                        key={`${f.documento}_${f.referencia}_${f.cantidad}_${i}`}
                        className="border-b border-stone-100 last:border-0 hover:bg-stone-50"
                      >
                        <td className="px-3 py-2 font-mono text-xs text-stone-600">{f.fecha}</td>
                        <td className="px-3 py-2 font-semibold text-stone-800">{f.documento}</td>
                        <td className="px-3 py-2 text-stone-700">{f.cliente}</td>
                        <td className="px-3 py-2 text-stone-500">{f.ciudad}</td>
                        <td className="px-3 py-2 font-semibold text-stone-800">{f.referencia}</td>
                        <td className="px-3 py-2 text-xs text-stone-500">{f.descripcion}</td>
                        <td className="px-3 py-2 text-xs text-stone-500">{f.linea}</td>
                        <td className="px-3 py-2 text-xs text-stone-500">{f.categoria}</td>
                        <td className="px-3 py-2 text-right text-stone-800">{f.cantidad}</td>
                        <td className="px-3 py-2 text-right text-stone-600">{pesos(f.valor)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-stone-900">
                          {pesos(f.total)}
                        </td>
                        <td className="px-3 py-2">
                          <Badge className={RAZON_SOCIAL_COLOR[f.razon_social]}>
                            {f.razon_social}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge className={FORMA_PAGO_COLOR[f.forma_pago]}>
                            {f.forma_pago === "credito" ? "Credito" : "Contado"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge className={ESTADO_VENTA_COLOR[f.estado]}>
                            {ESTADO_VENTA_LABEL[f.estado]}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Documentos con sus acciones */}
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-stone-700">Documentos</h2>
            <div className="max-h-[420px] space-y-2 overflow-auto">
              {ventasFiltradas.map((v) => (
                <div
                  key={v.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 p-3"
                >
                  <div className="min-w-[220px]">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-stone-800">{v.numero_documento}</span>
                      <Badge className={ESTADO_VENTA_COLOR[v.estado]}>
                        {ESTADO_VENTA_LABEL[v.estado]}
                      </Badge>
                      <Badge className={FORMA_PAGO_COLOR[v.forma_pago]}>
                        {FORMA_PAGO_LABEL[v.forma_pago]}
                      </Badge>
                      <Badge className={RAZON_SOCIAL_COLOR[v.razon_social]}>
                        {v.razon_social}
                      </Badge>
                    </div>
                    <p className="text-xs text-stone-500">
                      {v.fecha} &middot; {v.cliente_nombre}
                      {v.ciudad ? ` - ${v.ciudad}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-stone-900">{pesos(Number(v.total_valor))}</p>
                    <p className="text-xs text-stone-500">{v.total_unidades} unidades</p>
                    {v.forma_pago === "credito" && v.estado === "confirmada" && (
                      <p className="text-xs text-amber-700">
                        Saldo: {pesos(Number(v.total_valor) - Number(v.total_abonado))}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {v.estado === "borrador" && (
                      <button
                        onClick={() => cargarVenta(v)}
                        className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50"
                      >
                        <Pencil className="h-3 w-3" /> Editar
                      </button>
                    )}
                    {v.estado === "confirmada" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="flex items-center gap-1 rounded-lg border border-amber-200 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50">
                            <Ban className="h-3 w-3" /> Anular
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Anular la venta {v.numero_documento}</AlertDialogTitle>
                            <AlertDialogDescription>
                              Se devuelven {v.total_unidades} unidades al inventario y la venta
                              queda marcada como anulada.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => anular(v.id)}>
                              Anular
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Eliminar la venta {v.numero_documento}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Se devuelve el inventario que haya descontado y el documento se borra.
                            Solo el administrador puede hacerlo.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => eliminar(v.id)}>
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
              {ventasFiltradas.length === 0 && (
                <p className="py-6 text-center text-sm text-stone-400">
                  No hay documentos con esos filtros
                </p>
              )}
            </div>
          </Card>
        </div>
      )}

      {vista === "cartera" && (
        <div className="space-y-4">
          {/* Totales de cartera */}
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-[11px] uppercase text-stone-400">Facturas a credito</p>
                <p className="text-xl font-bold text-stone-900">{carteraFiltrada.length}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-stone-400">Por cobrar</p>
                <p className="text-xl font-bold text-amber-700">{pesos(totalPorCobrar)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-stone-400">Abonado</p>
                <p className="text-xl font-bold text-emerald-700">
                  {pesos(totalAbonadoCartera)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-stone-400">Vencidas</p>
                <p className="text-xl font-bold text-red-700">{vencidas.length}</p>
              </div>
            </div>
          </Card>

          {/* Filtros */}
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
                  Cliente, ciudad o documento
                </label>
                <input
                  className={`${filtroCls} w-full`}
                  value={fCliente}
                  onChange={(e) => setFCliente(e.target.value)}
                  placeholder="Buscar..."
                />
              </div>
            </div>
          </Card>

          <Card className="p-0">
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="sticky top-0 bg-stone-50">
                  <tr className="border-b border-stone-200">
                    {[
                      "Documento",
                      "Fecha",
                      "Cliente",
                      "Vence",
                      "Total",
                      "Abonado",
                      "Saldo",
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
                  {carteraFiltrada.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-sm text-stone-400">
                        No hay ventas a credito pendientes
                      </td>
                    </tr>
                  ) : (
                    carteraFiltrada.map((v) => {
                      const saldo = saldoDe(v)
                      const vencida = saldo > 0 && v.fecha_vencimiento && v.fecha_vencimiento < hoy
                      const pagada = saldo <= 0
                      return (
                        <tr
                          key={v.id}
                          className="border-b border-stone-100 last:border-0 hover:bg-stone-50"
                        >
                          <td className="px-3 py-2 font-semibold text-stone-800">
                            {v.numero_documento}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-stone-600">{v.fecha}</td>
                          <td className="px-3 py-2 text-stone-700">
                            {v.cliente_nombre}
                            {v.ciudad ? (
                              <span className="block text-[11px] text-stone-400">{v.ciudad}</span>
                            ) : null}
                          </td>
                          <td
                            className={`px-3 py-2 font-mono text-xs ${
                              vencida ? "font-semibold text-red-600" : "text-stone-600"
                            }`}
                          >
                            {v.fecha_vencimiento ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-right text-stone-700">
                            {pesos(Number(v.total_valor))}
                          </td>
                          <td className="px-3 py-2 text-right text-emerald-700">
                            {pesos(Number(v.total_abonado))}
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-bold ${
                              pagada ? "text-emerald-700" : "text-amber-700"
                            }`}
                          >
                            {pesos(saldo)}
                          </td>
                          <td className="px-3 py-2">
                            {pagada ? (
                              <Badge className="bg-emerald-100 text-emerald-800">Pagada</Badge>
                            ) : vencida ? (
                              <Badge className="bg-red-100 text-red-800">Vencida</Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-800">Pendiente</Badge>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => abrirAbonos(v)}
                              className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50"
                            >
                              <Wallet className="h-3 w-3" /> Abonos
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Abonos de la venta abierta */}
          {abonoDe && (
            <Card className="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-stone-700">
                    Abonos de {abonoDe.numero_documento}
                  </h2>
                  <p className="text-xs text-stone-500">
                    {abonoDe.cliente_nombre} &middot; Saldo:{" "}
                    <strong className="text-amber-700">{pesos(saldoDe(abonoDe))}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setAbonoDe(null)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-stone-500 hover:bg-stone-100"
                >
                  <X className="h-3 w-3" /> Cerrar
                </button>
              </div>

              {saldoDe(abonoDe) > 0 && (
                <div className="mb-3 grid grid-cols-1 gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3 sm:grid-cols-5">
                  <div>
                    <label className="text-[11px] font-medium text-stone-500">Fecha</label>
                    <input
                      type="date"
                      className={inputCls}
                      value={abFecha}
                      onChange={(e) => setAbFecha(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-stone-500">Valor</label>
                    <input
                      type="number"
                      min={0}
                      className={inputCls}
                      value={abValor || ""}
                      onChange={(e) => setAbValor(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-stone-500">Medio</label>
                    <select
                      className={inputCls}
                      value={abMedio}
                      onChange={(e) => setAbMedio(e.target.value)}
                    >
                      <option value="">Medio de pago</option>
                      <option value="Efectivo">Efectivo</option>
                      <option value="Transferencia">Transferencia</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Consignacion">Consignacion</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-stone-500">Referencia</label>
                    <input
                      className={inputCls}
                      value={abReferencia}
                      onChange={(e) => setAbReferencia(e.target.value)}
                      placeholder="No. comprobante"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={guardarAbono}
                      disabled={isPending}
                      className="w-full rounded-xl bg-[#15803d] px-4 py-2 text-sm font-medium text-white hover:bg-[#166534] disabled:opacity-50"
                    >
                      Registrar abono
                    </button>
                  </div>
                </div>
              )}

              {abonos.length === 0 ? (
                <p className="py-4 text-center text-sm text-stone-400">
                  Esta factura aun no tiene abonos
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200">
                      {["Fecha", "Valor", "Medio", "Referencia", ""].map((h, i) => (
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
                    {abonos.map((a) => (
                      <tr key={a.id} className="border-b border-stone-100 last:border-0">
                        <td className="px-3 py-2 font-mono text-xs text-stone-600">{a.fecha}</td>
                        <td className="px-3 py-2 font-semibold text-emerald-700">
                          {pesos(Number(a.valor))}
                        </td>
                        <td className="px-3 py-2 text-stone-600">{a.medio_pago ?? "—"}</td>
                        <td className="px-3 py-2 text-xs text-stone-500">{a.referencia ?? "—"}</td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => borrarAbono(a.id)}
                            className="rounded-lg p-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          )}
        </div>
      )}
      {vista === "historial" && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[11px] font-medium text-stone-500">Nivel</label>
                <select
                  className={filtroCls}
                  value={hNivel}
                  onChange={(e) => {
                    const n = e.target.value as "factura" | "detalle" | ""
                    setHNivel(n)
                    cargarHistorial(n, hRazon)
                  }}
                >
                  <option value="">Todo</option>
                  <option value="factura">Factura</option>
                  <option value="detalle">Detalle</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-stone-500">
                  Razon social
                </label>
                <select
                  className={filtroCls}
                  value={hRazon}
                  onChange={(e) => {
                    const r = e.target.value as RazonSocial | ""
                    setHRazon(r)
                    cargarHistorial(hNivel, r)
                  }}
                >
                  <option value="">Todas</option>
                  {RAZONES_SOCIALES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => cargarHistorial(hNivel, hRazon)}
                disabled={isPending}
                className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                Actualizar
              </button>
              <p className="text-xs text-stone-400">
                {historial.length} evento(s) &middot; a nivel factura se ve el ciclo del
                documento; a nivel detalle, las lineas vendidas
              </p>
            </div>
          </Card>

          <Card className="p-0">
            <div className="max-h-[600px] overflow-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="sticky top-0 bg-stone-50">
                  <tr className="border-b border-stone-200">
                    {[
                      "Fecha y hora",
                      "Documento",
                      "Factura",
                      "Cliente",
                      "Nivel",
                      "Accion",
                      "Detalle",
                      "Usuario",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left text-xs font-semibold uppercase text-stone-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historial.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-sm text-stone-400">
                        {hCargado ? "No hay eventos registrados" : "Cargando..."}
                      </td>
                    </tr>
                  ) : (
                    historial.map((h) => (
                      <tr
                        key={h.id}
                        className="border-b border-stone-100 last:border-0 hover:bg-stone-50"
                      >
                        <td className="px-3 py-2 font-mono text-[11px] text-stone-500">
                          {new Date(h.creado_en).toLocaleString("es-CO", {
                            timeZone: "America/Bogota",
                          })}
                        </td>
                        <td className="px-3 py-2 font-semibold text-stone-800">
                          {h.numero_documento}
                        </td>
                        <td className="px-3 py-2">
                          {h.razon_social ? (
                            <Badge className={RAZON_SOCIAL_COLOR[h.razon_social]}>
                              {h.razon_social}
                            </Badge>
                          ) : (
                            <span className="text-xs text-stone-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-stone-600">{h.cliente_nombre}</td>
                        <td className="px-3 py-2">
                          <Badge
                            className={
                              h.nivel === "factura"
                                ? "bg-[#344966]/10 text-[#344966]"
                                : "bg-stone-100 text-stone-600"
                            }
                          >
                            {h.nivel}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-stone-700">{h.accion}</td>
                        <td className="px-3 py-2 text-xs text-stone-500">
                          {h.nivel === "detalle" ? (
                            <span>
                              <strong className="text-stone-700">{h.referencia}</strong>
                              {h.talla ? ` talla ${h.talla}` : ""} &middot; {h.cantidad} und
                              {h.valor_unidad ? ` a ${pesos(Number(h.valor_unidad))}` : ""}
                            </span>
                          ) : (
                            <span>
                              {h.descripcion}
                              {h.total_valor != null && (
                                <span className="ml-1 text-stone-400">
                                  ({pesos(Number(h.total_valor))})
                                </span>
                              )}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-stone-500">
                          {h.usuario_nombre ?? "—"}
                        </td>
                      </tr>
                    ))
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
