"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth/session"
import { listPersonas } from "@/lib/db/persona"
import { createPeriodo, cerrarPeriodo, getPeriodoById } from "@/lib/db/periodo-nomina"
import { getAsistenciaPorPeriodo } from "@/lib/db/asistencia-dia"
import { getNovedadesPorPersonaYPeriodo, NOVEDADES_PAGADAS, type NovedadRow } from "@/lib/db/novedad"
import { getConfigVigente } from "@/lib/db/config-nomina"
import {
  upsertLiquidacion,
  deleteLiquidacionDetalles,
  insertLiquidacionDetalles,
} from "@/lib/db/liquidacion"
import { createVanessaClient } from "@/lib/supabase/vanessa"
import { getEmpaqueResumenPorPersonaYPeriodo } from "@/lib/db/empaque-registro"

export interface NominaActionResult {
  error?: string
  success?: boolean
  creados?: number
  liquidados?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toISO(d: Date): string {
  return d.toISOString().substring(0, 10)
}

function getDaysInRange(inicio: string, fin: string): string[] {
  const days: string[] = []
  const cur = new Date(`${inicio}T12:00:00Z`)
  const end = new Date(`${fin}T12:00:00Z`)
  while (cur <= end) {
    days.push(toISO(cur))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return days
}

function novedadCubreFecha(nov: NovedadRow, fecha: string): boolean {
  return nov.fecha_inicio <= fecha && fecha <= nov.fecha_fin
}

function getLastDayOfMonth(year: number, month: number): number {
  // month is 1-indexed
  return new Date(year, month, 0).getDate()
}

// ─── Generar quincenas ────────────────────────────────────────────────────────

export async function generarQuincenasAction(
  anio: number,
  mes: number
): Promise<NominaActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const db = createVanessaClient()
    const { data: existing } = await db
      .from("periodo_nomina")
      .select("quincena")
      .eq("anio", anio)
      .eq("mes", mes)

    const existentes = new Set((existing ?? []).map((r: { quincena: number }) => r.quincena))
    const lastDay = getLastDayOfMonth(anio, mes)
    const pad = (n: number) => String(n).padStart(2, "0")
    let creados = 0

    if (!existentes.has(1)) {
      await createPeriodo({
        anio,
        mes,
        quincena: 1,
        fecha_inicio: `${anio}-${pad(mes)}-01`,
        fecha_fin: `${anio}-${pad(mes)}-15`,
        creado_por: session.userId,
      })
      creados++
    }

    if (!existentes.has(2)) {
      await createPeriodo({
        anio,
        mes,
        quincena: 2,
        fecha_inicio: `${anio}-${pad(mes)}-16`,
        fecha_fin: `${anio}-${pad(mes)}-${pad(lastDay)}`,
        creado_por: session.userId,
      })
      creados++
    }

    revalidatePath("/nomina")
    return { success: true, creados }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error generando quincenas" }
  }
}

// ─── Liquidar período ─────────────────────────────────────────────────────────

export async function liquidarPeriodoAction(periodoId: number): Promise<NominaActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    const periodo = await getPeriodoById(periodoId)
    if (!periodo) return { error: "Período no encontrado" }
    if (periodo.estado === "liquidado") return { error: "El período ya está liquidado" }

    const [personas, config] = await Promise.all([
      listPersonas({ estado: "activo" }),
      getConfigVigente(periodo.fecha_inicio),
    ])

    if (!config) return { error: "Sin configuración de nómina vigente para este período" }

    const { fecha_inicio, fecha_fin } = periodo
    const diasPeriodo = getDaysInRange(fecha_inicio, fecha_fin)
    let liquidados = 0

    for (const persona of personas) {
      const [asistencias, novedades] = await Promise.all([
        getAsistenciaPorPeriodo(persona.id, fecha_inicio, fecha_fin),
        getNovedadesPorPersonaYPeriodo(persona.id, fecha_inicio, fecha_fin),
      ])

      // Índice de asistencias por fecha para búsqueda rápida
      const asistMap = new Map(asistencias.map((a) => [a.fecha, a]))

      const valorDia = Math.round((persona.salario / persona.dias_mes) * 100) / 100
      const valorHora = persona.valor_hora ?? 0

      const detalles: Array<{
        concepto: string
        descripcion?: string
        cantidad: number
        valor_unitario: number
        valor_total: number
      }> = []

      if (persona.tipo_pago === "salario") {
        // Base: 15 días
        detalles.push({
          concepto: "dia_salario",
          descripcion: "15 días de salario",
          cantidad: 15,
          valor_unitario: valorDia,
          valor_total: Math.round(15 * valorDia * 100) / 100,
        })

        // Descuentos por falta injustificada y regla del domingo
        const faltasInjust = novedades.filter((n) => n.tipo === "falta_injustificada")
        const domingosPorDescontar = new Set<string>()

        for (const fecha of diasPeriodo) {
          const esFalta = faltasInjust.some((n) => novedadCubreFecha(n, fecha))
          if (!esFalta) continue

          detalles.push({
            concepto: "descuento_falta",
            descripcion: `Falta injustificada ${fecha}`,
            cantidad: -1,
            valor_unitario: valorDia,
            valor_total: -valorDia,
          })

          // Regla del domingo: si el día es lun-sáb, marcar domingo de esa semana
          const d = new Date(`${fecha}T12:00:00Z`)
          const dow = d.getUTCDay() // 0=dom, 1=lun... 6=sáb
          if (dow >= 1 && dow <= 6) {
            const diasHastaDomingo = 7 - dow
            const domingo = new Date(d)
            domingo.setUTCDate(d.getUTCDate() + diasHastaDomingo)
            const domISO = toISO(domingo)
            if (domISO >= fecha_inicio && domISO <= fecha_fin) {
              domingosPorDescontar.add(domISO)
            }
          }
        }

        for (const dom of domingosPorDescontar) {
          detalles.push({
            concepto: "descuento_domingo",
            descripcion: `Descuento dominical ${dom}`,
            cantidad: -1,
            valor_unitario: valorDia,
            valor_total: -valorDia,
          })
        }

        // Horas extra
        const totalExtra = asistencias.reduce((s, a) => s + Number(a.horas_extra), 0)
        if (totalExtra > 0) {
          const valorExtra = Math.round(valorHora * config.factor_extra_diurna * 100) / 100
          detalles.push({
            concepto: "hora_extra_diurna",
            descripcion: `${totalExtra.toFixed(2)}h extra diurnas`,
            cantidad: Math.round(totalExtra * 100) / 100,
            valor_unitario: valorExtra,
            valor_total: Math.round(totalExtra * valorExtra * 100) / 100,
          })
        }
      } else if (persona.tipo_pago === "turno") {
        // Días pagados: trabajado=true OR novedad pagada
        const novedadesPagadas = novedades.filter((n) =>
          (NOVEDADES_PAGADAS as string[]).includes(n.tipo)
        )

        let diasPagados = 0
        for (const fecha of diasPeriodo) {
          const asist = asistMap.get(fecha)
          const trabajado = asist?.trabajado === true
          const novedadPagada = novedadesPagadas.some((n) => novedadCubreFecha(n, fecha))
          if (trabajado || novedadPagada) diasPagados++
        }

        if (diasPagados > 0) {
          detalles.push({
            concepto: "turno_ordinario",
            descripcion: `${diasPagados} días de turno`,
            cantidad: diasPagados,
            valor_unitario: valorDia,
            valor_total: Math.round(diasPagados * valorDia * 100) / 100,
          })
        }

        // Horas extra
        const totalExtra = asistencias.reduce((s, a) => s + Number(a.horas_extra), 0)
        if (totalExtra > 0) {
          const valorExtra = Math.round(valorHora * config.factor_extra_diurna * 100) / 100
          detalles.push({
            concepto: "hora_extra_diurna",
            descripcion: `${totalExtra.toFixed(2)}h extra diurnas`,
            cantidad: Math.round(totalExtra * 100) / 100,
            valor_unitario: valorExtra,
            valor_total: Math.round(totalExtra * valorExtra * 100) / 100,
          })
        }
      } else {
        // produccion — devengado real desde empaque_registro
        const empaque = await getEmpaqueResumenPorPersonaYPeriodo(
          persona.id,
          fecha_inicio,
          fecha_fin
        )
        if (empaque.total_valor > 0) {
          detalles.push({
            concepto: "produccion_empaque",
            descripcion: `Empaque: ${empaque.total_cantidad.toLocaleString("es-CO")} uds`,
            cantidad: empaque.total_cantidad,
            valor_unitario: Math.round((empaque.total_valor / empaque.total_cantidad) * 100) / 100,
            valor_total: Math.round(empaque.total_valor * 100) / 100,
          })
        }
      }

      const totalDevengado =
        Math.round(detalles.reduce((s, d) => s + d.valor_total, 0) * 100) / 100

      const liquidacionId = await upsertLiquidacion({
        periodo_id: periodoId,
        persona_id: persona.id,
        tipo_pago: persona.tipo_pago,
        valor_hora: valorHora,
        valor_dia: valorDia,
        total_devengado: totalDevengado,
        creado_por: session.userId,
      })

      await deleteLiquidacionDetalles(liquidacionId)
      await insertLiquidacionDetalles(liquidacionId, detalles)
      liquidados++
    }

    revalidatePath("/nomina")
    revalidatePath(`/nomina/${periodoId}`)
    return { success: true, liquidados }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error liquidando período" }
  }
}

export async function cerrarPeriodoAction(periodoId: number): Promise<NominaActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await cerrarPeriodo(periodoId)
    revalidatePath("/nomina")
    revalidatePath(`/nomina/${periodoId}`)
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error cerrando período" }
  }
}
