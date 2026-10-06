import { createVanessaClient } from "@/lib/supabase/vanessa"

// Trazabilidad 360 de las órdenes de producción: estado actual, avance por
// lote y prenda, línea de tiempo por etapa, tiempos de proceso (lead time)
// y, etapa por etapa, lo programado frente a lo real.

// Diseño salio del flujo (la OP va de programada a corte), pero la etapa
// se conserva aqui: las ordenes que ya pasaron por ahi tienen su fecha de
// aprobacion y perderian ese hito de su historia.
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

// Programado vs real de un lote o de una pieza, etapa por etapa. Es lo que
// la gerencia necesita ver de un vistazo: cuanto se programo en la OP,
// cuanto se corto, cuanto volvio de estampacion y de confeccion, cuanto se
// conto y cuanto se empaco. null = esa etapa aun no registro nada.
export interface RealEtapas {
  programado: number
  cortado: number | null
  est_recibido: number | null
  conf_recibido: number | null
  contado: number | null
  imperfectos_conteo: number
  empacado: number | null
  imperfectos_empaque: number
}

// Ultimo dato real disponible en la cadena, para la desviacion global
export function ultimoReal(r: RealEtapas): { etapa: EtapaKey; valor: number } | null {
  if (r.empacado != null) return { etapa: "empaque", valor: r.empacado }
  if (r.contado != null) return { etapa: "conteo", valor: r.contado }
  if (r.conf_recibido != null) return { etapa: "confeccion", valor: r.conf_recibido }
  if (r.est_recibido != null) return { etapa: "estampacion", valor: r.est_recibido }
  if (r.cortado != null) return { etapa: "corte", valor: r.cortado }
  return null
}

// Peso de cada estado de pieza para su avance individual
const PESO_PRENDA: Record<string, number> = {
  estampacion: 33,
  confeccion: 66,
  conteo: 90,
  completado: 100,
}

export interface PrendaTraza {
  id: number
  nombre: string
  estado: string
  // Avance 0-100 de la pieza según su etapa
  avance: number
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
  real: RealEtapas
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
  real: RealEtapas
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

// Supabase corta cada consulta en 1000 filas: las tablas de detalle
// (capas reales, conteo, empaque) se traen por paginas.
async function todas<T>(
  pagina: (desde: number, hasta: number) => PromiseLike<{
    data: unknown
    error: { message: string } | null
  }>
): Promise<T[]> {
  const out: T[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await pagina(desde, desde + 999)
    if (error) throw new Error(error.message)
    const filas = (data ?? []) as T[]
    out.push(...filas)
    if (filas.length < 1000) break
  }
  return out
}

type EstConf = {
  lote_id: number
  fecha_entrega_lote: string | null
  fecha_retorno_lote: string | null
  cantidad: number | null
}
type ConteoRow = { id: number; lote_id: number; fecha_conteo: string | null; total_contado: number }
type DetalleRow = { conteo_id: number; prenda_id: number | null; cantidad_contada: number; imperfectos: number | null }
type EmpaqueRow = { lote_id: number; prenda_id: number | null; cantidad: number; imperfectos: number | null; fecha: string }
type CapaRow = { orden_id: number; lote_nombre: string; slot: number; capas_programadas: number; capas_reales: number }
type PrendaRow = {
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
  est_cantidad_recibida: number | null
  conf_cantidad_recibida: number | null
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
  const lotesRows = await todas<{
    id: number
    orden_id: number
    numero_lote: number
    descripcion: string | null
    color: string | null
    cantidad_programada: number
    estado: string
  }>((d, h) =>
    db
      .from("lote")
      .select("id, orden_id, numero_lote, descripcion, color, cantidad_programada, estado")
      .in("orden_id", ordenIds)
      .order("id")
      .range(d, h)
  )
  const loteIds = lotesRows.map((l) => l.id)

  // Datos de cada proceso, en paralelo
  const vacio = { data: [] as never[], error: null }
  const [
    { data: disenos },
    { data: cortes },
    { data: estampaciones },
    { data: confecciones },
    { data: conteos },
    empaques,
    prendas,
    curvas,
    capas,
  ] = await Promise.all([
    db.from("diseno").select("orden_id, aprobado, fecha_aprobacion").in("orden_id", ordenIds),
    db.from("corte").select("orden_id, fecha_programacion, fecha_corte").in("orden_id", ordenIds),
    loteIds.length
      ? db
          .from("estampacion")
          .select("lote_id, fecha_entrega_lote, fecha_retorno_lote, cantidad:cantidad_recibida")
          .in("lote_id", loteIds)
          .limit(5000)
      : Promise.resolve(vacio),
    loteIds.length
      ? db
          .from("confeccion")
          .select("lote_id, fecha_entrega_lote, fecha_retorno_lote, cantidad:cantidad_reconfirmada")
          .in("lote_id", loteIds)
          .limit(5000)
      : Promise.resolve(vacio),
    loteIds.length
      ? db
          .from("conteo")
          .select("id, lote_id, fecha_conteo, total_contado")
          .in("lote_id", loteIds)
          .limit(5000)
      : Promise.resolve(vacio),
    loteIds.length
      ? todas<EmpaqueRow>((d, h) =>
          db
            .from("empaque_registro")
            .select("lote_id, prenda_id, cantidad, imperfectos, fecha")
            .in("lote_id", loteIds)
            .order("id")
            .range(d, h)
        )
      : Promise.resolve([] as EmpaqueRow[]),
    loteIds.length
      ? todas<PrendaRow>((d, h) =>
          db
            .from("lote_prenda")
            .select(
              "id, lote_id, nombre, estado, nombre_estampador, nombre_confeccionista, cantidad_contada, est_fecha_entrega, est_fecha_retorno, conf_fecha_entrega, conf_fecha_retorno, est_cantidad_recibida, conf_cantidad_recibida"
            )
            .in("lote_id", loteIds)
            .order("id")
            .range(d, h)
        )
      : Promise.resolve([] as PrendaRow[]),
    todas<{ orden_id: number }>((d, h) =>
      db.from("curva_talla").select("orden_id").in("orden_id", ordenIds).order("id").range(d, h)
    ),
    todas<CapaRow>((d, h) =>
      db
        .from("corte_capa_real")
        .select("orden_id, lote_nombre, slot, capas_programadas, capas_reales")
        .in("orden_id", ordenIds)
        .order("id")
        .range(d, h)
    ),
  ])

  // El detalle del conteo cuelga del conteo, no del lote
  const conteosRows = (conteos ?? []) as ConteoRow[]
  const conteoIds = conteosRows.map((c) => c.id)
  const detalles = conteoIds.length
    ? await todas<DetalleRow>((d, h) =>
        db
          .from("conteo_detalle")
          .select("conteo_id, prenda_id, cantidad_contada, imperfectos")
          .in("conteo_id", conteoIds)
          .order("id")
          .range(d, h)
      )
    : []

  // ── Indices ────────────────────────────────────────────────────
  const estMap = new Map<number, EstConf>()
  for (const e of (estampaciones ?? []) as EstConf[]) estMap.set(e.lote_id, e)
  const confMap = new Map<number, EstConf>()
  for (const c of (confecciones ?? []) as EstConf[]) confMap.set(c.lote_id, c)

  const conteoMap = new Map<number, ConteoRow>()
  for (const c of conteosRows) conteoMap.set(c.lote_id, c)

  const detallePorConteo = new Map<number, DetalleRow[]>()
  for (const d of detalles) {
    const arr = detallePorConteo.get(d.conteo_id) ?? []
    arr.push(d)
    detallePorConteo.set(d.conteo_id, arr)
  }

  type AcumEmp = { total: number; imperfectos: number; fechas: string[]; registros: number }
  const empMap = new Map<number, AcumEmp>()
  const empPorPrenda = new Map<number, AcumEmp>()
  for (const e of empaques) {
    const acc = empMap.get(e.lote_id) ?? { total: 0, imperfectos: 0, fechas: [], registros: 0 }
    acc.total += e.cantidad
    acc.imperfectos += e.imperfectos ?? 0
    acc.registros++
    if (e.fecha) acc.fechas.push(e.fecha)
    empMap.set(e.lote_id, acc)
    if (e.prenda_id != null) {
      const ap = empPorPrenda.get(e.prenda_id) ?? { total: 0, imperfectos: 0, fechas: [], registros: 0 }
      ap.total += e.cantidad
      ap.imperfectos += e.imperfectos ?? 0
      ap.registros++
      empPorPrenda.set(e.prenda_id, ap)
    }
  }

  // Tallas por orden: cada capa cortada rinde una prenda por talla
  const tallasPorOrden = new Map<number, number>()
  for (const c of curvas) tallasPorOrden.set(c.orden_id, (tallasPorOrden.get(c.orden_id) ?? 0) + 1)

  // Capas programadas y reales por lote. Las capas se registran una sola vez
  // en el material de referencia (slot 1, o el menor que exista).
  const capasPorLote = new Map<string, Map<number, { prog: number; real: number }>>()
  for (const c of capas) {
    const key = `${c.orden_id}|${c.lote_nombre}`
    const porSlot = capasPorLote.get(key) ?? new Map<number, { prog: number; real: number }>()
    const acc = porSlot.get(c.slot) ?? { prog: 0, real: 0 }
    acc.prog += c.capas_programadas
    acc.real += c.capas_reales
    porSlot.set(c.slot, acc)
    capasPorLote.set(key, porSlot)
  }
  function capasDe(ordenIdLote: number, loteNombre: string | null) {
    const porSlot = capasPorLote.get(`${ordenIdLote}|${loteNombre ?? ""}`)
    if (!porSlot) return null
    const slotRef = porSlot.has(1) ? 1 : Math.min(...porSlot.keys())
    return porSlot.get(slotRef) ?? null
  }

  const prendasPorLote = new Map<number, PrendaRow[]>()
  for (const p of prendas) {
    const arr = prendasPorLote.get(p.lote_id) ?? []
    arr.push(p)
    prendasPorLote.set(p.lote_id, arr)
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
    const tallas = tallasPorOrden.get(o.id) ?? 0

    const lotesTraza: LoteTraza[] = misLotes.map((l) => {
      const est = estMap.get(l.id)
      const conf = confMap.get(l.id)
      const cnt = conteoMap.get(l.id)
      const emp = empMap.get(l.id)
      const det = cnt ? (detallePorConteo.get(cnt.id) ?? []) : []

      // Programado: lo de la OP (capas programadas x tallas). Antes de que
      // corte registre, lote.cantidad_programada ES lo programado; despues
      // pasa a ser lo cortado, por eso lo programado se toma de las capas.
      const cap = capasDe(o.id, l.descripcion)
      const programado = cap && tallas > 0 ? cap.prog * tallas : l.cantidad_programada
      const cortado = cap && tallas > 0 ? cap.real * tallas : null

      const contadoLote = cnt
        ? det.length > 0
          ? det.reduce((s, d) => s + d.cantidad_contada, 0)
          : cnt.total_contado
        : null
      const realLote: RealEtapas = {
        programado,
        cortado,
        est_recibido: est?.cantidad ?? null,
        conf_recibido: conf?.cantidad ?? null,
        contado: contadoLote,
        imperfectos_conteo: det.reduce((s, d) => s + (d.imperfectos ?? 0), 0),
        empacado: emp && emp.registros > 0 ? emp.total : null,
        imperfectos_empaque: emp?.imperfectos ?? 0,
      }

      const prendasTraza: PrendaTraza[] = (prendasPorLote.get(l.id) ?? []).map((p) => {
        const inicio = minFecha([p.est_fecha_entrega, p.conf_fecha_entrega])
        const fin = maxFecha([p.est_fecha_retorno, p.conf_fecha_retorno])
        const detPieza = det.filter((d) => d.prenda_id === p.id)
        const empPieza = empPorPrenda.get(p.id)
        return {
          id: p.id,
          nombre: p.nombre,
          estado: p.estado,
          avance: PESO_PRENDA[p.estado] ?? 0,
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
          real: {
            // Cada pieza del conjunto lleva las mismas unidades que el lote
            programado,
            cortado,
            est_recibido: p.est_cantidad_recibida,
            conf_recibido: p.conf_cantidad_recibida,
            contado:
              detPieza.length > 0
                ? detPieza.reduce((s, d) => s + d.cantidad_contada, 0)
                : p.cantidad_contada,
            imperfectos_conteo: detPieza.reduce((s, d) => s + (d.imperfectos ?? 0), 0),
            empacado: empPieza && empPieza.registros > 0 ? empPieza.total : null,
            imperfectos_empaque: empPieza?.imperfectos ?? 0,
          },
        }
      })

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
        real: realLote,
        prendas: prendasTraza,
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
      total_unidades: lotesTraza.reduce((s, l) => s + l.real.programado, 0),
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

// ── Filas planas de programado vs real (una por lote, o por pieza en los
// conjuntos): es la tabla de control de la gerencia y lo que se exporta.
export interface FilaControl {
  orden_id: number
  numero_op: number
  referencia: string
  tipo_prenda: string
  estado_op: string
  lote_id: number
  lote: string
  pieza: string | null
  estado: string
  real: RealEtapas
  // Desviacion del ultimo real disponible frente a lo programado
  ultimo: { etapa: EtapaKey; valor: number } | null
  desviacion: number | null
}

export function filasControl(ordenes: OrdenTraza[]): FilaControl[] {
  const out: FilaControl[] = []
  for (const o of ordenes) {
    for (const l of o.lotes) {
      const base = {
        orden_id: o.id,
        numero_op: o.numero_op,
        referencia: o.referencia,
        tipo_prenda: o.tipo_prenda,
        estado_op: o.estado,
        lote_id: l.id,
        lote: l.nombre,
      }
      if (o.tipo_prenda === "conjunto" && l.prendas.length > 0) {
        for (const p of l.prendas) {
          const ultimo = ultimoReal(p.real)
          out.push({
            ...base,
            pieza: p.nombre,
            estado: p.estado,
            real: p.real,
            ultimo,
            desviacion: ultimo ? ultimo.valor - p.real.programado : null,
          })
        }
      } else {
        const ultimo = ultimoReal(l.real)
        out.push({
          ...base,
          pieza: null,
          estado: l.estado,
          real: l.real,
          ultimo,
          desviacion: ultimo ? ultimo.valor - l.real.programado : null,
        })
      }
    }
  }
  return out
}
