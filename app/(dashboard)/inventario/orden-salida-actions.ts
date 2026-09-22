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
