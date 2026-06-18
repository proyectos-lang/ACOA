"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import {
  createEmpaqueRegistro,
  deleteEmpaqueRegistro,
  getEmpaquePorLote,
} from "@/lib/db/empaque-registro"
import { getConteoByLote, getConteoDetalle } from "@/lib/db/conteo"
import { getLoteById, getLotesByOrden, updateLoteEstado } from "@/lib/db/lote"
import { cambiarEstado } from "@/lib/db/orden-produccion"

type ActionResult = { error?: string; success?: boolean }

export async function crearEmpaqueRegistroAction(input: {
  lote_id: number
  persona_id: number
  color: string
  talla: string
  cantidad: number
  fecha?: string
}): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  if (input.cantidad <= 0) return { error: "La cantidad debe ser mayor a 0" }

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

    const filaTalla = detalle.find(
      (d) => d.color === input.color && d.talla === input.talla
    )
    if (!filaTalla) {
      return { error: `No existe conteo para color "${input.color}" talla "${input.talla}"` }
    }

    const yaEmpacado = registros
      .filter((r) => r.color === input.color && r.talla === input.talla)
      .reduce((s, r) => s + r.cantidad, 0)

    if (yaEmpacado + input.cantidad > filaTalla.cantidad_contada) {
      const disponible = filaTalla.cantidad_contada - yaEmpacado
      return {
        error: `Excede el conteo: disponible ${disponible} ud. para ${input.color} / ${input.talla}`,
      }
    }

    // Precio snapshot del lote
    const lote = await getLoteById(input.lote_id)
    if (!lote) return { error: "Lote no encontrado" }

    const fechaHoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })

    await createEmpaqueRegistro({
      lote_id: input.lote_id,
      persona_id: input.persona_id,
      color: input.color,
      talla: input.talla,
      cantidad: input.cantidad,
      precio_unidad: lote.precio_empaque_unidad,
      fecha: input.fecha || fechaHoy,
      creado_por: session.userId,
    })

    revalidatePath(`/empaque/${input.lote_id}`)
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
    await deleteEmpaqueRegistro(registroId)
    revalidatePath(`/empaque/${loteId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error eliminando registro" }
  }
}

export async function finalizarLoteAction(loteId: number): Promise<ActionResult> {
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

    const totalEmpacado = registros.reduce((s, r) => s + r.cantidad, 0)
    if (totalEmpacado < conteo.total_contado) {
      const falta = conteo.total_contado - totalEmpacado
      return { error: `Faltan ${falta} unidades por empacar (conteo: ${conteo.total_contado})` }
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
