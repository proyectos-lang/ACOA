import { createVanessaClient } from "@/lib/supabase/vanessa"

export interface OpMaterialRow {
  id: number
  orden_id: number
  material_id: number | null
  tipo: string
  nombre: string
  unidad_medida: string
  valor_unitario: number
  consumo_estimado: number | null
  consumo_real: number | null
  valor_por_prenda: number
}

const SELECT_COLS =
  "id, orden_id, material_id, tipo, nombre, unidad_medida, valor_unitario, consumo_estimado, consumo_real, valor_por_prenda"

export async function getOpMateriales(ordenId: number): Promise<OpMaterialRow[]> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("op_material")
    .select(SELECT_COLS)
    .eq("orden_id", ordenId)
    .order("id")
  if (error) throw new Error(error.message)
  return (data ?? []) as OpMaterialRow[]
}

export async function addOpMaterial(input: {
  orden_id: number
  material_id?: number | null
  tipo: string
  nombre: string
  unidad_medida: string
  valor_unitario: number
  consumo_estimado?: number | null
  creado_por: number
}): Promise<number> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("op_material")
    .insert({
      orden_id: input.orden_id,
      material_id: input.material_id ?? null,
      tipo: input.tipo.trim(),
      nombre: input.nombre.trim(),
      unidad_medida: input.unidad_medida.trim(),
      valor_unitario: input.valor_unitario,
      consumo_estimado: input.consumo_estimado ?? null,
      creado_por: input.creado_por,
    })
    .select("id")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Error agregando material")
  return data.id
}

export async function updateOpMaterial(
  id: number,
  input: Partial<{
    tipo: string
    nombre: string
    unidad_medida: string
    valor_unitario: number
    consumo_estimado: number | null
    consumo_real: number | null
  }>
): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("op_material").update(input).eq("id", id)
  if (error) throw new Error(error.message)
}

export async function deleteOpMaterial(id: number): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("op_material").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

export async function updateConsumoRealTelas(
  ordenId: number,
  consumoReal: number
): Promise<number> {
  const db = createVanessaClient()
  const { data: telas } = await db
    .from("op_material")
    .select("id")
    .eq("orden_id", ordenId)
    .ilike("tipo", "%tela%")
  if (!telas?.length) return 0
  const ids = (telas as { id: number }[]).map((t) => t.id)
  const { error } = await db
    .from("op_material")
    .update({ consumo_real: consumoReal })
    .in("id", ids)
  if (error) throw new Error(error.message)
  return ids.length
}

export async function sumValorPorPrenda(ordenId: number): Promise<number> {
  const db = createVanessaClient()
  const { data } = await db
    .from("op_material")
    .select("valor_por_prenda")
    .eq("orden_id", ordenId)
  return (data ?? []).reduce(
    (s: number, r: { valor_por_prenda: number }) => s + Number(r.valor_por_prenda),
    0
  )
}
