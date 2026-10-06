"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import { getEstampacionByLote, upsertEstampacionParcial } from "@/lib/db/estampacion"
import {
  getLoteById,
  getLotesByOrden,
  updateLoteEstado,
  sincronizarEstadoOrdenDesdeLotes,
} from "@/lib/db/lote"
import { getHojaCostos } from "@/lib/db/hoja-costos"
import { cambiarEstado, getOrdenById } from "@/lib/db/orden-produccion"
import {
  listPrendasByLote,
  updatePrenda,
  sincronizarEstadoLoteDesdePrendas,
} from "@/lib/db/lote-prenda"

type ActionResult = { error?: string; success?: boolean; procesados?: number }

function hoyBogota(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
}

// En OPs tipo conjunto las prendas del lote se gestionan por separado: la
// fecha se escribe SOLO en las prendas que aún no tienen la suya, para que
// cada prenda conserve su propia fecha de entrega/estimada/retorno.
// Devuelve true si el lote es de conjunto (ya quedó gestionado por prenda).
async function aplicarFechaPorPrenda(
  loteId: number,
  campo: "est_fecha_entrega" | "est_fecha_estimada" | "est_fecha_retorno",
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

// Igual que la fecha: las unidades recibidas se escriben solo en las
// piezas que aun no las tienen. Devuelve true si el lote tiene piezas.
async function aplicarCantidadPorPrenda(loteId: number, cantidad: number): Promise<boolean> {
  const prendas = await listPrendasByLote(loteId)
  if (prendas.length === 0) return false
  for (const p of prendas) {
    if (p.est_cantidad_recibida != null) continue
    await updatePrenda(p.id, { est_cantidad_recibida: cantidad })
  }
  return true
}

// Asignación masiva: estampador + fecha de entrega (hoy) + precio automático
// desde el costo de estampación de la hoja de costos de la OP
export async function asignarEstampadorMasivoAction(
  loteIds: number[],
  nombreEstampador: string
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  if (!nombreEstampador.trim()) return { error: "Selecciona un estampador" }
  if (loteIds.length === 0) return { error: "Selecciona al menos un lote" }

  try {
    const precioPorOrden = new Map<number, number | null>()
    let procesados = 0

    for (const loteId of loteIds) {
      const lote = await getLoteById(loteId)
      if (!lote) continue

      // Costo de estampación definido en la OP (hoja de costos), cacheado por orden
      if (!precioPorOrden.has(lote.orden_id)) {
        const hoja = await getHojaCostos(lote.orden_id)
        const v = Number(hoja?.valor_estampacion_aplique_dtf) || 0
        precioPorOrden.set(lote.orden_id, v > 0 ? v : null)
      }
      const precioOP = precioPorOrden.get(lote.orden_id) ?? null

      const actual = await getEstampacionByLote(loteId)
      await upsertEstampacionParcial(
        loteId,
        {
          nombre_estampador: nombreEstampador.trim(),
          // La fecha de entrega y el precio no pisan valores ya registrados
          ...(actual?.fecha_entrega_lote ? {} : { fecha_entrega_lote: hoyBogota() }),
          ...(actual?.precio_estampacion != null && Number(actual.precio_estampacion) > 0
            ? {}
            : precioOP != null
              ? { precio_estampacion: precioOP }
              : {}),
        },
        session.userId
      )
      procesados++
    }

    revalidatePath("/estampacion")
    return { success: true, procesados }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error en la asignación masiva" }
  }
}

// Marca la fecha de entrega al estampador en todos los lotes seleccionados
export async function marcarEntregaMasivaAction(
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
      const porPrenda = await aplicarFechaPorPrenda(loteId, "est_fecha_entrega", fecha, true)
      if (!porPrenda) {
        await upsertEstampacionParcial(loteId, { fecha_entrega_lote: fecha }, session.userId)
      }
      procesados++
    }
    revalidatePath("/estampacion")
    return { success: true, procesados }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error marcando la fecha de entrega" }
  }
}

// Marca la fecha estimada de entrega (devolución del estampador) en los
// lotes seleccionados; alimenta las alertas de vencimiento del listado
export async function marcarFechaEstimadaMasivaAction(
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
      const porPrenda = await aplicarFechaPorPrenda(loteId, "est_fecha_estimada", fecha, true)
      if (!porPrenda) {
        await upsertEstampacionParcial(loteId, { fecha_estimada_entrega: fecha }, session.userId)
      }
      procesados++
    }
    revalidatePath("/estampacion")
    return { success: true, procesados }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error marcando la fecha estimada" }
  }
}

// Recepción masiva: fecha de retorno (hoy) y unidades recibidas por lote, y
// pase a Confección. La cantidad la confirma el usuario lote por lote (viene
// precargada con lo enviado); en los conjuntos se escribe en cada pieza que
// aun no la tenga y las piezas avanzan junto con el lote.
export async function recepcionMasivaAction(
  items: Array<{ loteId: number; cantidad: number }>
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  if (items.length === 0) return { error: "Selecciona al menos un lote" }
  if (items.some((i) => !Number.isFinite(i.cantidad) || i.cantidad < 0)) {
    return { error: "Las unidades recibidas deben ser un número mayor o igual a 0" }
  }

  try {
    const ordenesAfectadas = new Set<number>()
    let procesados = 0
    const hoy = hoyBogota()

    for (const { loteId, cantidad } of items) {
      const lote = await getLoteById(loteId)
      if (!lote || lote.estado !== "estampacion") continue

      const esConjunto = await aplicarFechaPorPrenda(loteId, "est_fecha_retorno", hoy, true)
      if (esConjunto) {
        await aplicarCantidadPorPrenda(loteId, cantidad)
        const prendas = await listPrendasByLote(loteId)
        for (const p of prendas.filter((p) => p.estado === "estampacion")) {
          await updatePrenda(p.id, { estado: "confeccion" })
        }
        await sincronizarEstadoLoteDesdePrendas(loteId)
      } else {
        const actual = await getEstampacionByLote(loteId)
        await upsertEstampacionParcial(
          loteId,
          {
            ...(actual?.fecha_retorno_lote ? {} : { fecha_retorno_lote: hoy }),
            ...(actual?.cantidad_recibida != null ? {} : { cantidad_recibida: cantidad }),
          },
          session.userId
        )
        await updateLoteEstado(loteId, "confeccion")
      }
      ordenesAfectadas.add(lote.orden_id)
      procesados++
    }

    for (const ordenId of ordenesAfectadas) await sincronizarEstadoOrdenDesdeLotes(ordenId)

    revalidatePath("/estampacion")
    revalidatePath("/confeccion")
    return { success: true, procesados }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error en la recepción masiva" }
  }
}
