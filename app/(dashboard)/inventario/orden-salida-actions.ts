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
import { guardarVenta, listReferenciasVenta } from "@/lib/db/venta"

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

// ── Venta agrupada de varias ordenes ────────────────────────────

// Factura en un solo documento varias ordenes de salida del MISMO
// cliente. Las lineas de la misma referencia y talla se suman, para que
// la factura no repita el mismo item en varios renglones.
export async function generarVentaAgrupadaAction(
  ordenIds: number[]
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  if (!(await esAdmin(session.userId))) {
    return { error: "Solo el administrador puede agrupar órdenes en una venta" }
  }
  if (ordenIds.length === 0) return { error: "Selecciona al menos una orden" }

  try {
    const ordenes = []
    for (const id of ordenIds) {
      const o = await getOrdenSalida(id)
      if (!o) return { error: `Orden ${id} no encontrada` }
      ordenes.push(o)
    }

    // Todas tienen que estar confirmadas y sin facturar
    const noConfirmadas = ordenes.filter((o) => o.estado !== "confirmada")
    if (noConfirmadas.length > 0) {
      return {
        error: `Confirma primero: ${noConfirmadas.map((o) => o.numero).join(", ")}`,
      }
    }
    const yaFacturadas = ordenes.filter((o) => o.venta_id)
    if (yaFacturadas.length > 0) {
      return {
        error: `Ya facturadas: ${yaFacturadas
          .map((o) => `${o.numero} (doc. ${o.venta_documento})`)
          .join(", ")}`,
      }
    }

    // Un documento es de un solo cliente
    const clientes = [...new Set(ordenes.map((o) => o.cliente_nombre.trim().toUpperCase()))]
    if (clientes.length > 1) {
      return {
        error: `Las órdenes son de clientes distintos (${clientes.join(", ")}): agrúpalas por cliente`,
      }
    }

    const referencias = await listReferenciasVenta()
    const precioDe = new Map(referencias.map((r) => [r.referencia.trim().toUpperCase(), r]))

    // Consolidar: la misma referencia y talla suma en una sola linea
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
    // La factura lleva la fecha mas reciente de las ordenes agrupadas
    const fecha = ordenes.map((o) => o.fecha).sort().at(-1) ?? base.fecha
    const numeros = ordenes.map((o) => o.numero).join(", ")

    const ventaId = await guardarVenta(
      {
        fecha,
        cliente_id: base.cliente_id,
        cliente_nombre: base.cliente_nombre,
        ciudad: base.ciudad,
        observacion: `Generada desde ${ordenes.length} orden(es) de salida: ${numeros}`,
        lineas,
      },
      session.userId
    )

    // Cada orden queda enlazada a la misma venta
    for (const o of ordenes) {
      await marcarVentaGenerada(o.id, ventaId, session.userId)
    }

    revalidar()

    const sinPrecio = [
      ...new Set(lineas.filter((l) => !(l.valor_unidad > 0)).map((l) => l.referencia)),
    ]
    const avisos: string[] = []
    if (sinPrecio.length > 0) {
      avisos.push(`Revisa el precio de: ${sinPrecio.join(", ")} (quedaron en $0)`)
    }
    const totalLineasOriginales = ordenes.reduce((s, o) => s + o.detalle.length, 0)
    if (totalLineasOriginales > lineas.length) {
      avisos.push(
        `Se consolidaron ${totalLineasOriginales} líneas en ${lineas.length} (misma referencia y talla)`
      )
    }

    return {
      success: true,
      ventaId,
      aviso: avisos.length > 0 ? avisos.join(". ") : undefined,
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error generando la venta agrupada" }
  }
}

// ── Generar la venta desde la orden ─────────────────────────────

// Crea la venta en BORRADOR con los datos de la orden ya cargados. No
// descuenta inventario: eso ya lo hizo la orden de salida al confirmarse.
export async function generarVentaDesdeOrdenAction(
  ordenId: number
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const orden = await getOrdenSalida(ordenId)
    if (!orden) return { error: "Orden de salida no encontrada" }
    if (orden.estado !== "confirmada") {
      return { error: "Confirma la orden de salida antes de facturarla" }
    }
    if (orden.venta_id) {
      return { error: `Esta orden ya se facturó con el documento ${orden.venta_documento}` }
    }
    if (orden.detalle.length === 0) return { error: "La orden no tiene líneas" }

    // Los precios salen del maestro de referencias
    const referencias = await listReferenciasVenta()
    const precioDe = new Map(
      referencias.map((r) => [r.referencia.trim().toUpperCase(), r])
    )

    const lineas = orden.detalle.map((d) => {
      const ref = precioDe.get(d.referencia.trim().toUpperCase())
      return {
        referencia: d.referencia,
        descripcion: d.descripcion ?? ref?.descripcion ?? null,
        linea: ref?.linea ?? null,
        categoria: ref?.categoria ?? null,
        talla: d.talla,
        cantidad: d.cantidad,
        valor_unidad: Number(ref?.valor_unidad ?? 0),
      }
    })

    const ventaId = await guardarVenta(
      {
        fecha: orden.fecha,
        cliente_id: orden.cliente_id,
        cliente_nombre: orden.cliente_nombre,
        ciudad: orden.ciudad,
        observacion: `Generada desde la orden de salida ${orden.numero}`,
        lineas,
      },
      session.userId
    )

    await marcarVentaGenerada(ordenId, ventaId, session.userId)
    revalidar()

    // Las referencias sin precio en el maestro quedan en cero: hay que
    // completarlas antes de confirmar la venta
    const sinPrecio = [
      ...new Set(lineas.filter((l) => !(l.valor_unidad > 0)).map((l) => l.referencia)),
    ]
    return {
      success: true,
      ventaId,
      aviso:
        sinPrecio.length > 0
          ? `Revisa el precio de: ${sinPrecio.join(", ")} (quedaron en $0)`
          : undefined,
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error generando la venta" }
  }
}
