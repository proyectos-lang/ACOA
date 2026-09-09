import { createVanessaClient } from "@/lib/supabase/vanessa"

// Liquidación de empaque: lo que empacó cada persona por día, con su
// detalle por talla y lote, y el cierre del día.

export interface CierreEmpaqueRow {
  id: number
  persona_id: number
  fecha: string
  total_unidades: number
  total_imperfectos: number
  total_valor: number
  observacion: string | null
  cerrado_en: string
}

// Una línea del detalle: qué empacó, de qué lote y talla
export interface DetalleEmpaqueDia {
  registro_id: number
  lote_id: number
  lote_nombre: string
  numero_op: number
  referencia: string
  talla: string
  cantidad: number
  imperfectos: number
  precio_unidad: number
  valor_total: number
}

// Un día de trabajo de una persona
export interface DiaEmpaquePersona {
  persona_id: number
  persona_nombre: string
  persona_documento: string
  fecha: string
  total_unidades: number
  total_imperfectos: number
  total_valor: number
  // Resumen por talla del día
  por_talla: Array<{ talla: string; cantidad: number; imperfectos: number }>
  detalle: DetalleEmpaqueDia[]
  cierre: CierreEmpaqueRow | null
}

// Carga los días trabajados en un rango, agrupados por persona y fecha
export async function getLiquidacionEmpaque(input: {
  desde: string
  hasta: string
  personaId?: number | null
}): Promise<DiaEmpaquePersona[]> {
  const db = createVanessaClient()

  let q = db
    .from("empaque_registro")
    .select("id, lote_id, persona_id, talla, cantidad, imperfectos, precio_unidad, valor_total, fecha")
    .gte("fecha", input.desde)
    .lte("fecha", input.hasta)
    .order("fecha", { ascending: false })
  if (input.personaId) q = q.eq("persona_id", input.personaId)

  const { data: registros, error } = await q
  if (error) throw new Error(error.message)
  const filas = (registros ?? []) as Array<{
    id: number
    lote_id: number
    persona_id: number
    talla: string
    cantidad: number
    imperfectos: number | null
    precio_unidad: number
    valor_total: number
    fecha: string
  }>
  if (filas.length === 0) return []

  const personaIds = [...new Set(filas.map((f) => f.persona_id))]
  const loteIds = [...new Set(filas.map((f) => f.lote_id))]

  const [{ data: personas }, { data: lotes }, { data: cierres }] = await Promise.all([
    db.from("persona").select("id, nombre, documento").in("id", personaIds),
    db.from("lote").select("id, numero_lote, descripcion, orden_id").in("id", loteIds),
    db
      .from("cierre_empaque")
      .select("id, persona_id, fecha, total_unidades, total_imperfectos, total_valor, observacion, cerrado_en")
      .gte("fecha", input.desde)
      .lte("fecha", input.hasta),
  ])

  const personaMap = new Map(
    ((personas ?? []) as Array<{ id: number; nombre: string; documento: string }>).map((p) => [
      p.id,
      p,
    ])
  )

  const lotesRows = (lotes ?? []) as Array<{
    id: number
    numero_lote: number
    descripcion: string | null
    orden_id: number
  }>
  const ordenIds = [...new Set(lotesRows.map((l) => l.orden_id))]
  const { data: ops } = await db
    .from("orden_produccion")
    .select("id, numero_op, referencia")
    .in("id", ordenIds)
  const opMap = new Map(
    ((ops ?? []) as Array<{ id: number; numero_op: number; referencia: string }>).map((o) => [
      o.id,
      o,
    ])
  )
  const loteMap = new Map(
    lotesRows.map((l) => [
      l.id,
      {
        nombre: l.descripcion ?? `LOTE-${String(l.numero_lote).padStart(4, "0")}`,
        orden: opMap.get(l.orden_id),
      },
    ])
  )

  const cierreMap = new Map<string, CierreEmpaqueRow>()
  for (const c of (cierres ?? []) as CierreEmpaqueRow[]) {
    cierreMap.set(`${c.persona_id}|${c.fecha}`, c)
  }

  // Agrupar por persona + fecha
  const dias = new Map<string, DiaEmpaquePersona>()
  for (const f of filas) {
    const key = `${f.persona_id}|${f.fecha}`
    const persona = personaMap.get(f.persona_id)
    const lote = loteMap.get(f.lote_id)

    let dia = dias.get(key)
    if (!dia) {
      dia = {
        persona_id: f.persona_id,
        persona_nombre: persona?.nombre ?? `#${f.persona_id}`,
        persona_documento: persona?.documento ?? "",
        fecha: f.fecha,
        total_unidades: 0,
        total_imperfectos: 0,
        total_valor: 0,
        por_talla: [],
        detalle: [],
        cierre: cierreMap.get(key) ?? null,
      }
      dias.set(key, dia)
    }

    dia.total_unidades += f.cantidad
    dia.total_imperfectos += f.imperfectos ?? 0
    dia.total_valor += Number(f.valor_total) || 0
    dia.detalle.push({
      registro_id: f.id,
      lote_id: f.lote_id,
      lote_nombre: lote?.nombre ?? `Lote ${f.lote_id}`,
      numero_op: lote?.orden?.numero_op ?? 0,
      referencia: lote?.orden?.referencia ?? "—",
      talla: f.talla,
      cantidad: f.cantidad,
      imperfectos: f.imperfectos ?? 0,
      precio_unidad: Number(f.precio_unidad) || 0,
      valor_total: Number(f.valor_total) || 0,
    })
  }

  // Resumen por talla de cada día
  for (const dia of dias.values()) {
    const porTalla = new Map<string, { talla: string; cantidad: number; imperfectos: number }>()
    for (const d of dia.detalle) {
      const k = d.talla.trim().toLowerCase()
      const prev = porTalla.get(k)
      if (prev) {
        prev.cantidad += d.cantidad
        prev.imperfectos += d.imperfectos
      } else {
        porTalla.set(k, {
          talla: d.talla.trim(),
          cantidad: d.cantidad,
          imperfectos: d.imperfectos,
        })
      }
    }
    dia.por_talla = [...porTalla.values()].sort((a, b) => a.talla.localeCompare(b.talla, "es"))
  }

  return [...dias.values()].sort(
    (a, b) => b.fecha.localeCompare(a.fecha) || a.persona_nombre.localeCompare(b.persona_nombre)
  )
}

// Cierra (o vuelve a cerrar) el día de una persona con los totales actuales
export async function cerrarDiaEmpaque(input: {
  persona_id: number
  fecha: string
  total_unidades: number
  total_imperfectos: number
  total_valor: number
  observacion?: string | null
  cerrado_por: number
}): Promise<void> {
  const db = createVanessaClient()

  const { data: existente } = await db
    .from("cierre_empaque")
    .select("id")
    .eq("persona_id", input.persona_id)
    .eq("fecha", input.fecha)
    .maybeSingle()

  const campos = {
    total_unidades: input.total_unidades,
    total_imperfectos: input.total_imperfectos,
    total_valor: input.total_valor,
    observacion: input.observacion?.trim() || null,
  }

  if (existente) {
    const { error } = await db
      .from("cierre_empaque")
      .update(campos)
      .eq("id", (existente as { id: number }).id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await db.from("cierre_empaque").insert({
      persona_id: input.persona_id,
      fecha: input.fecha,
      ...campos,
      cerrado_por: input.cerrado_por,
    })
    if (error) throw new Error(error.message)
  }
}

// Reabre el día (elimina el cierre) para poder corregir registros
export async function reabrirDiaEmpaque(personaId: number, fecha: string): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db
    .from("cierre_empaque")
    .delete()
    .eq("persona_id", personaId)
    .eq("fecha", fecha)
  if (error) throw new Error(error.message)
}
