import { createVanessaClient } from "@/lib/supabase/vanessa"
import { upsertEstampacionParcial } from "@/lib/db/estampacion"
import { upsertConfeccionParcial } from "@/lib/db/confeccion"

// Prendas de un conjunto dentro de un lote (OPs tipo "conjunto").
// Cada prenda avanza por estampación → confección → conteo → completado
// con su propio estampador, confeccionista, fechas y conteo.

export type PrendaEstado = "estampacion" | "confeccion" | "conteo" | "completado"

export interface LotePrendaRow {
  id: number
  lote_id: number
  nombre: string
  estado: PrendaEstado
  nombre_estampador: string | null
  est_precio: number | null
  est_dias_entrega: number | null
  est_fecha_entrega: string | null
  est_fecha_estimada: string | null
  est_fecha_retorno: string | null
  nombre_confeccionista: string | null
  conf_precio: number | null
  conf_dias_entrega: number | null
  conf_fecha_entrega: string | null
  conf_fecha_estimada: string | null
  conf_fecha_retorno: string | null
  cantidad_contada: number | null
  creado_en: string
}

export const PRENDA_ESTADO_LABEL: Record<PrendaEstado, string> = {
  estampacion: "Estampación",
  confeccion: "Confección",
  conteo: "Conteo",
  completado: "Completada",
}

export const PRENDA_ESTADO_COLOR: Record<PrendaEstado, string> = {
  estampacion: "bg-pink-100 text-pink-800",
  confeccion: "bg-teal-100 text-teal-800",
  conteo: "bg-yellow-100 text-yellow-800",
  completado: "bg-emerald-100 text-emerald-800",
}

const SELECT_COLS =
  "id, lote_id, nombre, estado, nombre_estampador, est_precio, est_dias_entrega, est_fecha_entrega, est_fecha_estimada, est_fecha_retorno, nombre_confeccionista, conf_precio, conf_dias_entrega, conf_fecha_entrega, conf_fecha_estimada, conf_fecha_retorno, cantidad_contada, creado_en"

export async function listPrendasByLote(loteId: number): Promise<LotePrendaRow[]> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("lote_prenda")
    .select(SELECT_COLS)
    .eq("lote_id", loteId)
    .order("id")
  if (error) throw new Error(error.message)
  return (data ?? []) as LotePrendaRow[]
}

export async function createPrenda(
  loteId: number,
  nombre: string,
  estadoInicial: PrendaEstado,
  creadoPor: number
): Promise<number> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("lote_prenda")
    .insert({ lote_id: loteId, nombre: nombre.trim(), estado: estadoInicial, creado_por: creadoPor })
    .select("id")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Error creando prenda")
  return data.id
}

export async function updatePrenda(
  id: number,
  campos: Partial<
    Omit<LotePrendaRow, "id" | "lote_id" | "creado_en">
  >
): Promise<void> {
  const db = createVanessaClient()
  if (Object.keys(campos).length === 0) return
  const { error } = await db.from("lote_prenda").update(campos).eq("id", id)
  if (error) throw new Error(error.message)
}

export async function deletePrenda(id: number): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("lote_prenda").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

// Piezas por defecto de un conjunto: al llegar a estampación el lote se
// divide automáticamente en Superior e Inferior, y esas piezas se arrastran
// por confección, conteo y empaque con su propia trazabilidad.
export const PIEZAS_CONJUNTO_POR_DEFECTO = ["Superior", "Inferior"] as const

// Garantiza que un lote de una OP tipo conjunto tenga sus piezas creadas.
// Es idempotente: si ya tiene piezas (creadas a mano o antes), no toca nada.
// Devuelve cuántas piezas creó.
export async function asegurarPrendasConjunto(
  loteId: number,
  estadoInicial: PrendaEstado,
  creadoPor: number
): Promise<number> {
  const existentes = await listPrendasByLote(loteId)
  if (existentes.length > 0) return 0

  const db = createVanessaClient()
  const filas = PIEZAS_CONJUNTO_POR_DEFECTO.map((nombre) => ({
    lote_id: loteId,
    nombre,
    estado: estadoInicial,
    creado_por: creadoPor,
  }))
  const { error } = await db.from("lote_prenda").insert(filas)
  if (error) throw new Error(error.message)
  return filas.length
}

// Divide automáticamente todos los lotes de una OP tipo conjunto que aún no
// tengan piezas. Se llama cuando los lotes entran a estampación.
export async function asegurarPrendasDeOrdenConjunto(
  ordenId: number,
  creadoPor: number
): Promise<number> {
  const db = createVanessaClient()

  const { data: orden } = await db
    .from("orden_produccion")
    .select("id, tipo_prenda")
    .eq("id", ordenId)
    .maybeSingle()
  if (!orden || (orden as { tipo_prenda: string }).tipo_prenda !== "conjunto") return 0

  const { data: lotes } = await db
    .from("lote")
    .select("id, estado")
    .eq("orden_id", ordenId)
  const filas = (lotes ?? []) as Array<{ id: number; estado: string }>

  let creadas = 0
  for (const l of filas) {
    // La pieza arranca en la etapa donde va el lote (estampación en adelante)
    const etapa: PrendaEstado =
      l.estado === "confeccion"
        ? "confeccion"
        : l.estado === "conteo" || l.estado === "empaque" || l.estado === "finalizado"
          ? "conteo"
          : "estampacion"
    creadas += await asegurarPrendasConjunto(l.id, etapa, creadoPor)
  }
  return creadas
}

// El costo de cada prenda viaja al registro del lote: el precio de
// estampación/confección del lote (conjunto) queda registrado como la
// suma de los precios de sus prendas. Se llama tras crear, editar o
// eliminar una prenda.
export async function sincronizarPreciosProcesoLote(
  loteId: number,
  userId: number
): Promise<void> {
  const prendas = await listPrendasByLote(loteId)
  if (prendas.length === 0) return

  const sumEst = prendas.reduce((s, p) => s + (Number(p.est_precio) || 0), 0)
  const sumConf = prendas.reduce((s, p) => s + (Number(p.conf_precio) || 0), 0)

  await Promise.all([
    upsertEstampacionParcial(loteId, { precio_estampacion: sumEst }, userId),
    upsertConfeccionParcial(loteId, { precio_confeccion: sumConf }, userId),
  ])
}
