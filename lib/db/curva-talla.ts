import { createVanessaClient } from "@/lib/supabase/vanessa"

export interface CurvaTallaRow {
  id: number
  orden_id: number
  talla: string
}

export async function getCurvaTallas(ordenId: number): Promise<CurvaTallaRow[]> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("curva_talla")
    .select("id, orden_id, talla")
    .eq("orden_id", ordenId)
    .order("talla")
  if (error) throw new Error(error.message)
  return (data ?? []) as CurvaTallaRow[]
}

export async function batchReplaceCurvaTallas(
  ordenId: number,
  tallas: string[],
  creadoPor: number
): Promise<void> {
  const db = createVanessaClient()

  const { error: delError } = await db
    .from("curva_talla")
    .delete()
    .eq("orden_id", ordenId)
  if (delError) throw new Error(delError.message)

  if (tallas.length === 0) return

  const rows = tallas.map((talla) => ({
    orden_id: ordenId,
    talla: talla.trim(),
    creado_por: creadoPor,
  }))

  const { error: insError } = await db.from("curva_talla").insert(rows)
  if (insError) throw new Error(insError.message)
}
