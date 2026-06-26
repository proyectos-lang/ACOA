import { createVanessaClient } from "@/lib/supabase/vanessa"

export interface OpTelaLoteRow {
  id: number
  orden_id: number
  slot: 1 | 2 | 3
  color: string
  lote_nombre: string
  capas: number
  creado_por: number | null
  creado_en: string
}

export async function getOpTelaLotes(ordenId: number): Promise<OpTelaLoteRow[]> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("op_tela_lote")
    .select("*")
    .eq("orden_id", ordenId)
    .order("slot")
    .order("color")
    .order("lote_nombre")
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as OpTelaLoteRow[]
}

export async function batchSaveSlotLotes(
  ordenId: number,
  slot: 1 | 2 | 3,
  filas: { color: string; lote_nombre: string; capas: number }[],
  creadoPor: number
): Promise<void> {
  const db = createVanessaClient()

  const { error: delError } = await db
    .from("op_tela_lote")
    .delete()
    .eq("orden_id", ordenId)
    .eq("slot", slot)
  if (delError) throw new Error(delError.message)

  if (filas.length === 0) return

  const rows = filas.map((f) => ({
    orden_id: ordenId,
    slot,
    color: f.color,
    lote_nombre: f.lote_nombre,
    capas: f.capas,
    creado_por: creadoPor,
  }))

  const { error } = await db
    .from("op_tela_lote")
    .upsert(rows, { onConflict: "orden_id,slot,color,lote_nombre" })
  if (error) throw new Error(error.message)
}
