import { createVanessaClient } from "@/lib/supabase/vanessa"

export interface OpTelaRow {
  id: number
  orden_id: number
  slot: 1 | 2 | 3
  fila: number
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
    .order("id")
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as OpTelaRow[]
}

// Inserta las filas de color del slot (el slot ya debe estar limpio con
// deleteOpTela). Los colores pueden repetirse: la identidad es `fila`.
export async function insertOpTelas(
  ordenId: number,
  slot: 1 | 2 | 3,
  tipoTela: string | null,
  colores: string[],
  creadoPor: number
): Promise<void> {
  if (colores.length === 0) return
  const db = createVanessaClient()
  const rows = colores.map((color, i) => ({
    orden_id: ordenId,
    slot,
    fila: i,
    tipo_tela: tipoTela || null,
    color,
    creado_por: creadoPor,
  }))
  const { error } = await db.from("op_tela").insert(rows)
  if (error) throw new Error(error.message)
}

export async function deleteOpTelaColor(
  ordenId: number,
  slot: 1 | 2 | 3,
  color: string
): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db
    .from("op_tela")
    .delete()
    .eq("orden_id", ordenId)
    .eq("slot", slot)
    .eq("color", color)
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
