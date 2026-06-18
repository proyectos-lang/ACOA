import { createVanessaClient } from "@/lib/supabase/vanessa"

export interface FestivoRow {
  id: number
  fecha: string
  descripcion: string | null
}

export async function esFestivo(fecha: string): Promise<boolean> {
  const db = createVanessaClient()
  const { data } = await db.from("festivo").select("id").eq("fecha", fecha).single()
  return !!data
}

export async function getFestivosSet(fechaInicio: string, fechaFin: string): Promise<Set<string>> {
  const db = createVanessaClient()
  const { data } = await db
    .from("festivo")
    .select("fecha")
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin)
  const set = new Set<string>()
  for (const f of data ?? []) set.add(f.fecha)
  return set
}

export async function listFestivos(): Promise<FestivoRow[]> {
  const db = createVanessaClient()
  const { data } = await db.from("festivo").select("*").order("fecha")
  return (data ?? []) as FestivoRow[]
}

export async function createFestivo(input: { fecha: string; descripcion?: string; creado_por: number }): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("festivo").insert({
    fecha: input.fecha,
    descripcion: input.descripcion || null,
    creado_por: input.creado_por,
  })
  if (error) throw new Error(error.message)
}

export async function deleteFestivo(id: number): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("festivo").delete().eq("id", id)
  if (error) throw new Error(error.message)
}
