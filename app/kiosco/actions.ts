"use server"

import { createVanessaClient } from "@/lib/supabase/vanessa"
import { getMarcacionesPorPersonaYDia, registrarMarcacion } from "@/lib/db/marcacion"

export type KioscoResult =
  | { ok: true; tipo: "entrada" | "salida"; nombre: string; hora: string; fecha: string }
  | { ok: false; error: string; sugerirSalida?: true; horaEntrada?: string; nombre?: string }

function fechaColombiaHoy(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Bogota" })
}

function horaColombiaAhora(): string {
  return new Date().toLocaleTimeString("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })
}

function fechaColombiaFormateada(): string {
  return new Date().toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function fmtHHMM(fecha_hora: string): string {
  const d = new Date(fecha_hora)
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  const parts = fmt.formatToParts(d)
  const h = parts.find((p) => p.type === "hour")?.value?.padStart(2, "0") ?? "00"
  const m = parts.find((p) => p.type === "minute")?.value?.padStart(2, "0") ?? "00"
  return `${h}:${m}`
}

async function buscarPersona(documento: string) {
  const db = createVanessaClient()
  const { data } = await db
    .from("persona")
    .select("id, nombre, estado, documento")
    .eq("documento", documento.trim())
    .maybeSingle()
  return data as { id: number; nombre: string; estado: string; documento: string } | null
}

export async function registrarEntradaAction(formData: FormData): Promise<KioscoResult> {
  const documento = (formData.get("documento") as string | null)?.trim() ?? ""
  if (!documento) return { ok: false, error: "Ingresa un número de documento" }

  const persona = await buscarPersona(documento)
  if (!persona) return { ok: false, error: "Documento no encontrado en el sistema" }
  if (persona.estado !== "activo") return { ok: false, error: "La persona no está activa" }

  const hoy = fechaColombiaHoy()
  const marcaciones = await getMarcacionesPorPersonaYDia(persona.id, hoy)
  const ultima = marcaciones.at(-1)

  if (ultima?.tipo === "entrada") {
    return {
      ok: false,
      error: `Ya tiene una entrada registrada hoy a las ${fmtHHMM(ultima.fecha_hora)}. ¿Desea registrar la salida?`,
      sugerirSalida: true,
      horaEntrada: fmtHHMM(ultima.fecha_hora),
      nombre: persona.nombre,
    }
  }

  await registrarMarcacion({ persona_id: persona.id, documento, tipo: "entrada" })
  return {
    ok: true,
    tipo: "entrada",
    nombre: persona.nombre,
    hora: horaColombiaAhora(),
    fecha: fechaColombiaFormateada(),
  }
}

export async function registrarSalidaAction(formData: FormData): Promise<KioscoResult> {
  const documento = (formData.get("documento") as string | null)?.trim() ?? ""
  if (!documento) return { ok: false, error: "Ingresa un número de documento" }

  const persona = await buscarPersona(documento)
  if (!persona) return { ok: false, error: "Documento no encontrado en el sistema" }
  if (persona.estado !== "activo") return { ok: false, error: "La persona no está activa" }

  const hoy = fechaColombiaHoy()
  const marcaciones = await getMarcacionesPorPersonaYDia(persona.id, hoy)
  const ultima = marcaciones.at(-1)

  if (!ultima || ultima.tipo === "salida") {
    return { ok: false, error: "No tiene entrada registrada hoy" }
  }

  await registrarMarcacion({ persona_id: persona.id, documento, tipo: "salida" })
  return {
    ok: true,
    tipo: "salida",
    nombre: persona.nombre,
    hora: horaColombiaAhora(),
    fecha: fechaColombiaFormateada(),
  }
}
