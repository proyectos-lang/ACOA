import { createVanessaClient } from "@/lib/supabase/vanessa"

export interface MaterialRow {
  id: number
  tipo: string
  nombre: string
  unidad_medida: string
  valor_unitario: number
  activo: boolean
}

const SELECT_COLS = "id, tipo, nombre, unidad_medida, valor_unitario, activo"

export async function listMateriales(filtros?: {
  tipo?: string
  activo?: boolean
}): Promise<MaterialRow[]> {
  const db = createVanessaClient()
  let q = db.from("material").select(SELECT_COLS).order("nombre")
  if (filtros?.tipo) q = q.eq("tipo", filtros.tipo)
  if (filtros?.activo !== undefined) q = q.eq("activo", filtros.activo)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as MaterialRow[]
}

export async function getMaterialById(id: number): Promise<MaterialRow | null> {
  const db = createVanessaClient()
  const { data } = await db.from("material").select(SELECT_COLS).eq("id", id).single()
  return data as MaterialRow | null
}

export async function createMaterial(input: {
  tipo: string
  nombre: string
  unidad_medida: string
  valor_unitario: number
  activo: boolean
  creado_por: number
}): Promise<number> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("material")
    .insert(input)
    .select("id")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Error creando material")
  return data.id
}

export async function updateMaterial(
  id: number,
  input: Partial<Pick<MaterialRow, "tipo" | "nombre" | "unidad_medida" | "valor_unitario" | "activo">>
): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("material").update(input).eq("id", id)
  if (error) throw new Error(error.message)
}

export async function deleteMaterial(id: number): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("material").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

export async function getDistinctTipos(): Promise<string[]> {
  const db = createVanessaClient()
  const { data } = await db.from("material").select("tipo")
  const set = new Set((data ?? []).map((r: { tipo: string }) => r.tipo))
  return [...set].sort()
}

export async function getDistinctUnidades(): Promise<string[]> {
  const db = createVanessaClient()
  const { data } = await db.from("material").select("unidad_medida")
  const set = new Set((data ?? []).map((r: { unidad_medida: string }) => r.unidad_medida))
  return [...set].sort()
}
