import { createVanessaClient } from "@/lib/supabase/vanessa"
import type { OrdenProduccionRow } from "@/lib/db/orden-produccion"

export interface CorteRow {
  id: number
  orden_id: number
  consecutivo_corte: number
  fecha_programacion: string | null
  fecha_corte: string | null
  descripcion_piezas: string | null
}

export interface CorteTela {
  id: number
  corte_id: number
  op_material_id: number
  nombre_tela: string
  ancho_tela: number | null
  rendimiento: number | null
  largo_trazo: number | null
  capas: number | null
  promedio_consumo: number | null
  op_material?: {
    id: number
    nombre: string
    tipo: string
    consumo_estimado: number | null
    consumo_real: number | null
    valor_por_prenda: number
  }
}

export interface CorteConTelas extends CorteRow {
  corte_tela: CorteTela[]
}

const CORTE_SELECT =
  "id, orden_id, consecutivo_corte, fecha_programacion, fecha_corte, descripcion_piezas"

const TELA_EMBED =
  "corte_tela!fk_cortetela_corte(id, corte_id, op_material_id, nombre_tela, ancho_tela, rendimiento, largo_trazo, capas, promedio_consumo, op_material!fk_cortetela_opmaterial(id, nombre, tipo, consumo_estimado, consumo_real, valor_por_prenda))"

export async function getCorteByOrden(ordenId: number): Promise<CorteRow | null> {
  const db = createVanessaClient()
  const { data } = await db
    .from("corte")
    .select(CORTE_SELECT)
    .eq("orden_id", ordenId)
    .maybeSingle()
  return data as CorteRow | null
}

export async function getCorteConTelas(ordenId: number): Promise<CorteConTelas | null> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("corte")
    .select(`${CORTE_SELECT}, ${TELA_EMBED}`)
    .eq("orden_id", ordenId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as unknown as CorteConTelas | null
}

export async function upsertCorte(input: {
  orden_id: number
  fecha_programacion?: string | null
  fecha_corte?: string | null
  descripcion_piezas?: string | null
  creado_por: number
}): Promise<number> {
  const db = createVanessaClient()
  const existing = await getCorteByOrden(input.orden_id)

  const fields = {
    fecha_programacion: input.fecha_programacion ?? null,
    fecha_corte: input.fecha_corte ?? null,
    descripcion_piezas: input.descripcion_piezas ?? null,
  }

  if (existing) {
    const { error } = await db.from("corte").update(fields).eq("orden_id", input.orden_id)
    if (error) throw new Error(error.message)
    return existing.id
  } else {
    const { data, error } = await db
      .from("corte")
      .insert({ orden_id: input.orden_id, ...fields, creado_por: input.creado_por })
      .select("id")
      .single()
    if (error || !data) throw new Error(error?.message ?? "Error creando corte")
    return (data as { id: number }).id
  }
}

export async function ensureCorteTelas(
  corteId: number,
  telaMateriales: Array<{ id: number; nombre: string }>,
  userId: number
): Promise<void> {
  if (telaMateriales.length === 0) return
  const db = createVanessaClient()

  const { data: existing } = await db
    .from("corte_tela")
    .select("op_material_id")
    .eq("corte_id", corteId)

  const existingIds = new Set(
    ((existing ?? []) as { op_material_id: number }[]).map((r) => r.op_material_id)
  )
  const nuevas = telaMateriales.filter((m) => !existingIds.has(m.id))
  if (nuevas.length === 0) return

  const { error } = await db.from("corte_tela").insert(
    nuevas.map((m) => ({
      corte_id: corteId,
      op_material_id: m.id,
      nombre_tela: m.nombre,
      creado_por: userId,
    }))
  )
  if (error) throw new Error(error.message)
}

export async function updateCorteTela(
  id: number,
  input: {
    nombre_tela?: string
    ancho_tela?: number | null
    rendimiento?: number | null
    largo_trazo?: number | null
    capas?: number | null
  }
): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("corte_tela").update(input).eq("id", id)
  if (error) throw new Error(error.message)
}

export async function listOPsEnCorte(): Promise<
  (OrdenProduccionRow & { corte: CorteRow | null })[]
> {
  const db = createVanessaClient()
  const { data: ops, error } = await db
    .from("orden_produccion")
    .select(
      "id, numero_op, fecha_programacion, referencia, descripcion, url_molde, gama_color, observaciones, estado, creado_por, creado_en"
    )
    .eq("estado", "corte")
    .order("numero_op", { ascending: false })
  if (error) throw new Error(error.message)
  if (!ops?.length) return []

  const ordenIds = (ops as { id: number }[]).map((o) => o.id)
  const { data: cortes } = await db
    .from("corte")
    .select(CORTE_SELECT)
    .in("orden_id", ordenIds)

  const corteMap = new Map(((cortes ?? []) as CorteRow[]).map((c) => [c.orden_id, c]))
  return (ops as OrdenProduccionRow[]).map((op) => ({
    ...op,
    corte: corteMap.get(op.id) ?? null,
  }))
}
