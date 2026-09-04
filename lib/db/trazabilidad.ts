import { createVanessaClient } from "@/lib/supabase/vanessa"

// Trazabilidad 360 de las órdenes de producción: estado actual, avance por
// lote y prenda, línea de tiempo por etapa y tiempos de proceso (lead time).

export const ETAPAS = [
  { key: "diseno", label: "Diseño", color: "#a855f7" },
  { key: "corte", label: "Corte", color: "#f59e0b" },
  { key: "estampacion", label: "Estampación", color: "#ec4899" },
  { key: "confeccion", label: "Confección", color: "#14b8a6" },
  { key: "conteo", label: "Conteo", color: "#eab308" },
  { key: "empaque", label: "Empaque", color: "#22c55e" },
] as const

export type EtapaKey = (typeof ETAPAS)[number]["key"]

export interface HitoEtapa {
  etapa: EtapaKey
  label: string
  color: string
  // Primera y última fecha registrada de la etapa entre todos los lotes
  inicio: string | null
  fin: string | null
  // Días que tomó la etapa (fin - inicio); null si aún no hay datos
  dias: number | null
  completada: boolean
}

export interface PrendaTraza {
  id: number
  nombre: string
  estado: string
  estampador: string | null
  confeccionista: string | null
  contadas: number | null
  // Fechas y tiempos propios de cada pieza
  est_entrega: string | null
  est_retorno: string | null
  est_dias: number | null
  conf_entrega: string | null
  conf_retorno: string | null
  conf_dias: number | null
  dias_total: number | null
}

export interface LoteTraza {
  id: number
  nombre: string
  color: string | null
  cantidad_programada: number
  estado: string
  // Fechas por etapa del lote
  est_entrega: string | null
  est_retorno: string | null
  conf_entrega: string | null
  conf_retorno: string | null
  fecha_conteo: string | null
  total_contado: number | null
  total_empacado: number
  // Tiempos de proceso del lote (días)
  est_dias: number | null
  conf_dias: number | null
  dias_total: number | null
  prendas: PrendaTraza[]
}

export interface OrdenTraza {
  id: number
  numero_op: number
  referencia: string
  descripcion: string | null
  estado: string
  tipo_prenda: string
  fecha_programacion: string | null
  creado_en: string
  // Avance global 0-100 según el progreso de sus lotes
  avance: number
  etapa_actual: string
  total_lotes: number
  total_unidades: number
  // Días transcurridos desde la creación hasta el cierre (o hasta hoy)
  lead_time_dias: number | null
  cerrada: boolean
  lotes: LoteTraza[]
  hitos: HitoEtapa[]
}

// Peso de cada estado de lote para calcular el avance de la orden
const PESO_ESTADO: Record<string, number> = {
  cortado: 20,
  estampacion: 40,
  confeccion: 60,
  conteo: 75,
  empaque: 90,
  completado: 100,
  finalizado: 100,
}

function diasEntre(desde: string | null, hasta: string | null): number | null {
  if (!desde || !hasta) return null
  const a = new Date(desde).getTime()
  const b = new Date(hasta).getTime()
  if (isNaN(a) || isNaN(b)) return null
  return Math.max(0, Math.round((b - a) / 86400000))
}

function minFecha(fechas: Array<string | null>): string | null {
  const v = fechas.filter((f): f is string => !!f).sort()
  return v[0] ?? null
}
function maxFecha(fechas: Array<string | null>): string | null {
  const v = fechas.filter((f): f is string => !!f).sort()
  return v[v.length - 1] ?? null
}

// Carga la trazabilidad completa de todas las órdenes (o de una sola)
export async function getTrazabilidad(ordenId?: number): Promise<OrdenTraza[]> {
  const db = createVanessaClient()

  let qOrdenes = db
    .from("orden_produccion")
    .select("id, numero_op, referencia, descripcion, estado, tipo_prenda, fecha_programacion, creado_en")
    .order("numero_op", { ascending: false })
  if (ordenId != null) qOrdenes = qOrdenes.eq("id", ordenId)

  const { data: ordenes, error } = await qOrdenes
  if (error) throw new Error(error.message)
  const ordenesRows = (ordenes ?? []) as Array<{
    id: number
    numero_op: number
    referencia: string
    descripcion: string | null
    estado: string
    tipo_prenda: string
    fecha_programacion: string | null
    creado_en: string
  }>
  if (ordenesRows.length === 0) return []

  const ordenIds = ordenesRows.map((o) => o.id)

  // Lotes de todas las órdenes
  const { data: lotes } = await db
    .from("lote")
    .select("id, orden_id, numero_lote, descripcion, color, cantidad_programada, estado")
    .in("orden_id", ordenIds)
  const lotesRows = (lotes ?? []) as Array<{
    id: number
    orden_id: number
    numero_lote: number
    descripcion: string | null
    color: string | null
    cantidad_programada: number
    estado: string
  }>
  const loteIds = lotesRows.map((l) => l.id)

  // Datos de cada proceso, en paralelo
  const vacio = { data: [] as never[] }
  const [
    { data: disenos },
    { data: cortes },
    { data: estampaciones },
    { data: confecciones },
    { data: conteos },
    { data: empaques },
    { data: prendas },
  ] = await Promise.all([
    db.from("diseno").select("orden_id, aprobado, fecha_aprobacion").in("orden_id", ordenIds),
    db.from("corte").select("orden_id, fecha_programacion, fecha_corte").in("orden_id", ordenIds),
    loteIds.length
      ? db
          .from("estampacion")
          .select("lote_id, fecha_entrega_lote, fecha_retorno_lote")
          .in("lote_id", loteIds)
      : Promise.resolve(vacio),
    loteIds.length
      ? db
          .from("confeccion")
          .select("lote_id, fecha_entrega_lote, fecha_retorno_lote")
          .in("lote_id", loteIds)
      : Promise.resolve(vacio),
    loteIds.length
      ? db.from("conteo").select("lote_id, fecha_conteo, total_contado").in("lote_id", loteIds)
      : Promise.resolve(vacio),
    loteIds.length
      ? db.from("empaque_registro").select("lote_id, cantidad, fecha").in("lote_id", loteIds)
      : Promise.resolve(vacio),
    loteIds.length
      ? db
          .from("lote_prenda")
          .select(
            "id, lote_id, nombre, estado, nombre_estampador, nombre_confeccionista, cantidad_contada, est_fecha_entrega, est_fecha_retorno, conf_fecha_entrega, conf_fecha_retorno"
          )
          .in("lote_id", loteIds)
      : Promise.resolve(vacio),
  ])

  type EstConf = { lote_id: number; fecha_entrega_lote: string | null; fecha_retorno_lote: string | null }
  const estMap = new Map<number, EstConf>()
  for (const e of (estampaciones ?? []) as EstConf[]) estMap.set(e.lote_id, e)
  const confMap = new Map<number, EstConf>()
  for (const c of (confecciones ?? []) as EstConf[]) confMap.set(c.lote_id, c)

  const conteoMap = new Map<number, { fecha_conteo: string | null; total_contado: number }>()
  for (const c of (conteos ?? []) as Array<{
    lote_id: number
    fecha_conteo: string | null
    total_contado: number
  }>) {
    conteoMap.set(c.lote_id, { fecha_conteo: c.fecha_conteo, total_contado: c.total_contado })
  }

  const empMap = new Map<number, { total: number; fechas: string[] }>()
  for (const e of (empaques ?? []) as Array<{ lote_id: number; cantidad: number; fecha: string }>) {
    const acc = empMap.get(e.lote_id) ?? { total: 0, fechas: [] }
    acc.total += e.cantidad
    if (e.fecha) acc.fechas.push(e.fecha)
    empMap.set(e.lote_id, acc)
  }

  const prendasMap = new Map<number, PrendaTraza[]>()
  for (const p of (prendas ?? []) as Array<{
    id: number
    lote_id: number
    nombre: string
    estado: string
    nombre_estampador: string | null
    nombre_confeccionista: string | null
    cantidad_contada: number | null
    est_fecha_entrega: string | null
    est_fecha_retorno: string | null
    conf_fecha_entrega: string | null
    conf_fecha_retorno: string | null
  }>) {
    const arr = prendasMap.get(p.lote_id) ?? []
    const inicio = minFecha([p.est_fecha_entrega, p.conf_fecha_entrega])
    const fin = maxFecha([p.est_fecha_retorno, p.conf_fecha_retorno])
    arr.push({
      id: p.id,
      nombre: p.nombre,
      estado: p.estado,
      estampador: p.nombre_estampador,
      confeccionista: p.nombre_confeccionista,
      contadas: p.cantidad_contada,
      est_entrega: p.est_fecha_entrega,
      est_retorno: p.est_fecha_retorno,
      est_dias: diasEntre(p.est_fecha_entrega, p.est_fecha_retorno),
      conf_entrega: p.conf_fecha_entrega,
      conf_retorno: p.conf_fecha_retorno,
      conf_dias: diasEntre(p.conf_fecha_entrega, p.conf_fecha_retorno),
      dias_total: diasEntre(inicio, fin),
    })
    prendasMap.set(p.lote_id, arr)
  }

  const disenoMap = new Map<number, { aprobado: boolean; fecha_aprobacion: string | null }>()
  for (const d of (disenos ?? []) as Array<{
    orden_id: number
    aprobado: boolean
    fecha_aprobacion: string | null
  }>) {
    disenoMap.set(d.orden_id, { aprobado: d.aprobado, fecha_aprobacion: d.fecha_aprobacion })
  }

  const cortesMap = new Map<number, Array<{ fecha_programacion: string | null; fecha_corte: string | null }>>()
  for (const c of (cortes ?? []) as Array<{
    orden_id: number
    fecha_programacion: string | null
    fecha_corte: string | null
  }>) {
    const arr = cortesMap.get(c.orden_id) ?? []
    arr.push({ fecha_programacion: c.fecha_programacion, fecha_corte: c.fecha_corte })
    cortesMap.set(c.orden_id, arr)
  }

  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })

  return ordenesRows.map((o) => {
    const misLotes = lotesRows.filter((l) => l.orden_id === o.id)

    const lotesTraza: LoteTraza[] = misLotes.map((l) => {
      const est = estMap.get(l.id)
      const conf = confMap.get(l.id)
      const cnt = conteoMap.get(l.id)
      const emp = empMap.get(l.id)
      return {
        id: l.id,
        nombre: l.descripcion ?? `LOTE-${String(l.numero_lote).padStart(4, "0")}`,
        color: l.color,
        cantidad_programada: l.cantidad_programada,
        estado: l.estado,
        est_entrega: est?.fecha_entrega_lote ?? null,
        est_retorno: est?.fecha_retorno_lote ?? null,
        conf_entrega: conf?.fecha_entrega_lote ?? null,
        conf_retorno: conf?.fecha_retorno_lote ?? null,
        fecha_conteo: cnt?.fecha_conteo ?? null,
        total_contado: cnt?.total_contado ?? null,
        total_empacado: emp?.total ?? 0,
        est_dias: diasEntre(est?.fecha_entrega_lote ?? null, est?.fecha_retorno_lote ?? null),
        conf_dias: diasEntre(conf?.fecha_entrega_lote ?? null, conf?.fecha_retorno_lote ?? null),
        dias_total: diasEntre(
          minFecha([est?.fecha_entrega_lote ?? null, conf?.fecha_entrega_lote ?? null]),
          maxFecha([
            est?.fecha_retorno_lote ?? null,
            conf?.fecha_retorno_lote ?? null,
            cnt?.fecha_conteo ?? null,
            ...(emp?.fechas ?? []),
          ])
        ),
        prendas: prendasMap.get(l.id) ?? [],
      }
    })

    // ── Línea de tiempo: fechas reales de cada etapa ────────────
    const diseno = disenoMap.get(o.id)
    const misCortes = cortesMap.get(o.id) ?? []

    const hitos: HitoEtapa[] = ETAPAS.map((e) => {
      let inicio: string | null = null
      let fin: string | null = null

      if (e.key === "diseno") {
        inicio = o.creado_en ? o.creado_en.slice(0, 10) : null
        fin = diseno?.fecha_aprobacion ? diseno.fecha_aprobacion.slice(0, 10) : null
      } else if (e.key === "corte") {
        inicio = minFecha(misCortes.map((c) => c.fecha_programacion))
        fin = maxFecha(misCortes.map((c) => c.fecha_corte))
      } else if (e.key === "estampacion") {
        inicio = minFecha(lotesTraza.map((l) => l.est_entrega))
        fin = maxFecha(lotesTraza.map((l) => l.est_retorno))
      } else if (e.key === "confeccion") {
        inicio = minFecha(lotesTraza.map((l) => l.conf_entrega))
        fin = maxFecha(lotesTraza.map((l) => l.conf_retorno))
      } else if (e.key === "conteo") {
        inicio = minFecha(lotesTraza.map((l) => l.fecha_conteo))
        fin = maxFecha(lotesTraza.map((l) => l.fecha_conteo))
      } else {
        const todasFechas = misLotes.flatMap((l) => empMap.get(l.id)?.fechas ?? [])
        inicio = minFecha(todasFechas)
        fin = maxFecha(todasFechas)
      }

      return {
        etapa: e.key,
        label: e.label,
        color: e.color,
        inicio,
        fin,
        dias: diasEntre(inicio, fin ?? (inicio ? hoy : null)),
        completada: !!fin,
      }
    })

    // ── Avance y etapa actual ───────────────────────────────────
    const avance =
      lotesTraza.length > 0
        ? Math.round(
            lotesTraza.reduce((s, l) => s + (PESO_ESTADO[l.estado] ?? 0), 0) / lotesTraza.length
          )
        : o.estado === "terminada"
          ? 100
          : 0

    const cerrada = o.estado === "terminada" || avance >= 100
    const fechaCierre = cerrada ? maxFecha(hitos.map((h) => h.fin)) : null
    const lead = diasEntre(o.creado_en ? o.creado_en.slice(0, 10) : null, fechaCierre ?? hoy)

    return {
      id: o.id,
      numero_op: o.numero_op,
      referencia: o.referencia,
      descripcion: o.descripcion,
      estado: o.estado,
      tipo_prenda: o.tipo_prenda,
      fecha_programacion: o.fecha_programacion,
      creado_en: o.creado_en,
      avance,
      etapa_actual: o.estado,
      total_lotes: lotesTraza.length,
      total_unidades: lotesTraza.reduce((s, l) => s + l.cantidad_programada, 0),
      lead_time_dias: lead,
      cerrada,
      lotes: lotesTraza,
      hitos,
    }
  })
}

// Promedio de días por etapa sobre las órdenes con datos (para el gráfico)
export function promediosPorEtapa(ordenes: OrdenTraza[]): Array<{
  etapa: string
  label: string
  color: string
  dias: number
  muestras: number
}> {
  return ETAPAS.map((e) => {
    const valores = ordenes
      .map((o) => o.hitos.find((h) => h.etapa === e.key))
      .filter((h): h is HitoEtapa => !!h && h.dias != null && h.completada)
      .map((h) => h.dias as number)
    const dias =
      valores.length > 0
        ? Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 10) / 10
        : 0
    return { etapa: e.key, label: e.label, color: e.color, dias, muestras: valores.length }
  })
}
