import { createVanessaClient } from "@/lib/supabase/vanessa"

export interface CategoriaRow {
  id: number
  nombre: string
}

export async function listCategorias(): Promise<CategoriaRow[]> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("categoria")
    .select("id, nombre")
    .order("nombre")
  if (error) throw new Error(error.message)
  return (data ?? []) as CategoriaRow[]
}

export async function createCategoria(nombre: string, userId: number): Promise<number> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("categoria")
    .insert({ nombre: nombre.trim(), creado_por: userId })
    .select("id")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Error creando categoría")
  return data.id
}
