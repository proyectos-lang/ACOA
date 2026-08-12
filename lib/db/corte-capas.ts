import { createVanessaClient } from "@/lib/supabase/vanessa"

// Capas realmente cortadas por (tela/slot, fila/color, lote).
// Se precargan con la programación (op_tela_lote); si el cortador cambia un
// valor debe registrar un comentario explicando la diferencia.

export interface CorteCapaRealRow {
  id: number
  orden_id: number
  slot: 1 | 2 | 3
  fila: number
  color: string
  lote_nombre: string
  capas_programadas: number
  capas_reales: number
  comentario: string | null
  creado_por: number | null
  creado_en: string
}

export interface CorteCapaRealInput {
  slot: 1 | 2 | 3
  fila: number
  color: string
  lote_nombre: string
  capas_programadas: number
  capas_reales: number
  comentario: string | null
}

export async function getCorteCapasReales(ordenId: number): Promise<CorteCapaRealRow[]> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("corte_capa_real")
    .select("*")
    .eq("orden_id", ordenId)
    .order("id")
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as CorteCapaRealRow[]
}

export async function batchSaveCorteCapasReales(
  ordenId: number,
  filas: CorteCapaRealInput[],
  creadoPor: number
): Promise<void> {
  const db = createVanessaClient()

  const { error: delError } = await db
    .from("corte_capa_real")
    .delete()
    .eq("orden_id", ordenId)
  if (delError) throw new Error(delError.message)

  if (filas.length === 0) return

  const rows = filas.map((f) => ({
    orden_id: ordenId,
    slot: f.slot,
    fila: f.fila,
    color: f.color,
    lote_nombre: f.lote_nombre,
    capas_programadas: f.capas_programadas,
    capas_reales: f.capas_reales,
    comentario: f.comentario,
    creado_por: creadoPor,
  }))

  const { error } = await db.from("corte_capa_real").insert(rows)
  if (error) throw new Error(error.message)
}
