"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import { getPermiso } from "@/lib/db/permiso"
import {
  guardarVenta,
  confirmarVenta,
  anularVenta,
  eliminarVenta,
  verificarDisponible,
  createCliente,
  updateCliente,
  deleteCliente,
  upsertReferenciaVenta,
  getSiguienteDocumento,
  type LineaVentaInput,
  type FaltanteInventario,
} from "@/lib/db/venta"

type ActionResult = {
  error?: string
  success?: boolean
  ventaId?: number
  documento?: string
  faltantes?: FaltanteInventario[]
}

function revalidar() {
  revalidatePath("/ventas")
  revalidatePath("/inventario")
}

// Borrar una venta ya confirmada devuelve inventario, asi que se reserva
// al administrador (mismo criterio que el historial: permiso de Usuarios)
async function esAdmin(userId: number): Promise<boolean> {
  const permiso = await getPermiso(userId)
  return permiso?.mod_usuarios === true
}

export async function guardarVentaAction(input: {
  id?: number | null
  numero_documento: string
  fecha: string
  cliente_id: number | null
  cliente_nombre: string
  ciudad?: string
  observacion?: string
  lineas: LineaVentaInput[]
}): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  if (!input.numero_documento.trim()) return { error: "Indica el número de documento" }
  if (!input.fecha) return { error: "Indica la fecha" }
  if (!input.cliente_nombre.trim()) return { error: "Indica el cliente" }

  try {
    const ventaId = await guardarVenta(input, session.userId)
    revalidar()
    return { success: true, ventaId }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error guardando la venta" }
  }
}

// Revisa el inventario antes de confirmar, para avisar en la interfaz
export async function verificarDisponibleAction(
  lineas: Array<{ referencia: string; talla: string | null; cantidad: number }>
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const faltantes = await verificarDisponible(lineas)
    return { success: true, faltantes }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error verificando el inventario" }
  }
}

export async function confirmarVentaAction(ventaId: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await confirmarVenta(ventaId, session.userId)
    revalidar()
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error confirmando la venta" }
  }
}

export async function anularVentaAction(ventaId: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await anularVenta(ventaId)
    revalidar()
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error anulando la venta" }
  }
}

export async function eliminarVentaAction(ventaId: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  if (!(await esAdmin(session.userId))) {
    return { error: "Solo el administrador puede eliminar ventas" }
  }

  try {
    await eliminarVenta(ventaId)
    revalidar()
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error eliminando la venta" }
  }
}

export async function siguienteDocumentoAction(): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const documento = await getSiguienteDocumento()
    return { success: true, documento }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error calculando el consecutivo" }
  }
}

// ── Clientes ────────────────────────────────────────────────────

export async function crearClienteAction(input: {
  nombre: string
  ciudad?: string
  nit?: string
  telefono?: string
  direccion?: string
  contacto?: string
}): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  if (!input.nombre.trim()) return { error: "Indica el nombre del cliente" }

  try {
    await createCliente(input, session.userId)
    revalidatePath("/ventas")
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error creando el cliente"
    if (msg.toLowerCase().includes("duplicate")) {
      return { error: "Ya existe un cliente con ese nombre en esa ciudad" }
    }
    return { error: msg }
  }
}

export async function actualizarClienteAction(
  id: number,
  campos: {
    nombre?: string
    ciudad?: string | null
    nit?: string | null
    telefono?: string | null
    direccion?: string | null
    contacto?: string | null
    activo?: boolean
  }
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await updateCliente(id, campos)
    revalidatePath("/ventas")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error actualizando el cliente" }
  }
}

export async function eliminarClienteAction(id: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await deleteCliente(id)
    revalidatePath("/ventas")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error eliminando el cliente" }
  }
}

// ── Referencias y precios ───────────────────────────────────────

export async function guardarReferenciaVentaAction(input: {
  referencia: string
  descripcion?: string
  linea?: string
  categoria?: string
  valor_unidad: number
}): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  if (!input.referencia.trim()) return { error: "Indica la referencia" }

  try {
    await upsertReferenciaVenta(input, session.userId)
    revalidatePath("/ventas")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error guardando la referencia" }
  }
}
