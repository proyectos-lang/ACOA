"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import { getPermiso } from "@/lib/db/permiso"
import {
  guardarOrdenSalida,
  confirmarOrdenSalida,
  anularOrdenSalida,
  eliminarOrdenSalida,
  verificarDisponibleSalida,
  getOrdenSalida,
  getHistorialOrdenSalida,
  getHistorialOrdenesSalida,
  marcarVentaGenerada,
  type LineaOrdenSalidaInput,
  type FaltanteSalida,
  type OrdenSalidaConDetalle,
  type OrdenSalidaHistorialRow,
  type HistorialOSConOrden,
} from "@/lib/db/orden-salida"
import { listReferenciasVenta } from "@/lib/db/venta"

// Datos que se le pasan al formulario de registrar venta. No se guarda
// nada: la venta la crea el usuario cuando decida hacerlo.
export interface PrecargaVenta {
  origen: string
  orden_ids: number[]
  cliente_id: number | null
  cliente_nombre: string
  ciudad: string | null
  fecha: string
  observacion: string
  lineas: Array<{
    referencia: string
    descripcion: string | null
    linea: string | null
    categoria: string | null
    talla: string
    cantidad: number
    valor_unidad: number
  }>
  sin_precio: string[]
  lineas_consolidadas: number
  lineas_originales: number
}

type ActionResult = {
  error?: string
  success?: boolean
  ordenId?: number
  ventaId?: number
  faltantes?: FaltanteSalida[]
  orden?: OrdenSalidaConDetalle | null
  historial?: OrdenSalidaHistorialRow[]
  historialGlobal?: HistorialOSConOrden[]
  aviso?: string
  precarga?: PrecargaVenta
}

function revalidar() {
  revalidatePath("/inventario")
  revalidatePath("/ventas")
}

async function esAdmin(userId: number): Promise<boolean> {
  const permiso = await getPermiso(userId)
  return permiso?.mod_usuarios === true
}

export async function guardarOrdenSalidaAction(input: {
  id?: number | null
  fecha: string
  cliente_id: number | null
  cliente_nombre: string
  ciudad?: string
  motivo?: string
  observacion?: string
  lineas: LineaOrdenSalidaInput[]
}): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  if (!input.fecha) return { error: "Indica la fecha" }
  if (!input.cliente_nombre.trim()) return { error: "Indica el cliente" }

  try {
    const ordenId = await guardarOrdenSalida(input, session.userId)
    revalidar()
    return { success: true, ordenId }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error guardando la orden" }
  }
}

export async function verificarDisponibleSalidaAction(
  lineas: Array<{ referencia: string; talla: string; cantidad: number }>
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const faltantes = await verificarDisponibleSalida(lineas)
    return { success: true, faltantes }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error verificando el inventario" }
  }
}

export async function confirmarOrdenSalidaAction(ordenId: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await confirmarOrdenSalida(ordenId, session.userId)
    revalidar()
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error confirmando la orden" }
  }
}

export async function anularOrdenSalidaAction(ordenId: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await anularOrdenSalida(ordenId, session.userId)
    revalidar()
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error anulando la orden" }
  }
}

export async function eliminarOrdenSalidaAction(ordenId: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  if (!(await esAdmin(session.userId))) {
    return { error: "Solo el administrador puede eliminar órdenes de salida" }
  }

  try {
    await eliminarOrdenSalida(ordenId, session.userId)
    revalidar()
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error eliminando la orden" }
  }
}

export async function cargarOrdenSalidaAction(ordenId: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const orden = await getOrdenSalida(ordenId)
    return { success: true, orden }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error cargando la orden" }
  }
}

// ── Historial ───────────────────────────────────────────────────

export async function cargarHistorialOrdenAction(ordenId: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const historial = await getHistorialOrdenSalida(ordenId)
    return { success: true, historial }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error cargando el historial" }
  }
}

// El historial completo es de consulta del administrador
export async function cargarHistorialOrdenesAction(input?: {
  nivel?: "cabecera" | "detalle" | null
}): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  if (!(await esAdmin(session.userId))) {
    return { error: "Solo el administrador puede ver el historial de órdenes" }
  }

  try {
    const historialGlobal = await getHistorialOrdenesSalida(input)
    return { success: true, historialGlobal }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error cargando el historial" }
  }
}

// ── Preparar la venta desde ordenes de salida ───────────────────

// Arma los datos para el formulario de registrar venta. NO crea nada:
// la venta se guarda cuando el usuario la registre desde su modulo.
// Acepta una orden o varias del mismo cliente (venta agrupada).
export async function prepararVentaDesdeOrdenesAction(
  ordenIds: number[]
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  if (ordenIds.length === 0) return { error: "Selecciona al menos una orden" }
  // Agrupar varias es del administrador; facturar una sola no
  if (ordenIds.length > 1 && !(await esAdmin(session.userId))) {
    return { error: "Solo el administrador puede agrupar órdenes en una venta" }
  }

  try {
    const ordenes = []
    for (const id of ordenIds) {
      const o = await getOrdenSalida(id)
      if (!o) return { error: `Orden ${id} no encontrada` }
      ordenes.push(o)
    }

    const noConfirmadas = ordenes.filter((o) => o.estado !== "confirmada")
    if (noConfirmadas.length > 0) {
      return { error: `Confirma primero: ${noConfirmadas.map((o) => o.numero).join(", ")}` }
    }
    const yaFacturadas = ordenes.filter((o) => o.venta_id)
    if (yaFacturadas.length > 0) {
      return {
        error: `Ya facturadas: ${yaFacturadas
          .map((o) => `${o.numero} (doc. ${o.venta_documento})`)
          .join(", ")}`,
      }
    }

    const clientes = [...new Set(ordenes.map((o) => o.cliente_nombre.trim().toUpperCase()))]
    if (clientes.length > 1) {
      return {
        error: `Las órdenes son de clientes distintos (${clientes.join(", ")}): agrúpalas por cliente`,
      }
    }

    const referencias = await listReferenciasVenta()
    const precioDe = new Map(referencias.map((r) => [r.referencia.trim().toUpperCase(), r]))

    // La misma referencia y talla va en una sola linea
    const consolidado = new Map<
      string,
      {
        referencia: string
        descripcion: string | null
        linea: string | null
        categoria: string | null
        talla: string
        cantidad: number
        valor_unidad: number
      }
    >()
    for (const o of ordenes) {
      for (const d of o.detalle) {
        const key = `${d.referencia.trim().toUpperCase()}|${d.talla.trim().toUpperCase()}`
        const ref = precioDe.get(d.referencia.trim().toUpperCase())
        const actual = consolidado.get(key)
        if (actual) {
          actual.cantidad += d.cantidad
        } else {
          consolidado.set(key, {
            referencia: d.referencia,
            descripcion: d.descripcion ?? ref?.descripcion ?? null,
            linea: ref?.linea ?? null,
            categoria: ref?.categoria ?? null,
            talla: d.talla,
            cantidad: d.cantidad,
            valor_unidad: Number(ref?.valor_unidad ?? 0),
          })
        }
      }
    }
    const lineas = [...consolidado.values()]
    if (lineas.length === 0) return { error: "Las órdenes no tienen líneas" }

    const base = ordenes[0]
    const fecha = ordenes.map((o) => o.fecha).sort().at(-1) ?? base.fecha
    const numeros = ordenes.map((o) => o.numero).join(", ")

    return {
      success: true,
      precarga: {
        origen: numeros,
        orden_ids: ordenes.map((o) => o.id),
        cliente_id: base.cliente_id,
        cliente_nombre: base.cliente_nombre,
        ciudad: base.ciudad,
        fecha,
        observacion: `Desde ${ordenes.length} orden(es) de salida: ${numeros}`,
        lineas,
        sin_precio: [
          ...new Set(lineas.filter((l) => !(l.valor_unidad > 0)).map((l) => l.referencia)),
        ],
        lineas_consolidadas: lineas.length,
        lineas_originales: ordenes.reduce((s, o) => s + o.detalle.length, 0),
      },
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error preparando la venta" }
  }
}

// Enlaza las ordenes con la venta que el usuario acabo de registrar.
// Se llama desde el modulo de ventas al guardar una venta precargada.
export async function enlazarOrdenesConVentaAction(
  ordenIds: number[],
  ventaId: number
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    for (const id of ordenIds) {
      const o = await getOrdenSalida(id)
      // Si alguna ya quedo facturada entre tanto, no se pisa
      if (!o || o.venta_id) continue
      await marcarVentaGenerada(id, ventaId, session.userId)
    }
    revalidar()
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error enlazando las órdenes" }
  }
}
