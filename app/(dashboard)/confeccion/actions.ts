"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import { getConfeccionByLote, upsertConfeccionParcial } from "@/lib/db/confeccion"
import { getLoteById, getLotesByOrden, updateLoteEstado } from "@/lib/db/lote"
import { getHojaCostos } from "@/lib/db/hoja-costos"
import { cambiarEstado, getOrdenById } from "@/lib/db/orden-produccion"
import { listPrendasByLote, updatePrenda } from "@/lib/db/lote-prenda"

type ActionResult = { error?: string; success?: boolean; procesados?: number }

// En OPs tipo conjunto las prendas del lote se gestionan por separado: la
// fecha se escribe SOLO en las prendas que aún no tienen la suya, para que
// cada prenda conserve sus propias fechas.
// Devuelve true si el lote es de conjunto (ya quedó gestionado por prenda).
async function aplicarFechaPorPrenda(
  loteId: number,
  campo: "conf_fecha_entrega" | "conf_fecha_estimada" | "conf_fecha_retorno",
  fecha: string,
  soloVacias: boolean
): Promise<boolean> {
  const lote = await getLoteById(loteId)
  if (!lote) return false
  const orden = await getOrdenById(lote.orden_id)
  if (orden?.tipo_prenda !== "conjunto") return false

  const prendas = await listPrendasByLote(loteId)
  if (prendas.length === 0) return false

  for (const prenda of prendas) {
    if (soloVacias && prenda[campo]) continue
    await updatePrenda(prenda.id, { [campo]: fecha })
  }
  return true
}

function hoyBogota(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
}

// Asignación masiva: confeccionista + fecha de entrega (hoy) + precio
// automático desde el costo de confección de la hoja de costos de la OP
export async function asignarConfeccionistaMasivoAction(
  loteIds: number[],
  nombreConfeccionista: string
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  if (!nombreConfeccionista.trim()) return { error: "Selecciona un confeccionista" }
  if (loteIds.length === 0) return { error: "Selecciona al menos un lote" }

  try {
    const precioPorOrden = new Map<number, number | null>()
    let procesados = 0

    for (const loteId of loteIds) {
      const lote = await getLoteById(loteId)
      if (!lote) continue

      if (!precioPorOrden.has(lote.orden_id)) {
        const hoja = await getHojaCostos(lote.orden_id)
        const v = Number(hoja?.valor_confeccion) || 0
        precioPorOrden.set(lote.orden_id, v > 0 ? v : null)
      }
      const precioOP = precioPorOrden.get(lote.orden_id) ?? null

      const actual = await getConfeccionByLote(loteId)
      await upsertConfeccionParcial(
        loteId,
        {
          nombre_confeccionista: nombreConfeccionista.trim(),
          ...(actual?.fecha_entrega_lote ? {} : { fecha_entrega_lote: hoyBogota() }),
          ...(actual?.precio_confeccion != null && Number(actual.precio_confeccion) > 0
            ? {}
            : precioOP != null
              ? { precio_confeccion: precioOP }
              : {}),
        },
        session.userId
      )
      procesados++
    }

    revalidatePath("/confeccion")
    return { success: true, procesados }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error en la asignación masiva" }
  }
}

// Marca la fecha de entrega al confeccionista en los lotes seleccionados
export async function marcarEntregaConfeccionMasivaAction(
  loteIds: number[],
  fecha: string
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  if (loteIds.length === 0) return { error: "Selecciona al menos un lote" }
  if (!fecha) return { error: "Selecciona la fecha de entrega" }

  try {
    let procesados = 0
    for (const loteId of loteIds) {
      // En conjuntos la entrega se marca por prenda, sin pisar las que ya
      // tienen su propia fecha
      const porPrenda = await aplicarFechaPorPrenda(loteId, "conf_fecha_entrega", fecha, true)
      if (!porPrenda) {
        await upsertConfeccionParcial(loteId, { fecha_entrega_lote: fecha }, session.userId)
      }
      procesados++
    }
    revalidatePath("/confeccion")
    return { success: true, procesados }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error marcando la fecha de entrega" }
  }
}

// Marca la fecha estimada de entrega (devolución del confeccionista)
export async function marcarFechaEstimadaConfeccionMasivaAction(
  loteIds: number[],
  fecha: string
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  if (loteIds.length === 0) return { error: "Selecciona al menos un lote" }
  if (!fecha) return { error: "Selecciona la fecha estimada de entrega" }

  try {
    let procesados = 0
    for (const loteId of loteIds) {
      const porPrenda = await aplicarFechaPorPrenda(loteId, "conf_fecha_estimada", fecha, true)
      if (!porPrenda) {
        await upsertConfeccionParcial(loteId, { fecha_estimada_entrega: fecha }, session.userId)
      }
      procesados++
    }
    revalidatePath("/confeccion")
    return { success: true, procesados }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error marcando la fecha estimada" }
  }
}

// Recepción masiva: fecha de retorno (hoy) y pase a Conteo; la OP avanza
// cuando todos sus lotes ya salieron de confección
export async function recepcionConfeccionMasivaAction(
  loteIds: number[]
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  if (loteIds.length === 0) return { error: "Selecciona al menos un lote" }

  try {
    const ordenesAfectadas = new Set<number>()
    let procesados = 0

    for (const loteId of loteIds) {
      const lote = await getLoteById(loteId)
      if (!lote || lote.estado !== "confeccion") continue

      await aplicarFechaPorPrenda(loteId, "conf_fecha_retorno", hoyBogota(), true)
      const actual = await getConfeccionByLote(loteId)
      await upsertConfeccionParcial(
        loteId,
        actual?.fecha_retorno_lote ? {} : { fecha_retorno_lote: hoyBogota() },
        session.userId
      )
      await updateLoteEstado(loteId, "conteo")
      ordenesAfectadas.add(lote.orden_id)
      procesados++
    }

    for (const ordenId of ordenesAfectadas) {
      const todos = await getLotesByOrden(ordenId)
      const activos = todos.filter((l) => l.estado !== "finalizado" && l.estado !== "completado")
      if (
        activos.length > 0 &&
        activos.every(
          (l) => l.estado !== "confeccion" && l.estado !== "estampacion" && l.estado !== "cortado"
        )
      ) {
        await cambiarEstado(ordenId, "conteo")
      }
    }

    revalidatePath("/confeccion")
    revalidatePath("/conteo")
    return { success: true, procesados }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error en la recepción masiva" }
  }
}
