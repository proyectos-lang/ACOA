"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import { getMarcacionesDia } from "@/lib/db/marcacion"
import {
  upsertAsistenciaDia,
  updateUmbralYRecalcular,
  updateHorasExtra,
  getAsistenciaHistorial,
} from "@/lib/db/asistencia-dia"
import type { HistorialRow } from "@/lib/types"
import { getFestivosSet } from "@/lib/db/festivo"
import { getConfigVigente, type ConfigNominaRow } from "@/lib/db/config-nomina"
import type { MarcacionRow } from "@/lib/db/marcacion"

export interface ActionResult {
  error?: string
  success?: boolean
  procesadas?: number
}

// ── Helpers de tiempo en Colombia ─────────────────────────────────────────────

function getColombiaMinutes(d: Date): number {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  const parts = fmt.formatToParts(d)
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0")
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0")
  return h * 60 + m
}

function getColombiaHHMM(d: Date): string {
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

function parseMinutes(t: string): number {
  const [h = "0", m = "0"] = t.split(":")
  return parseInt(h) * 60 + parseInt(m)
}

/** Minutos nocturnos en el tramo [entrada, salida] dado el rango nocturno de la config. */
function calcularMinNocturnas(
  entradaMin: number,
  salidaMin: number,
  inicioNoc: number, // ej. 19*60 = 1140
  finNoc: number     // ej. 6*60  = 360
): number {
  if (salidaMin <= entradaMin) return 0 // turno nocturno cruzado: no soportado aquí
  let total = 0
  // Período nocturno 1: [inicioNoc, 1440)
  const s1 = Math.max(entradaMin, inicioNoc)
  const e1 = Math.min(salidaMin, 1440)
  if (s1 < e1) total += e1 - s1
  // Período nocturno 2: [0, finNoc]
  const s2 = Math.max(entradaMin, 0)
  const e2 = Math.min(salidaMin, finNoc)
  if (s2 < e2) total += e2 - s2
  return total
}

// ── Calcular pares entrada→salida ─────────────────────────────────────────────

function calcularPares(
  marcaciones: MarcacionRow[],
  config: ConfigNominaRow
): {
  horasTrabajadas: number
  horaEntrada: string | null
  horaSalida: string | null
  horasNocturnas: number
  observacion: string | null
} {
  if (marcaciones.length === 0) {
    return { horasTrabajadas: 0, horaEntrada: null, horaSalida: null, horasNocturnas: 0, observacion: null }
  }

  const nocIni = parseMinutes(config.hora_inicio_nocturno)
  const nocFin = parseMinutes(config.hora_fin_nocturno)

  let horasTrabajadas = 0
  let minNocturnas = 0
  let primeraEntrada: Date | null = null
  let ultimaSalida: Date | null = null
  let entradaSinSalida: Date | null = null
  let i = 0

  while (i < marcaciones.length) {
    const m = marcaciones[i]
    if (m.tipo === "entrada") {
      const entrada = new Date(m.fecha_hora)
      // Buscar siguiente salida
      let j = i + 1
      while (j < marcaciones.length && marcaciones[j].tipo !== "salida") j++

      if (j < marcaciones.length) {
        const salida = new Date(marcaciones[j].fecha_hora)
        const diffH = (salida.getTime() - entrada.getTime()) / 3_600_000
        horasTrabajadas += diffH
        minNocturnas += calcularMinNocturnas(
          getColombiaMinutes(entrada),
          getColombiaMinutes(salida),
          nocIni,
          nocFin
        )
        if (!primeraEntrada) primeraEntrada = entrada
        ultimaSalida = salida
        i = j + 1
      } else {
        // Entrada sin salida
        if (!primeraEntrada) primeraEntrada = entrada
        entradaSinSalida = entrada
        i++
      }
    } else {
      i++
    }
  }

  horasTrabajadas = Math.round(horasTrabajadas * 100) / 100
  const horasNocturnas = Math.round((minNocturnas / 60) * 100) / 100

  return {
    horasTrabajadas,
    horaEntrada: primeraEntrada ? getColombiaHHMM(primeraEntrada) : null,
    horaSalida: ultimaSalida ? getColombiaHHMM(ultimaSalida) : null,
    horasNocturnas,
    observacion: entradaSinSalida && !ultimaSalida ? "Sin registro de salida" : null,
  }
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function consolidarDiaAction(fecha: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const [marcaciones, config, festivosSet] = await Promise.all([
      getMarcacionesDia(fecha),
      getConfigVigente(fecha),
      getFestivosSet(fecha, fecha),
    ])

    console.log(`[consolidarDia] fecha=${fecha} marcaciones=${marcaciones.length} config=${!!config}`)

    if (!config) return { error: "Sin configuración de nómina vigente para esta fecha" }
    if (marcaciones.length === 0) {
      return { error: `No se encontraron marcaciones para ${fecha}. Verifica que existan registros en la tabla de marcaciones para ese día.` }
    }

    const umbral = config.umbral_horas_extra_diario
    const esFestivo = festivosSet.has(fecha)
    const esDomingo = new Date(fecha + "T12:00:00Z").getUTCDay() === 0

    // Agrupar por persona
    const porPersona = new Map<number, MarcacionRow[]>()
    for (const m of marcaciones) {
      if (!porPersona.has(m.persona_id)) porPersona.set(m.persona_id, [])
      porPersona.get(m.persona_id)!.push(m)
    }

    console.log(`[consolidarDia] personas con marcaciones: ${porPersona.size}`)

    let procesadas = 0
    for (const [personaId, meds] of porPersona) {
      const { horasTrabajadas, horaEntrada, horaSalida, horasNocturnas, observacion } =
        calcularPares(meds, config)
      const extra = Math.max(0, Math.round((horasTrabajadas - umbral) * 100) / 100)
      const ordinarias = Math.round((horasTrabajadas - extra) * 100) / 100

      console.log(`[consolidarDia] persona_id=${personaId} entrada=${horaEntrada} salida=${horaSalida} horas=${horasTrabajadas}`)

      await upsertAsistenciaDia({
        persona_id: personaId,
        fecha,
        hora_entrada: horaEntrada,
        hora_salida: horaSalida,
        umbral_horas_extra: umbral,
        horas_trabajadas: horasTrabajadas,
        horas_ordinarias: ordinarias,
        horas_extra: extra,
        horas_nocturnas: horasNocturnas,
        trabajado: horasTrabajadas > 0,
        es_festivo: esFestivo,
        es_domingo: esDomingo,
        observacion,
        creado_por: session.userId,
      })
      procesadas++
    }

    revalidatePath("/asistencia")
    return { success: true, procesadas }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error consolidando día"
    console.error(`[consolidarDia] ERROR: ${msg}`)
    return { error: msg }
  }
}

export async function actualizarUmbralAction(id: number, umbral: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  try {
    await updateUmbralYRecalcular(id, umbral)
    revalidatePath("/asistencia")
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error actualizando umbral" }
  }
}

export async function actualizarHorasExtraAction(
  id: number,
  horasExtra: number
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  try {
    await updateHorasExtra(id, horasExtra)
    revalidatePath("/asistencia")
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error actualizando horas extra" }
  }
}

export async function marcarManualAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  const personaId = parseInt((formData.get("persona_id") as string) ?? "")
  const fecha = (formData.get("fecha") as string | null) ?? ""
  const horaEntrada = (formData.get("hora_entrada") as string | null) ?? ""
  const horaSalida = (formData.get("hora_salida") as string | null) ?? ""

  if (!personaId || !fecha || !horaEntrada || !horaSalida) {
    return { error: "Todos los campos son requeridos" }
  }

  try {
    const [config, festivosSet] = await Promise.all([
      getConfigVigente(fecha),
      getFestivosSet(fecha, fecha),
    ])
    if (!config) return { error: "Sin configuración de nómina vigente para esta fecha" }

    const entradaMin = parseMinutes(horaEntrada)
    let salidaMin = parseMinutes(horaSalida)
    if (salidaMin <= entradaMin) salidaMin += 1440 // turno nocturno cruzado

    const horasTrabajadas = Math.round(((salidaMin - entradaMin) / 60) * 100) / 100

    const nocIni = parseMinutes(config.hora_inicio_nocturno)
    const nocFin = parseMinutes(config.hora_fin_nocturno)
    const minNoc = calcularMinNocturnas(entradaMin, Math.min(salidaMin, 1440), nocIni, nocFin)
    const horasNocturnas = Math.round((minNoc / 60) * 100) / 100

    const umbral = config.umbral_horas_extra_diario
    const extra = Math.max(0, Math.round((horasTrabajadas - umbral) * 100) / 100)
    const ordinarias = Math.round((horasTrabajadas - extra) * 100) / 100

    const esFestivo = festivosSet.has(fecha)
    const esDomingo = new Date(fecha + "T12:00:00Z").getUTCDay() === 0

    await upsertAsistenciaDia({
      persona_id: personaId,
      fecha,
      hora_entrada: horaEntrada,
      hora_salida: horaSalida,
      umbral_horas_extra: umbral,
      horas_trabajadas: horasTrabajadas,
      horas_ordinarias: ordinarias,
      horas_extra: extra,
      horas_nocturnas: horasNocturnas,
      trabajado: horasTrabajadas > 0,
      es_festivo: esFestivo,
      es_domingo: esDomingo,
      observacion: null,
      creado_por: session.userId,
    })

    revalidatePath("/asistencia")
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error registrando asistencia manual" }
  }
}

export async function filtrarHistorialAction(params: {
  fechaDesde: string
  fechaHasta: string
  personaId?: number
}): Promise<{ registros: HistorialRow[]; error?: string }> {
  const session = await getSession()
  if (!session) return { registros: [], error: "No autorizado" }
  try {
    const registros = await getAsistenciaHistorial(params)
    return { registros }
  } catch (err: unknown) {
    return { registros: [], error: err instanceof Error ? err.message : "Error cargando historial" }
  }
}
