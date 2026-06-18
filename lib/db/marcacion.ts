import { createVanessaClient } from "@/lib/supabase/vanessa"

export interface MarcacionRow {
  id: number
  persona_id: number
  documento: string
  fecha_hora: string
  tipo: "entrada" | "salida"
}

function diaRango(fecha: string) {
  // Colombia = UTC-5, sin horario de verano.
  // 00:00 Colombia = 05:00 UTC; 23:59:59 Colombia = 04:59:59 UTC del día siguiente.
  const next = new Date(fecha + "T12:00:00Z")
  next.setUTCDate(next.getUTCDate() + 1)
  const nextStr = next.toISOString().substring(0, 10)
  return {
    desde: `${fecha}T05:00:00.000Z`,
    hasta: `${nextStr}T04:59:59.999Z`,
  }
}

export async function getUltimaMarcacionDia(
  personaId: number,
  fecha: string
): Promise<MarcacionRow | null> {
  const db = createVanessaClient()
  const { desde, hasta } = diaRango(fecha)
  const { data } = await db
    .from("marcacion")
    .select("*")
    .eq("persona_id", personaId)
    .gte("fecha_hora", desde)
    .lte("fecha_hora", hasta)
    .order("fecha_hora", { ascending: false })
    .limit(1)
    .single()
  return data as MarcacionRow | null
}

export async function registrarMarcacion(input: {
  persona_id: number
  documento: string
  tipo: "entrada" | "salida"
}): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("marcacion").insert({
    persona_id: input.persona_id,
    documento: input.documento,
    tipo: input.tipo,
    fecha_hora: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

export async function getMarcacionesPorPersonaYDia(
  personaId: number,
  fecha: string
): Promise<MarcacionRow[]> {
  const db = createVanessaClient()
  const { desde, hasta } = diaRango(fecha)
  const { data } = await db
    .from("marcacion")
    .select("*")
    .eq("persona_id", personaId)
    .gte("fecha_hora", desde)
    .lte("fecha_hora", hasta)
    .order("fecha_hora")
  return (data ?? []) as MarcacionRow[]
}

export async function getMarcacionesDia(fecha: string): Promise<MarcacionRow[]> {
  const db = createVanessaClient()
  const { desde, hasta } = diaRango(fecha)
  const { data, error } = await db
    .from("marcacion")
    .select("*")
    .gte("fecha_hora", desde)
    .lte("fecha_hora", hasta)
    .order("persona_id")
    .order("fecha_hora")
  if (error) throw new Error(error.message)
  return (data ?? []) as MarcacionRow[]
}
