"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import {
  getCorteConTelas,
  upsertCorte,
  updateCorteTela,
  setCortePendiente,
} from "@/lib/db/corte"
import {
  getLotesByOrden,
  createLoteDesdeOP,
  updateLoteEstado,
  upsertLoteDesdeGrid,
} from "@/lib/db/lote"
import {
  batchSaveCorteCapasReales,
  type CorteCapaRealInput,
} from "@/lib/db/corte-capas"
import { cambiarEstado, updateOrden, getOrdenById } from "@/lib/db/orden-produccion"
import { batchReplaceCurvaTallas, getCurvaTallas } from "@/lib/db/curva-talla"
import { updateOpMaterial, sumValorPorPrenda } from "@/lib/db/op-material"
import { getHojaCostos, updateHojaCostos, VALORES_FIJOS } from "@/lib/db/hoja-costos"

type ActionResult = { error?: string; success?: boolean }

// ── Info general del corte ────────────────────────────────────────────────────

export async function guardarInfoCorteAction(
  ordenId: number,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await upsertCorte({
      orden_id: ordenId,
      fecha_programacion: (formData.get("fecha_programacion") as string) || null,
      fecha_corte: (formData.get("fecha_corte") as string) || null,
      descripcion_piezas: (formData.get("descripcion_piezas") as string)?.trim() || null,
      creado_por: session.userId,
    })
    revalidatePath(`/corte/${ordenId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error guardando información de corte" }
  }
}

// ── Ficha de tela individual ─────────────────────────────────────────────────

export async function guardarCortetelaAction(
  cortetelaId: number,
  ordenId: number,
  input: {
    nombre_tela: string
    ancho_tela: number | null
    rendimiento: number | null
    largo_trazo: number | null
    capas: number | null
  }
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await updateCorteTela(cortetelaId, input)
    revalidatePath(`/corte/${ordenId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error guardando ficha de tela" }
  }
}

// ── Curva de tallas ───────────────────────────────────────────────────────────

export async function actualizarCurvaAction(
  ordenId: number,
  tallas: string[]
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await batchReplaceCurvaTallas(ordenId, tallas, session.userId)
    revalidatePath(`/corte/${ordenId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error actualizando curva" }
  }
}

// ── Aplicar consumo real por tela ─────────────────────────────────────────────

export async function aplicarConsumoRealAction(
  ordenId: number
): Promise<ActionResult & { resumen?: Array<{ nombre: string; promedio: number }> }> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const corte = await getCorteConTelas(ordenId)
    if (!corte) return { error: "No existe ficha de corte para esta OP" }

    const telas = corte.corte_tela.filter(
      (ct) => ct.promedio_consumo != null && ct.promedio_consumo > 0
    )
    if (telas.length === 0) {
      return { error: "Ninguna ficha de tela tiene promedio de consumo calculado. Guarde al menos un largo de trazo y número de capas." }
    }

    const resumen: Array<{ nombre: string; promedio: number }> = []
    for (const tela of telas) {
      await updateOpMaterial(tela.op_material_id, {
        consumo_real: Number(tela.promedio_consumo),
      })
      resumen.push({
        nombre: tela.nombre_tela,
        promedio: Number(tela.promedio_consumo),
      })
    }

    // Recalcular hoja de costos
    const costo_materiales = await sumValorPorPrenda(ordenId)
    const hoja = await getHojaCostos(ordenId)
    if (hoja) {
      const sumaFijos = VALORES_FIJOS.reduce(
        (s, { key }) => s + Number(hoja[key as keyof typeof hoja] ?? 0),
        0
      )
      await updateHojaCostos(ordenId, {
        costo_materiales: Math.round(costo_materiales * 10000) / 10000,
        costo_unitario: Math.round((costo_materiales + sumaFijos) * 10000) / 10000,
      })
    }

    revalidatePath(`/corte/${ordenId}`)
    return { success: true, resumen }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error aplicando consumo real" }
  }
}

// ── Enviar a estampación ──────────────────────────────────────────────────────

export async function enviarAEstampacionAction(ordenId: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const corte = await getCorteConTelas(ordenId)
    if (!corte) return { error: "No existe ficha de corte. Guarde la información de corte primero." }

    const sinLargo = corte.corte_tela.filter((ct) => !ct.largo_trazo || ct.largo_trazo <= 0)
    if (sinLargo.length > 0) {
      return {
        error: `Fichas incompletas: ${sinLargo.map((ct) => ct.nombre_tela).join(", ")}. Ingrese el largo de trazo en todas las telas.`,
      }
    }

    const sinConsumo = corte.corte_tela.filter((ct) => ct.op_material?.consumo_real == null)
    if (sinConsumo.length > 0) {
      return { error: "Aplique el consumo real antes de enviar a estampación." }
    }

    const existentes = await getLotesByOrden(ordenId)
    if (existentes.length === 0) {
      const [curva, orden] = await Promise.all([
        getCurvaTallas(ordenId),
        getOrdenById(ordenId),
      ])
      if (curva.length === 0) {
        return { error: "No hay curva de tallas registrada. Agregue tallas antes de enviar a estampación." }
      }
      const totalUnidades = curva.length * (orden?.capas ?? 1)
      await createLoteDesdeOP({ orden_id: ordenId, cantidad_programada: totalUnidades }, session.userId)
    } else {
      for (const l of existentes.filter((l) => l.estado === "cortado")) {
        await updateLoteEstado(l.id, "estampacion")
      }
    }

    await cambiarEstado(ordenId, "estampacion")
    revalidatePath(`/corte/${ordenId}`)
    revalidatePath("/corte")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error enviando a estampación" }
  }
}

// ── Pendiente por falta de materiales ────────────────────────────────────────

export async function marcarCortePendienteAction(
  ordenId: number,
  pendiente: boolean,
  motivo: string
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  if (pendiente && !motivo.trim()) {
    return { error: "Describe qué materiales faltaron" }
  }

  try {
    await setCortePendiente(ordenId, pendiente, motivo.trim() || null)
    revalidatePath(`/corte/${ordenId}`)
    revalidatePath("/corte")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error actualizando el pendiente" }
  }
}

// ── Confirmar capas reales cortadas ──────────────────────────────────────────

export async function confirmarCorteAction(
  ordenId: number,
  filas: CorteCapaRealInput[],
  tallasCount: number
): Promise<ActionResult & { destino?: string }> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  // Toda modificación respecto a lo programado exige comentario
  const sinComentario = filas.filter(
    (f) => f.capas_reales !== f.capas_programadas && !(f.comentario ?? "").trim()
  )
  if (sinComentario.length > 0) {
    const d = sinComentario[0]
    return {
      error: `Falta el comentario del cambio en [${d.color} × ${d.lote_nombre}] (Material ${d.slot}): programado ${d.capas_programadas}, cortado ${d.capas_reales}`,
    }
  }

  try {
    // 1. Guardar las capas reales confirmadas
    await batchSaveCorteCapasReales(ordenId, filas, session.userId)

    // 2. Recalcular la cantidad real de prendas por lote con las capas REALES
    // de Material 1 (fallback al slot más bajo del lote)
    const nombresLote = [...new Set(filas.map((f) => f.lote_nombre))]
    for (const nombre of nombresLote) {
      let filasLote = filas.filter((f) => f.lote_nombre === nombre && f.slot === 1)
      if (filasLote.length === 0) {
        const delNombre = filas.filter((f) => f.lote_nombre === nombre)
        const slotMin = Math.min(...delNombre.map((f) => f.slot))
        filasLote = delNombre.filter((f) => f.slot === slotMin)
      }
      const capasReales = filasLote.reduce((s, f) => s + f.capas_reales, 0)
      await upsertLoteDesdeGrid(ordenId, nombre, capasReales * tallasCount, session.userId)
    }

    // 3. Avanzar los lotes y la OP: a Estampación, o directo a Costura si la
    // OP no pasa por estampación
    const orden = await getOrdenById(ordenId)
    const destino = orden?.pasa_estampacion === false ? "confeccion" : "estampacion"
    const lotes = await getLotesByOrden(ordenId)
    for (const l of lotes.filter((l) => l.estado === "cortado")) {
      await updateLoteEstado(l.id, destino)
    }
    await cambiarEstado(ordenId, destino as "estampacion" | "confeccion")

    revalidatePath(`/corte/${ordenId}`)
    revalidatePath("/corte")
    return { success: true, destino }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error confirmando el corte" }
  }
}

// ── Lotes ─────────────────────────────────────────────────────────────────────

export async function crearLoteAction(input: {
  orden_id: number
  cantidad_programada: number
  descripcion?: string
}): Promise<ActionResult & { loteId?: number }> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const existentes = await getLotesByOrden(input.orden_id)
    const loteId = await createLoteDesdeOP({
      orden_id: input.orden_id,
      cantidad_programada: input.cantidad_programada,
      descripcion: input.descripcion,
    }, session.userId)

    if (existentes.length === 0) {
      await cambiarEstado(input.orden_id, "estampacion")
    }

    revalidatePath(`/corte/${input.orden_id}`)
    return { success: true, loteId }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error creando lote" }
  }
}

export async function enviarLoteAEstampacionAction(
  loteId: number,
  ordenId: number
): Promise<ActionResult & { destino?: string }> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    // Respetar la ruta de la OP: sin estampación → directo a costura
    const orden = await getOrdenById(ordenId)
    const destino = orden?.pasa_estampacion === false ? "confeccion" : "estampacion"
    await updateLoteEstado(loteId, destino)
    revalidatePath(`/corte/${ordenId}`)
    return { success: true, destino }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error enviando lote" }
  }
}
