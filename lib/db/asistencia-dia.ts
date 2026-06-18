import { createVanessaClient } from "@/lib/supabase/vanessa"
import type { HistorialRow } from "@/lib/types"

export type { HistorialRow }

export interface AsistenciaDiaRow {
  id: number
  persona_id: number
  fecha: string
  hora_entrada: string | null
  hora_salida: string | null
  umbral_horas_extra: number
  horas_trabajadas: number
  horas_ordinarias: number
  horas_extra: number
  horas_nocturnas: number
  trabajado: boolean
  es_festivo: boolean
  es_domingo: boolean
  observacion: string | null
}

export async function upsertAsistenciaDia(
  data: Omit<AsistenciaDiaRow, "id"> & { creado_por: number }
): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db
    .from("asistencia_dia")
    .upsert(data, { onConflict: "persona_id,fecha" })
  if (error) throw new Error(error.message)
}

export async function getAsistenciaPorFecha(fecha: string): Promise<
  (AsistenciaDiaRow & { persona: { nombre: string; documento: string; tipo_pago: string } | null })[]
> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("asistencia_dia")
    .select("*, persona!persona_id(nombre, documento, tipo_pago)")
    .eq("fecha", fecha)
    .order("persona_id")
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as (AsistenciaDiaRow & {
    persona: { nombre: string; documento: string; tipo_pago: string } | null
  })[]
}

export async function updateUmbralYRecalcular(id: number, umbral: number): Promise<void> {
  const db = createVanessaClient()
  const { data: row } = await db
    .from("asistencia_dia")
    .select("horas_trabajadas")
    .eq("id", id)
    .single()
  if (!row) throw new Error("Registro no encontrado")

  const ht = Number(row.horas_trabajadas)
  const extra = Math.max(0, Math.round((ht - umbral) * 100) / 100)
  const ordinarias = Math.round((ht - extra) * 100) / 100

  const { error } = await db.from("asistencia_dia").update({
    umbral_horas_extra: umbral,
    horas_extra: extra,
    horas_ordinarias: ordinarias,
  }).eq("id", id)
  if (error) throw new Error(error.message)
}

export async function getAsistenciaHistorial(params: {
  fechaDesde: string
  fechaHasta: string
  personaId?: number
}): Promise<HistorialRow[]> {
  const db = createVanessaClient()
  let q = db
    .from("v_historial_asistencia")
    .select("*")
    .gte("fecha", params.fechaDesde)
    .lte("fecha", params.fechaHasta)
    .order("fecha", { ascending: false })
    .order("nombre", { ascending: true })
  if (params.personaId) q = q.eq("persona_id", params.personaId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as HistorialRow[]
}

export async function updateHorasExtra(id: number, horasExtra: number): Promise<void> {
  const db = createVanessaClient()
  const { data: row } = await db
    .from("asistencia_dia")
    .select("horas_trabajadas")
    .eq("id", id)
    .single()
  if (!row) throw new Error("Registro no encontrado")
  const ht = Number(row.horas_trabajadas)
  const extra = Math.max(0, Math.min(Math.round(horasExtra * 100) / 100, ht))
  const ordinarias = Math.round((ht - extra) * 100) / 100
  const { error } = await db
    .from("asistencia_dia")
    .update({ horas_extra: extra, horas_ordinarias: ordinarias })
    .eq("id", id)
  if (error) throw new Error(error.message)
}

export async function getAsistenciaPorPeriodo(
  personaId: number,
  fechaInicio: string,
  fechaFin: string
): Promise<AsistenciaDiaRow[]> {
  const db = createVanessaClient()
  const { data } = await db
    .from("asistencia_dia")
    .select("*")
    .eq("persona_id", personaId)
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin)
    .order("fecha")
  return (data ?? []) as AsistenciaDiaRow[]
}
