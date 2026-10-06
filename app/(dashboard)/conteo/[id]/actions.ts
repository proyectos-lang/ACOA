"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import {
  upsertConteo,
  replaceConteoDetalle,
  validarConteo,
  type ConteoDetalleInput,
} from "@/lib/db/conteo"
import { getLoteById, updateLoteEstado, sincronizarEstadoOrdenDesdeLotes } from "@/lib/db/lote"
import { getOrdenById } from "@/lib/db/orden-produccion"
import {
  listPrendasByLote,
  updatePrenda,
  sincronizarEstadoLoteDesdePrendas,
  PRENDA_ESTADO_LABEL,
} from "@/lib/db/lote-prenda"
import { habilitarPagoConfeccionPorConteo } from "@/lib/db/pago"

type ActionResult = {
  error?: string
  success?: boolean
  total_contado?: number
  pagos_habilitados?: number
}

export async function guardarConteoAction(
  loteId: number,
  formData: FormData,
  filas: ConteoDetalleInput[]
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const conteoId = await upsertConteo({
      lote_id: loteId,
      fecha_conteo: (formData.get("fecha_conteo") as string) || null,
      observacion: (formData.get("observacion") as string)?.trim() || null,
      creado_por: session.userId,
    })

    const total = await replaceConteoDetalle(conteoId, filas, session.userId)
    revalidatePath(`/conteo/${loteId}`)
    return { success: true, total_contado: total }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error guardando conteo" }
  }
}

// Valida el conteo y manda el lote a empaque. En los conjuntos se valida
// pieza por pieza: todas deben haber llegado a conteo y tener cantidades, y
// cualquier faltante frente a lo programado se justifica. Al validar, las
// piezas quedan completadas y el lote pasa a empaque por derivacion.
export async function validarConteoAction(
  loteId: number,
  formData: FormData,
  filas: ConteoDetalleInput[],
  justificacion?: string
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const lote = await getLoteById(loteId)
    if (!lote) return { error: "Lote no encontrado" }
    const orden = await getOrdenById(lote.orden_id)
    const esConjunto = orden?.tipo_prenda === "conjunto"

    const prendas = esConjunto ? await listPrendasByLote(loteId) : []
    if (esConjunto) {
      if (prendas.length === 0) return { error: "El lote no tiene piezas registradas" }
      const sinLlegar = prendas.filter(
        (p) => p.estado === "estampacion" || p.estado === "confeccion"
      )
      if (sinLlegar.length > 0) {
        return {
          error: `Aún no han llegado a conteo: ${sinLlegar
            .map((p) => `"${p.nombre}" (${PRENDA_ESTADO_LABEL[p.estado]})`)
            .join(", ")}. El lote se valida cuando estén todas sus piezas.`,
        }
      }
    }

    // Guardar conteo primero (garantiza que la fila existe antes de validar)
    const fechaHoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
    const conteoId = await upsertConteo({
      lote_id: loteId,
      fecha_conteo: (formData.get("fecha_conteo") as string) || fechaHoy,
      observacion: (formData.get("observacion") as string)?.trim() || null,
      creado_por: session.userId,
    })
    const total = await replaceConteoDetalle(conteoId, filas, session.userId)

    if (total === 0) {
      return { error: "El total contado es 0. Ingrese las cantidades antes de validar." }
    }

    // Faltantes frente a lo programado, por pieza (o del lote entero).
    // Cada pieza de un conjunto lleva las mismas unidades que el lote.
    const grupos: Array<{ id: number | null; nombre: string }> = esConjunto
      ? prendas.map((p) => ({ id: p.id, nombre: p.nombre }))
      : [{ id: null, nombre: "el lote" }]
    const faltantes: string[] = []
    for (const g of grupos) {
      const delGrupo = filas.filter((f) => (f.prenda_id ?? null) === g.id)
      const contadas = delGrupo.reduce((s, f) => s + (f.cantidad_contada || 0), 0)
      const imperfectos = delGrupo.reduce((s, f) => s + (f.imperfectos || 0), 0)
      if (esConjunto && contadas === 0) {
        return { error: `La pieza "${g.nombre}" no tiene cantidades registradas` }
      }
      const registrado = contadas + imperfectos
      if (registrado < lote.cantidad_programada) {
        faltantes.push(
          `${g.nombre}: ${registrado.toLocaleString("es-CO")} de ${lote.cantidad_programada.toLocaleString("es-CO")}`
        )
      }
    }
    if (faltantes.length > 0 && !justificacion?.trim()) {
      return {
        error: `Se registraron menos unidades (contadas + imperfectos) de las programadas — ${faltantes.join("; ")}. Debes justificar la diferencia antes de validar.`,
      }
    }

    await validarConteo(loteId, faltantes.length > 0 ? justificacion : null)

    if (esConjunto) {
      for (const p of prendas) await updatePrenda(p.id, { estado: "completado" })
      await sincronizarEstadoLoteDesdePrendas(loteId)
    } else {
      await updateLoteEstado(loteId, "empaque")
    }
    await sincronizarEstadoOrdenDesdeLotes(lote.orden_id)

    // Al cerrar el conteo se habilita automáticamente el pago al
    // confeccionista con las cantidades contadas efectivas (no bloquea
    // la validación si faltan datos de confección)
    let pagosHabilitados = 0
    try {
      pagosHabilitados = await habilitarPagoConfeccionPorConteo(loteId, session.userId)
    } catch {
      pagosHabilitados = 0
    }

    revalidatePath(`/conteo/${loteId}`)
    revalidatePath("/conteo")
    revalidatePath("/empaque")
    revalidatePath("/pagos")
    revalidatePath("/trazabilidad")
    return { success: true, total_contado: total, pagos_habilitados: pagosHabilitados }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error validando conteo" }
  }
}
