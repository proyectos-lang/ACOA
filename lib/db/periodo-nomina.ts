import { createVanessaClient } from "@/lib/supabase/vanessa"

export interface PeriodoNominaRow {
  id: number
  anio: number
  mes: number
  quincena: 1 | 2
  fecha_inicio: string
  fecha_fin: string
  estado: "abierto" | "liquidado"
  creado_en: string
}

export async function listPeriodos(): Promise<PeriodoNominaRow[]> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("periodo_nomina")
    .select("*")
    .order("anio", { ascending: false })
    .order("mes", { ascending: false })
    .order("quincena", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as PeriodoNominaRow[]
}

export async function getPeriodoById(id: number): Promise<PeriodoNominaRow | null> {
  const db = createVanessaClient()
  const { data } = await db.from("periodo_nomina").select("*").eq("id", id).single()
  return data as PeriodoNominaRow | null
}

export async function createPeriodo(input: {
  anio: number
  mes: number
  quincena: 1 | 2
  fecha_inicio: string
  fecha_fin: string
  creado_por: number
}): Promise<number> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("periodo_nomina")
    .insert({
      anio: input.anio,
      mes: input.mes,
      quincena: input.quincena,
      fecha_inicio: input.fecha_inicio,
      fecha_fin: input.fecha_fin,
      creado_por: input.creado_por,
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  return data!.id
}

export async function cerrarPeriodo(id: number): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db
    .from("periodo_nomina")
    .update({ estado: "liquidado" })
    .eq("id", id)
  if (error) throw new Error(error.message)
}
