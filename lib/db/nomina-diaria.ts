import { createVanessaClient } from "@/lib/supabase/vanessa"

// Nómina diaria: lo que se le paga a cada persona día por día.
//
// Reglas (normativa colombiana 2026, Ley 2466 de 2025):
// - Personal con salario: se paga el día si registró asistencia.
// - Personal de empaque (cargo EMPACADOR): se paga a destajo, según las
//   prendas empacadas × el valor por prenda configurado.
// - Domingo: si la persona trabajó los 6 días de la semana, se le paga el
//   domingo como día de descanso remunerado, aunque no asista.
// - Si trabaja el domingo o un festivo, ese día lleva el recargo legal
//   (1.9 desde julio 2026 según la configuración vigente).

export interface ConfigNominaGeneral {
  id: number
  vigente_desde: string
  valor_prenda_empaque: number
  salario_minimo: number
  auxilio_transporte: number
  tope_auxilio_smmlv: number
  porc_salud_empleado: number
  porc_pension_empleado: number
  porc_salud_empleador: number
  porc_pension_empleador: number
  porc_arl: number
  porc_caja: number
  porc_icbf: number
  porc_sena: number
  porc_cesantias: number
  porc_int_cesantias: number
  porc_prima: number
  porc_vacaciones: number
  dias_semana_para_dominical: number
}

export type ConceptoDia =
  | "jornada"
  | "destajo_empaque"
  | "dominical_descanso"
  | "dominical_trabajado"
  | "festivo_trabajado"
  | "sin_pago"

export interface DiaNomina {
  fecha: string
  dia_semana: number // 0 = domingo
  es_domingo: boolean
  es_festivo: boolean
  asistio: boolean
  horas_trabajadas: number
  horas_extra: number
  // Solo para empaque
  unidades_empacadas: number
  // Pago del día
  concepto: ConceptoDia
  valor_base: number
  valor_recargo: number
  valor_total: number
  detalle: string
  cerrado: boolean
}

export interface NominaPersona {
  persona_id: number
  nombre: string
  documento: string
  cargo: string | null
  tipo_pago: string
  es_empacador: boolean
  salario: number
  valor_dia: number
  dias: DiaNomina[]
  total_dias_trabajados: number
  total_unidades: number
  total_devengado: number
  // Estimación de aportes y prestaciones sobre lo devengado
  auxilio_transporte: number
  deduccion_salud: number
  deduccion_pension: number
  neto_a_pagar: number
  costo_empleador: number
}

const CARGO_EMPAQUE = "EMPACADOR"

export function esCargoEmpaque(cargo: string | null): boolean {
  return (cargo ?? "").trim().toUpperCase().startsWith(CARGO_EMPAQUE)
}

export async function getConfigGeneral(): Promise<ConfigNominaGeneral | null> {
  const db = createVanessaClient()
  const { data } = await db
    .from("config_nomina_general")
    .select("*")
    .order("vigente_desde", { ascending: false })
    .limit(1)
    .maybeSingle()
  return data as ConfigNominaGeneral | null
}

export async function updateConfigGeneral(
  id: number,
  campos: Partial<Omit<ConfigNominaGeneral, "id" | "vigente_desde">>
): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("config_nomina_general").update(campos).eq("id", id)
  if (error) throw new Error(error.message)
}

// Lista de fechas del rango (inclusive)
function rangoFechas(desde: string, hasta: string): string[] {
  const out: string[] = []
  const [y1, m1, d1] = desde.split("-").map(Number)
  const [y2, m2, d2] = hasta.split("-").map(Number)
  const ini = new Date(Date.UTC(y1, m1 - 1, d1))
  const fin = new Date(Date.UTC(y2, m2 - 1, d2))
  const cursor = new Date(ini)
  while (cursor <= fin) {
    out.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

function diaSemana(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

// Lunes de la semana a la que pertenece una fecha (para la regla del domingo)
function claveSemana(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dow = dt.getUTCDay()
  const diff = dow === 0 ? -6 : 1 - dow
  dt.setUTCDate(dt.getUTCDate() + diff)
  return dt.toISOString().slice(0, 10)
}

// Calcula la nómina diaria de todas las personas en un rango
export async function getNominaDiaria(input: {
  desde: string
  hasta: string
  personaId?: number | null
}): Promise<{ personas: NominaPersona[]; config: ConfigNominaGeneral | null }> {
  const db = createVanessaClient()
  const config = await getConfigGeneral()

  let qPersonas = db
    .from("persona")
    .select("id, nombre, documento, cargo, salario, tipo_pago, dias_mes, estado")
    .eq("estado", "activo")
    .order("nombre")
  if (input.personaId) qPersonas = qPersonas.eq("id", input.personaId)

  const { data: personasData, error } = await qPersonas
  if (error) throw new Error(error.message)
  const personas = (personasData ?? []) as Array<{
    id: number
    nombre: string
    documento: string
    cargo: string | null
    salario: number
    tipo_pago: string
    dias_mes: number
  }>
  if (personas.length === 0) return { personas: [], config }

  const personaIds = personas.map((p) => p.id)
  const fechas = rangoFechas(input.desde, input.hasta)

  // Recargo dominical/festivo vigente (Ley 2466: 1.9 desde julio 2026)
  const { data: cfgVigente } = await db
    .from("configuracion_nomina")
    .select("factor_dominical_festivo")
    .lte("vigente_desde", input.hasta)
    .order("vigente_desde", { ascending: false })
    .limit(1)
    .maybeSingle()
  const factorDominical =
    Number((cfgVigente as { factor_dominical_festivo: number } | null)?.factor_dominical_festivo) ||
    1.9

  const [{ data: asistencias }, { data: empaques }, { data: festivos }, { data: cierres }] =
    await Promise.all([
      db
        .from("asistencia_dia")
        .select("persona_id, fecha, trabajado, horas_trabajadas, horas_extra, es_festivo, es_domingo")
        .in("persona_id", personaIds)
        .gte("fecha", input.desde)
        .lte("fecha", input.hasta),
      db
        .from("empaque_registro")
        .select("persona_id, fecha, cantidad")
        .in("persona_id", personaIds)
        .gte("fecha", input.desde)
        .lte("fecha", input.hasta),
      db.from("festivo").select("fecha").gte("fecha", input.desde).lte("fecha", input.hasta),
      db
        .from("cierre_nomina_dia")
        .select("persona_id, fecha")
        .in("persona_id", personaIds)
        .gte("fecha", input.desde)
        .lte("fecha", input.hasta),
    ])

  const asisMap = new Map<string, { trabajado: boolean; horas: number; extra: number }>()
  for (const a of (asistencias ?? []) as Array<{
    persona_id: number
    fecha: string
    trabajado: boolean
    horas_trabajadas: number
    horas_extra: number
  }>) {
    asisMap.set(`${a.persona_id}|${a.fecha}`, {
      trabajado: a.trabajado,
      horas: Number(a.horas_trabajadas) || 0,
      extra: Number(a.horas_extra) || 0,
    })
  }

  const empaqueMap = new Map<string, number>()
  for (const e of (empaques ?? []) as Array<{
    persona_id: number
    fecha: string
    cantidad: number
  }>) {
    const k = `${e.persona_id}|${e.fecha}`
    empaqueMap.set(k, (empaqueMap.get(k) ?? 0) + e.cantidad)
  }

  const festivosSet = new Set(
    ((festivos ?? []) as Array<{ fecha: string }>).map((f) => f.fecha)
  )
  const cierresSet = new Set(
    ((cierres ?? []) as Array<{ persona_id: number; fecha: string }>).map(
      (c) => `${c.persona_id}|${c.fecha}`
    )
  )

  const valorPrenda = Number(config?.valor_prenda_empaque) || 0
  const diasParaDominical = Number(config?.dias_semana_para_dominical) || 6

  const resultado: NominaPersona[] = personas.map((p) => {
    const empacador = esCargoEmpaque(p.cargo)
    const diasMes = p.dias_mes > 0 ? p.dias_mes : 30
    const valorDia = empacador ? 0 : Math.round(Number(p.salario) / diasMes)

    // Días trabajados por semana, para la regla del domingo
    const trabajadosPorSemana = new Map<string, number>()
    for (const f of fechas) {
      const a = asisMap.get(`${p.id}|${f}`)
      if (a?.trabajado && diaSemana(f) !== 0) {
        const k = claveSemana(f)
        trabajadosPorSemana.set(k, (trabajadosPorSemana.get(k) ?? 0) + 1)
      }
    }

    const dias: DiaNomina[] = fechas.map((f) => {
      const dow = diaSemana(f)
      const esDomingo = dow === 0
      const esFestivo = festivosSet.has(f)
      const a = asisMap.get(`${p.id}|${f}`)
      const asistio = a?.trabajado === true
      const unidades = empaqueMap.get(`${p.id}|${f}`) ?? 0

      let concepto: ConceptoDia = "sin_pago"
      let base = 0
      let recargo = 0
      let detalle = "Sin asistencia registrada"

      if (empacador) {
        // Pago a destajo: unidades empacadas × valor por prenda
        if (unidades > 0) {
          base = unidades * valorPrenda
          concepto = "destajo_empaque"
          detalle = `${unidades.toLocaleString("es-CO")} prendas × $${valorPrenda.toLocaleString("es-CO")}`
          if (esDomingo || esFestivo) {
            recargo = Math.round(base * (factorDominical - 1))
            concepto = esDomingo ? "dominical_trabajado" : "festivo_trabajado"
            detalle += ` · recargo ${esDomingo ? "dominical" : "festivo"} ×${factorDominical}`
          }
        } else if (asistio) {
          detalle = "Asistió sin empaque registrado"
        } else {
          detalle = "Sin empaque registrado"
        }
      } else if (asistio) {
        base = valorDia
        concepto = "jornada"
        detalle = `Jornada del día`
        if (esDomingo || esFestivo) {
          recargo = Math.round(valorDia * (factorDominical - 1))
          concepto = esDomingo ? "dominical_trabajado" : "festivo_trabajado"
          detalle = `${esDomingo ? "Dominical" : "Festivo"} trabajado ×${factorDominical}`
        }
        if (a && a.extra > 0) detalle += ` · ${a.extra} h extra`
      } else if (esDomingo) {
        // Descanso dominical remunerado al completar la semana
        const completos = trabajadosPorSemana.get(claveSemana(f)) ?? 0
        if (completos >= diasParaDominical) {
          // Para empaque se remunera con el promedio diario de la semana
          if (empacador) {
            const semana = claveSemana(f)
            let totalSemana = 0
            let diasConEmpaque = 0
            for (const g of fechas) {
              if (claveSemana(g) !== semana || diaSemana(g) === 0) continue
              const u = empaqueMap.get(`${p.id}|${g}`) ?? 0
              if (u > 0) {
                totalSemana += u * valorPrenda
                diasConEmpaque++
              }
            }
            base = diasConEmpaque > 0 ? Math.round(totalSemana / diasConEmpaque) : 0
          } else {
            base = valorDia
          }
          concepto = "dominical_descanso"
          detalle = `Descanso remunerado (trabajó ${completos} días la semana)`
        } else {
          detalle = `Domingo sin derecho (trabajó ${completos} de ${diasParaDominical} días)`
        }
      }

      return {
        fecha: f,
        dia_semana: dow,
        es_domingo: esDomingo,
        es_festivo: esFestivo,
        asistio,
        horas_trabajadas: a?.horas ?? 0,
        horas_extra: a?.extra ?? 0,
        unidades_empacadas: unidades,
        concepto,
        valor_base: base,
        valor_recargo: recargo,
        valor_total: base + recargo,
        detalle,
        cerrado: cierresSet.has(`${p.id}|${f}`),
      }
    })

    const totalDevengado = dias.reduce((s, d) => s + d.valor_total, 0)
    const totalDiasTrabajados = dias.filter((d) => d.asistio || d.unidades_empacadas > 0).length
    const totalUnidades = dias.reduce((s, d) => s + d.unidades_empacadas, 0)

    // Auxilio de transporte: proporcional a los días del periodo, si el
    // salario no supera el tope legal (2 SMMLV)
    const smmlv = Number(config?.salario_minimo) || 0
    const tope = Number(config?.tope_auxilio_smmlv) || 2
    const tieneAuxilio = smmlv > 0 && Number(p.salario) <= smmlv * tope
    const auxilioMes = Number(config?.auxilio_transporte) || 0
    const auxilio =
      tieneAuxilio && totalDiasTrabajados > 0
        ? Math.round((auxilioMes / diasMes) * totalDiasTrabajados)
        : 0

    // Deducciones del trabajador (no aplican sobre el auxilio de transporte)
    const salud = Math.round(totalDevengado * ((Number(config?.porc_salud_empleado) || 0) / 100))
    const pension = Math.round(
      totalDevengado * ((Number(config?.porc_pension_empleado) || 0) / 100)
    )

    // Costo total para el empleador: devengado + auxilio + aportes + prestaciones
    const porcEmpleador =
      (Number(config?.porc_salud_empleador) || 0) +
      (Number(config?.porc_pension_empleador) || 0) +
      (Number(config?.porc_arl) || 0) +
      (Number(config?.porc_caja) || 0) +
      (Number(config?.porc_icbf) || 0) +
      (Number(config?.porc_sena) || 0) +
      (Number(config?.porc_cesantias) || 0) +
      (Number(config?.porc_int_cesantias) || 0) +
      (Number(config?.porc_prima) || 0) +
      (Number(config?.porc_vacaciones) || 0)

    return {
      persona_id: p.id,
      nombre: p.nombre,
      documento: p.documento,
      cargo: p.cargo,
      tipo_pago: p.tipo_pago,
      es_empacador: empacador,
      salario: Number(p.salario),
      valor_dia: valorDia,
      dias,
      total_dias_trabajados: totalDiasTrabajados,
      total_unidades: totalUnidades,
      total_devengado: totalDevengado,
      auxilio_transporte: auxilio,
      deduccion_salud: salud,
      deduccion_pension: pension,
      neto_a_pagar: totalDevengado + auxilio - salud - pension,
      costo_empleador:
        totalDevengado + auxilio + Math.round(totalDevengado * (porcEmpleador / 100)),
    }
  })

  return { personas: resultado, config }
}

// Cierra el pago de un día para una persona
export async function cerrarDiaNomina(input: {
  persona_id: number
  fecha: string
  valor_pagado: number
  observacion?: string | null
  cerrado_por: number
}): Promise<void> {
  const db = createVanessaClient()
  const { data: existente } = await db
    .from("cierre_nomina_dia")
    .select("id")
    .eq("persona_id", input.persona_id)
    .eq("fecha", input.fecha)
    .maybeSingle()

  if (existente) {
    const { error } = await db
      .from("cierre_nomina_dia")
      .update({
        valor_pagado: input.valor_pagado,
        observacion: input.observacion?.trim() || null,
      })
      .eq("id", (existente as { id: number }).id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await db.from("cierre_nomina_dia").insert({
      persona_id: input.persona_id,
      fecha: input.fecha,
      valor_pagado: input.valor_pagado,
      observacion: input.observacion?.trim() || null,
      cerrado_por: input.cerrado_por,
    })
    if (error) throw new Error(error.message)
  }
}

export async function reabrirDiaNomina(personaId: number, fecha: string): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db
    .from("cierre_nomina_dia")
    .delete()
    .eq("persona_id", personaId)
    .eq("fecha", fecha)
  if (error) throw new Error(error.message)
}
