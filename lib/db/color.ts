import { createVanessaClient } from "@/lib/supabase/vanessa"

export interface ColorRow {
  id: number
  nombre: string
  activo: boolean
}

export async function listColores(soloActivos = false): Promise<ColorRow[]> {
  const db = createVanessaClient()
  let q = db.from("color").select("id, nombre, activo").order("nombre")
  if (soloActivos) q = q.eq("activo", true)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as ColorRow[]
}

export async function createColor(nombre: string, creadoPor: number): Promise<number> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("color")
    .insert({ nombre: nombre.trim(), creado_por: creadoPor })
    .select("id")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Error creando color")
  return data.id
}

export async function toggleColorActivo(id: number, activo: boolean): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("color").update({ activo }).eq("id", id)
  if (error) throw new Error(error.message)
}
