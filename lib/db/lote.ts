import { createVanessaClient } from "@/lib/supabase/vanessa"

export interface LoteRow {
  id: number
  corte_id: number | null
  orden_id: number
  numero_lote: number
  descripcion: string | null
  color: string | null
  cantidad_programada: number
  precio_empaque_unidad: number
  estado: string
}

export const LOTE_ESTADO_LABEL: Record<string, string> = {
  cortado:     "Cortado",
  estampacion: "Estampación",
  confeccion:  "Confección",
  conteo:      "Conteo",
  empaque:     "Empaque",
  completado:  "Completado",
  finalizado:  "Finalizado",
}

export const LOTE_ESTADO_COLOR: Record<string, string> = {
  cortado:     "bg-stone-100 text-stone-700",
  estampacion: "bg-pink-100 text-pink-800",
  confeccion:  "bg-teal-100 text-teal-800",
  conteo:      "bg-yellow-100 text-yellow-800",
  empaque:     "bg-green-100 text-green-800",
  completado:  "bg-stone-100 text-stone-500",
  finalizado:  "bg-emerald-100 text-emerald-800",
}

const SELECT_COLS =
  "id, corte_id, orden_id, numero_lote, descripcion, color, cantidad_programada, precio_empaque_unidad, estado"

export async function getLotesByOrden(ordenId: number): Promise<LoteRow[]> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("lote")
    .select(SELECT_COLS)
    .eq("orden_id", ordenId)
    .order("numero_lote")
  if (error) throw new Error(error.message)
  return (data ?? []) as LoteRow[]
}

export async function getLoteById(id: number): Promise<LoteRow | null> {
  const db = createVanessaClient()
  const { data } = await db.from("lote").select(SELECT_COLS).eq("id", id).maybeSingle()
  return data as LoteRow | null
}

export async function createLote(input: {
  corte_id: number | null
  orden_id: number
  descripcion?: string | null
  color?: string | null
  cantidad_programada: number
  precio_empaque_unidad?: number
  estado?: string
  creado_por: number
}): Promise<number> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("lote")
    .insert({
      corte_id: input.corte_id,
      orden_id: input.orden_id,
      descripcion: input.descripcion ?? null,
      color: input.color ?? null,
      cantidad_programada: input.cantidad_programada,
      precio_empaque_unidad: input.precio_empaque_unidad ?? 0,
      estado: input.estado ?? "cortado",
      creado_por: input.creado_por,
    })
    .select("id")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Error creando lote")
  return data.id
}

export async function createLoteDesdeOP(
  input: { orden_id: number; cantidad_programada?: number; descripcion?: string },
  creadoPor: number
): Promise<number> {
  return createLote({
    corte_id: null,
    orden_id: input.orden_id,
    descripcion: input.descripcion ?? null,
    color: null,
    cantidad_programada: input.cantidad_programada ?? 0,
    estado: "cortado",
    creado_por: creadoPor,
  })
}

export async function upsertLoteDesdeGrid(
  ordenId: number,
  loteNombre: string,
  cantidadProgramada: number,
  creadoPor: number
): Promise<void> {
  const db = createVanessaClient()
  const { data: existing } = await db
    .from("lote")
    .select("id, estado")
    .eq("orden_id", ordenId)
    .eq("descripcion", loteNombre)
    .maybeSingle()

  if (existing) {
    if ((existing as { id: number; estado: string }).estado === "cortado") {
      const { error } = await db
        .from("lote")
        .update({ cantidad_programada: cantidadProgramada })
        .eq("id", (existing as { id: number; estado: string }).id)
      if (error) throw new Error(error.message)
    }
    // Si ya está en producción (estado != cortado), no modificar
  } else {
    await createLoteDesdeOP(
      { orden_id: ordenId, descripcion: loteNombre, cantidad_programada: cantidadProgramada },
      creadoPor
    )
  }
}

export async function updateLoteEstado(id: number, estado: string): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("lote").update({ estado }).eq("id", id)
  if (error) throw new Error(error.message)
}

export type LoteConInfo = LoteRow & {
  orden: { numero_op: number; referencia: string; gama_color: string | null }
  estampacion: { nombre_estampador: string | null; fecha_entrega_lote: string | null } | null
}

export async function getLotesEnEstampacion(): Promise<LoteConInfo[]> {
  const db = createVanessaClient()
  const { data: lotes, error } = await db
    .from("lote")
    .select(SELECT_COLS)
    .eq("estado", "estampacion")
    .order("numero_lote", { ascending: false })
  if (error) throw new Error(error.message)
  if (!lotes?.length) return []

  const rows = lotes as LoteRow[]

  const ordenIds = [...new Set(rows.map((l) => l.orden_id))]
  const loteIds = rows.map((l) => l.id)

  const [{ data: ops }, { data: estampaciones }] = await Promise.all([
    db
      .from("orden_produccion")
      .select("id, numero_op, referencia, gama_color")
      .in("id", ordenIds),
    db
      .from("estampacion")
      .select("lote_id, nombre_estampador, fecha_entrega_lote")
      .in("lote_id", loteIds),
  ])

  const opMap = new Map(
    ((ops ?? []) as Array<{ id: number; numero_op: number; referencia: string; gama_color: string | null }>).map(
      (o) => [o.id, o]
    )
  )
  const estMap = new Map(
    (
      (estampaciones ?? []) as Array<{
        lote_id: number
        nombre_estampador: string | null
        fecha_entrega_lote: string | null
      }>
    ).map((e) => [e.lote_id, e])
  )

  return rows.map((l) => ({
    ...l,
    orden: opMap.get(l.orden_id) ?? { numero_op: 0, referencia: "—", gama_color: null },
    estampacion: estMap.get(l.id) ?? null,
  }))
}
