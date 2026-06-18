import { createVanessaClient } from "@/lib/supabase/vanessa"

export type TipoNovedad =
  | "falta_justificada"
  | "falta_injustificada"
  | "incapacidad"
  | "licencia"
  | "permiso"
  | "vacaciones"

export const TIPO_NOVEDAD_LABEL: Record<TipoNovedad, string> = {
  falta_justificada:   "Falta justificada",
  falta_injustificada: "Falta injustificada",
  incapacidad:         "Incapacidad",
  licencia:            "Licencia",
  permiso:             "Permiso",
  vacaciones:          "Vacaciones",
}

export const NOVEDADES_PAGADAS: TipoNovedad[] = [
  "falta_justificada",
  "incapacidad",
  "licencia",
  "permiso",
  "vacaciones",
]

export interface NovedadRow {
  id: number
  persona_id: number
  tipo: TipoNovedad
  fecha_inicio: string
  fecha_fin: string
  observacion: string | null
  creado_en: string
}

export interface NovedadConPersona extends NovedadRow {
  persona: { nombre: string; documento: string } | null
}

export async function listNovedades(filtros?: {
  persona_id?: number
  tipo?: TipoNovedad
  desde?: string
  hasta?: string
}): Promise<NovedadConPersona[]> {
  const db = createVanessaClient()
  let q = db
    .from("novedad")
    .select("*, persona!fk_novedad_persona(nombre, documento)")
    .order("fecha_inicio", { ascending: false })

  if (filtros?.persona_id) q = q.eq("persona_id", filtros.persona_id)
  if (filtros?.tipo) q = q.eq("tipo", filtros.tipo)
  if (filtros?.desde) q = q.gte("fecha_fin", filtros.desde)
  if (filtros?.hasta) q = q.lte("fecha_inicio", filtros.hasta)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as NovedadConPersona[]
}

export async function getNovedadesPorPersonaYPeriodo(
  personaId: number,
  fechaInicio: string,
  fechaFin: string
): Promise<NovedadRow[]> {
  const db = createVanessaClient()
  const { data } = await db
    .from("novedad")
    .select("*")
    .eq("persona_id", personaId)
    .lte("fecha_inicio", fechaFin)
    .gte("fecha_fin", fechaInicio)
  return (data ?? []) as NovedadRow[]
}

export async function createNovedad(input: {
  persona_id: number
  tipo: TipoNovedad
  fecha_inicio: string
  fecha_fin: string
  observacion?: string
  creado_por: number
}): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("novedad").insert({
    persona_id: input.persona_id,
    tipo: input.tipo,
    fecha_inicio: input.fecha_inicio,
    fecha_fin: input.fecha_fin,
    observacion: input.observacion || null,
    creado_por: input.creado_por,
  })
  if (error) throw new Error(error.message)
}

export async function updateNovedad(
  id: number,
  input: Partial<Pick<NovedadRow, "tipo" | "fecha_inicio" | "fecha_fin" | "observacion">>
): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("novedad").update(input).eq("id", id)
  if (error) throw new Error(error.message)
}

export async function deleteNovedad(id: number): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("novedad").delete().eq("id", id)
  if (error) throw new Error(error.message)
}
