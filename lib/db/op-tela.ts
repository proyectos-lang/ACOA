import { createVanessaClient } from "@/lib/supabase/vanessa"

export interface OpTelaRow {
  id: number
  orden_id: number
  slot: 1 | 2 | 3
  tipo_tela: string | null
  color: string | null
  creado_por: number | null
  creado_en: string
  actualizado_en: string
}

export async function getOpTelas(ordenId: number): Promise<OpTelaRow[]> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("op_tela")
    .select("*")
    .eq("orden_id", ordenId)
    .order("slot")
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as OpTelaRow[]
}

export async function upsertOpTela(input: {
  orden_id: number
  slot: 1 | 2 | 3
  tipo_tela: string | null
  color: string | null
  creado_por: number
}): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db
    .from("op_tela")
    .upsert(
      {
        orden_id: input.orden_id,
        slot: input.slot,
        tipo_tela: input.tipo_tela || null,
        color: input.color || null,
        creado_por: input.creado_por,
      },
      { onConflict: "orden_id,slot" }
    )
  if (error) throw new Error(error.message)
}

export async function deleteOpTela(ordenId: number, slot: 1 | 2 | 3): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db
    .from("op_tela")
    .delete()
    .eq("orden_id", ordenId)
    .eq("slot", slot)
  if (error) throw new Error(error.message)
}
