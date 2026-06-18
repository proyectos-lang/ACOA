import { createVanessaClient } from "@/lib/supabase/vanessa"

export interface EstampacionRow {
  id: number
  lote_id: number
  nombre_estampador: string | null
  precio_estampacion: number | null
  fecha_entrega_lote: string | null
  fecha_retorno_lote: string | null
  observaciones_estampado: string | null
}

const SELECT_COLS =
  "id, lote_id, nombre_estampador, precio_estampacion, fecha_entrega_lote, fecha_retorno_lote, observaciones_estampado"

export async function getEstampacionByLote(loteId: number): Promise<EstampacionRow | null> {
  const db = createVanessaClient()
  const { data } = await db
    .from("estampacion")
    .select(SELECT_COLS)
    .eq("lote_id", loteId)
    .maybeSingle()
  return data as EstampacionRow | null
}

export async function guardarEstampacion(input: {
  lote_id: number
  nombre_estampador?: string | null
  precio_estampacion?: number | null
  fecha_entrega_lote?: string | null
  fecha_retorno_lote?: string | null
  observaciones_estampado?: string | null
  creado_por: number
}): Promise<void> {
  const db = createVanessaClient()
  const existing = await getEstampacionByLote(input.lote_id)

  const fields = {
    nombre_estampador: input.nombre_estampador ?? null,
    precio_estampacion: input.precio_estampacion ?? null,
    fecha_entrega_lote: input.fecha_entrega_lote ?? null,
    fecha_retorno_lote: input.fecha_retorno_lote ?? null,
    observaciones_estampado: input.observaciones_estampado ?? null,
  }

  if (existing) {
    const { error } = await db.from("estampacion").update(fields).eq("lote_id", input.lote_id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await db
      .from("estampacion")
      .insert({ lote_id: input.lote_id, ...fields, creado_por: input.creado_por })
    if (error) throw new Error(error.message)
  }
}
