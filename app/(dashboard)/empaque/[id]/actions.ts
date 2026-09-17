"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import {
  createEmpaqueRegistro,
  deleteEmpaqueRegistro,
  getEmpaquePorLote,
} from "@/lib/db/empaque-registro"
import {
  registrarEntradaPorEmpaque,
  eliminarEntradaPorEmpaque,
} from "@/lib/db/inventario-producto"
import { getConteoByLote, getConteoDetalle } from "@/lib/db/conteo"
import {
  getLoteById,
  getLotesByOrden,
  updateLoteEstado,
  updateLoteJustificacionEmpaque,
} from "@/lib/db/lote"
import { cambiarEstado, getOrdenById } from "@/lib/db/orden-produccion"
import { getPermiso } from "@/lib/db/permiso"

type ActionResult = { error?: string; success?: boolean }

export async function crearEmpaqueRegistroAction(input: {
  lote_id: number
  persona_id: number
  color: string
  talla: string
  cantidad: number
  imperfectos?: number
  fecha?: string
  // false = solo carga inventario, sin pago por produccion
  genera_pago?: boolean
}): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  const imperfectos = input.imperfectos ?? 0
  if (input.cantidad < 0 || imperfectos < 0) {
    return { error: "Las cantidades no pueden ser negativas" }
  }
  if (input.cantidad <= 0 && imperfectos <= 0) {
    return { error: "Ingrese la cantidad empacada o los imperfectos encontrados" }
  }

  try {
    // Verificar conteo validado
    const conteo = await getConteoByLote(input.lote_id)
    if (!conteo || !conteo.validado) {
      return { error: "El conteo debe estar validado antes de registrar empaque" }
    }

    // Verificar límite por talla
    const [detalle, registros] = await Promise.all([
      getConteoDetalle(conteo.id),
      getEmpaquePorLote(input.lote_id),
    ])

    // El empaque se controla solo por talla (los conteos viejos podían
    // tener la misma talla repartida en varios colores: se suman)
    const tallaKey = input.talla.trim().toLowerCase()
    const filasTalla = detalle.filter((d) => d.talla.trim().toLowerCase() === tallaKey)
    if (filasTalla.length === 0) {
      return { error: `No existe conteo para la talla "${input.talla}"` }
    }
    const contadoTalla = filasTalla.reduce((s, d) => s + d.cantidad_contada, 0)

    // Lo empacado + imperfectos encontrados no puede exceder lo contado
    const yaRegistrado = registros
      .filter((r) => r.talla.trim().toLowerCase() === tallaKey)
      .reduce((s, r) => s + r.cantidad + (r.imperfectos ?? 0), 0)

    if (yaRegistrado + input.cantidad + imperfectos > contadoTalla) {
      const disponible = Math.max(0, contadoTalla - yaRegistrado)
      return {
        error: `Excede el conteo: disponible ${disponible} ud. para la talla ${input.talla} (empacado + imperfectos)`,
      }
    }

    // Precio snapshot del lote
    const lote = await getLoteById(input.lote_id)
    if (!lote) return { error: "Lote no encontrado" }

    const fechaHoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })

    const registroId = await createEmpaqueRegistro({
      lote_id: input.lote_id,
      persona_id: input.persona_id,
      color: input.color,
      talla: input.talla,
      cantidad: input.cantidad,
      imperfectos,
      precio_unidad: lote.precio_empaque_unidad,
      fecha: input.fecha || fechaHoy,
      genera_pago: input.genera_pago !== false,
      creado_por: session.userId,
    })

    // El empaque carga el inventario de producto terminado con toda su
    // trazabilidad (OP, referencia, lote, talla)
    if (input.cantidad > 0) {
      await registrarEntradaPorEmpaque({
        empaque_registro_id: registroId,
        lote_id: input.lote_id,
        talla: input.talla,
        cantidad: input.cantidad,
        fecha: input.fecha || fechaHoy,
        creado_por: session.userId,
      })
    }

    revalidatePath(`/empaque/${input.lote_id}`)
    revalidatePath("/inventario")
    revalidatePath("/liquidacion-empaque")
    revalidatePath("/nomina")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error registrando empaque" }
  }
}

export async function eliminarEmpaqueRegistroAction(
  registroId: number,
  loteId: number
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    // Al eliminar el registro se revierte su entrada de inventario
    await eliminarEntradaPorEmpaque(registroId)
    await deleteEmpaqueRegistro(registroId)
    revalidatePath(`/empaque/${loteId}`)
    revalidatePath("/inventario")
    revalidatePath("/liquidacion-empaque")
    revalidatePath("/nomina")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error eliminando registro" }
  }
}

// Reabre un lote ya finalizado para corregir lo empacado. Devuelve el
// lote al estado "empaque" y, si su OP estaba terminada, la reactiva.
export async function reabrirLoteAction(loteId: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  // Corregir un lote cerrado mueve inventario y pagos: solo el administrador
  const permiso = await getPermiso(session.userId)
  if (permiso?.mod_usuarios !== true) {
    return { error: "Solo el administrador puede reabrir un lote finalizado" }
  }

  try {
    const lote = await getLoteById(loteId)
    if (!lote) return { error: "Lote no encontrado" }
    if (lote.estado !== "finalizado") {
      return { error: "El lote no esta finalizado" }
    }

    await updateLoteEstado(loteId, "empaque")

    // La OP vuelve a estar en proceso: ya no estan todos sus lotes cerrados
    const orden = await getOrdenById(lote.orden_id)
    if (orden?.estado === "terminada") {
      await cambiarEstado(lote.orden_id, "empaque")
    }

    revalidatePath(`/empaque/${loteId}`)
    revalidatePath("/empaque")
    revalidatePath("/inventario")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error reabriendo el lote" }
  }
}

export async function finalizarLoteAction(
  loteId: number,
  justificacion?: string
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const [lote, conteo, registros] = await Promise.all([
      getLoteById(loteId),
      getConteoByLote(loteId),
      getEmpaquePorLote(loteId),
    ])

    if (!lote) return { error: "Lote no encontrado" }
    if (!conteo || !conteo.validado) return { error: "El conteo no está validado" }

    // Si lo empacado + imperfectos es menor a lo contado, la diferencia
    // debe justificarse antes de finalizar
    const totalRegistrado = registros.reduce(
      (s, r) => s + r.cantidad + (r.imperfectos ?? 0),
      0
    )
    if (totalRegistrado < conteo.total_contado) {
      const falta = conteo.total_contado - totalRegistrado
      if (!justificacion?.trim()) {
        return {
          error: `Se registraron ${totalRegistrado.toLocaleString("es-CO")} unidades (empacadas + imperfectos) de ${conteo.total_contado.toLocaleString("es-CO")} contadas. Debes justificar la diferencia de ${falta.toLocaleString("es-CO")} unidades antes de finalizar.`,
        }
      }
      await updateLoteJustificacionEmpaque(loteId, justificacion)
    }

    await updateLoteEstado(loteId, "finalizado")

    // Si todos los lotes de la OP están finalizados → OP terminada
    const lotesOP = await getLotesByOrden(lote.orden_id)
    const todosFinalizados = lotesOP.every((l) => l.id === loteId || l.estado === "finalizado")
    if (todosFinalizados) {
      await cambiarEstado(lote.orden_id, "terminada")
    }

    revalidatePath(`/empaque/${loteId}`)
    revalidatePath("/empaque")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error finalizando lote" }
  }
}
