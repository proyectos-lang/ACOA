import { createVanessaClient } from "@/lib/supabase/vanessa"
import { getLoteById } from "@/lib/db/lote"
import { getOrdenById } from "@/lib/db/orden-produccion"
import { getEstampacionByLote } from "@/lib/db/estampacion"
import { getConfeccionByLote } from "@/lib/db/confeccion"
import { getConteoByLote } from "@/lib/db/conteo"
import { listPrendasByLote } from "@/lib/db/lote-prenda"

// Pagos a estampadores y confeccionistas. El pago de estampación se
// habilita manualmente desde la ficha; el de confección se habilita
// automáticamente al validar el conteo con las cantidades efectivas.

export type PagoProceso = "estampacion" | "confeccion"
export type PagoEstado = "pendiente" | "parcial" | "pagado"

export interface PagoProduccionRow {
  id: number
  lote_id: number
  prenda_id: number | null
  proceso: PagoProceso
  beneficiario: string
  cantidad: number
  precio_unitario: number
  total: number
  pagado: number
  estado: PagoEstado
  habilitado_en: string
}

export interface PagoAbonoRow {
  id: number
  pago_id: number
  valor: number
  fecha: string
  observacion: string | null
  creado_en: string
}

export type PagoConContexto = PagoProduccionRow & {
  numero_op: number
  referencia: string
  lote_nombre: string
  prenda_nombre: string | null
  abonos: PagoAbonoRow[]
}

export const PAGO_ESTADO_LABEL: Record<PagoEstado, string> = {
  pendiente: "Pendiente",
  parcial: "Parcial",
  pagado: "Pagado",
}

export const PAGO_ESTADO_COLOR: Record<PagoEstado, string> = {
  pendiente: "bg-amber-100 text-amber-800",
  parcial: "bg-blue-100 text-blue-800",
  pagado: "bg-emerald-100 text-emerald-800",
}

const SELECT_COLS =
  "id, lote_id, prenda_id, proceso, beneficiario, cantidad, precio_unitario, total, pagado, estado, habilitado_en"

function calcEstado(total: number, pagado: number): PagoEstado {
  if (total > 0 && pagado >= total) return "pagado"
  if (pagado > 0) return "parcial"
  return "pendiente"
}

// Crea o actualiza el pago del lote/prenda+proceso sin perder los abonos ya
// registrados (re-habilitar refresca beneficiario, cantidad y precio).
export async function habilitarPago(input: {
  lote_id: number
  prenda_id: number | null
  proceso: PagoProceso
  beneficiario: string
  cantidad: number
  precio_unitario: number
  habilitado_por: number
}): Promise<void> {
  const db = createVanessaClient()
  let q = db
    .from("pago_produccion")
    .select("id, pagado")
    .eq("lote_id", input.lote_id)
    .eq("proceso", input.proceso)
  q = input.prenda_id == null ? q.is("prenda_id", null) : q.eq("prenda_id", input.prenda_id)
  const { data: existing, error: selErr } = await q.maybeSingle()
  if (selErr) throw new Error(selErr.message)

  const total = input.cantidad * input.precio_unitario

  if (existing) {
    const pagado = Number(existing.pagado) || 0
    const { error } = await db
      .from("pago_produccion")
      .update({
        beneficiario: input.beneficiario,
        cantidad: input.cantidad,
        precio_unitario: input.precio_unitario,
        total,
        estado: calcEstado(total, pagado),
      })
      .eq("id", existing.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await db.from("pago_produccion").insert({
      lote_id: input.lote_id,
      prenda_id: input.prenda_id,
      proceso: input.proceso,
      beneficiario: input.beneficiario,
      cantidad: input.cantidad,
      precio_unitario: input.precio_unitario,
      total,
      pagado: 0,
      estado: "pendiente",
      habilitado_por: input.habilitado_por,
    })
    if (error) throw new Error(error.message)
  }
}

// Habilita el pago de estampación de un lote. En OPs tipo conjunto crea un
// pago por cada prenda con estampador asignado (cantidad = unidades del lote,
// precio = precio de la prenda); en OPs tipo prenda usa los datos del lote.
export async function habilitarPagoEstampacion(
  loteId: number,
  userId: number
): Promise<number> {
  const lote = await getLoteById(loteId)
  if (!lote) throw new Error("Lote no encontrado")
  const orden = await getOrdenById(lote.orden_id)
  if (!orden) throw new Error("Orden no encontrada")

  if (orden.tipo_prenda === "conjunto") {
    const prendas = await listPrendasByLote(loteId)
    const conEstampador = prendas.filter((p) => p.nombre_estampador)
    if (conEstampador.length === 0) {
      throw new Error("Ninguna prenda del conjunto tiene estampador asignado")
    }
    for (const p of conEstampador) {
      await habilitarPago({
        lote_id: loteId,
        prenda_id: p.id,
        proceso: "estampacion",
        beneficiario: p.nombre_estampador as string,
        cantidad: lote.cantidad_programada,
        precio_unitario: Number(p.est_precio) || 0,
        habilitado_por: userId,
      })
    }
    return conEstampador.length
  }

  const est = await getEstampacionByLote(loteId)
  if (!est?.nombre_estampador) {
    throw new Error("Asigna y guarda el estampador antes de habilitar el pago")
  }
  await habilitarPago({
    lote_id: loteId,
    prenda_id: null,
    proceso: "estampacion",
    beneficiario: est.nombre_estampador,
    cantidad: lote.cantidad_programada,
    precio_unitario: Number(est.precio_estampacion) || 0,
    habilitado_por: userId,
  })
  return 1
}

// Habilita automáticamente el pago de confección al validar el conteo,
// con las cantidades contadas efectivas. En conjuntos usa la cantidad
// contada y el precio de cada prenda con confeccionista asignado.
// Devuelve cuántos pagos habilitó (0 si falta confeccionista).
export async function habilitarPagoConfeccionPorConteo(
  loteId: number,
  userId: number
): Promise<number> {
  const lote = await getLoteById(loteId)
  if (!lote) return 0
  const orden = await getOrdenById(lote.orden_id)
  if (!orden) return 0

  if (orden.tipo_prenda === "conjunto") {
    const prendas = await listPrendasByLote(loteId)
    const pagables = prendas.filter(
      (p) => p.nombre_confeccionista && p.cantidad_contada != null && p.cantidad_contada > 0
    )
    for (const p of pagables) {
      await habilitarPago({
        lote_id: loteId,
        prenda_id: p.id,
        proceso: "confeccion",
        beneficiario: p.nombre_confeccionista as string,
        cantidad: p.cantidad_contada as number,
        precio_unitario: Number(p.conf_precio) || 0,
        habilitado_por: userId,
      })
    }
    return pagables.length
  }

  const [conf, conteo] = await Promise.all([
    getConfeccionByLote(loteId),
    getConteoByLote(loteId),
  ])
  if (!conf?.nombre_confeccionista || !conteo || conteo.total_contado <= 0) return 0

  await habilitarPago({
    lote_id: loteId,
    prenda_id: null,
    proceso: "confeccion",
    beneficiario: conf.nombre_confeccionista,
    cantidad: conteo.total_contado,
    precio_unitario: Number(conf.precio_confeccion) || 0,
    habilitado_por: userId,
  })
  return 1
}

// ── Listado con contexto (OP, lote, prenda, abonos) ─────────────

export async function listPagosConContexto(): Promise<PagoConContexto[]> {
  const db = createVanessaClient()
  const { data: pagos, error } = await db
    .from("pago_produccion")
    .select(SELECT_COLS)
    .order("habilitado_en", { ascending: false })
  if (error) throw new Error(error.message)
  const rows = (pagos ?? []) as PagoProduccionRow[]
  if (rows.length === 0) return []

  const loteIds = [...new Set(rows.map((p) => p.lote_id))]
  const prendaIds = [...new Set(rows.map((p) => p.prenda_id).filter((x): x is number => x != null))]
  const pagoIds = rows.map((p) => p.id)

  const [{ data: lotes }, { data: prendas }, { data: abonos }] = await Promise.all([
    db.from("lote").select("id, numero_lote, descripcion, orden_id").in("id", loteIds),
    prendaIds.length
      ? db.from("lote_prenda").select("id, nombre").in("id", prendaIds)
      : Promise.resolve({ data: [] as Array<{ id: number; nombre: string }> }),
    db
      .from("pago_abono")
      .select("id, pago_id, valor, fecha, observacion, creado_en")
      .in("pago_id", pagoIds)
      .order("fecha", { ascending: false })
      .order("id", { ascending: false }),
  ])

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

  const loteMap = new Map(lotesRows.map((l) => [l.id, l]))
  const opMap = new Map(
    ((ops ?? []) as Array<{ id: number; numero_op: number; referencia: string }>).map((o) => [
      o.id,
      o,
    ])
  )
  const prendaMap = new Map(
    ((prendas ?? []) as Array<{ id: number; nombre: string }>).map((p) => [p.id, p.nombre])
  )
  const abonosMap = new Map<number, PagoAbonoRow[]>()
  for (const a of (abonos ?? []) as PagoAbonoRow[]) {
    const arr = abonosMap.get(a.pago_id) ?? []
    arr.push(a)
    abonosMap.set(a.pago_id, arr)
  }

  return rows.map((p) => {
    const lote = loteMap.get(p.lote_id)
    const op = lote ? opMap.get(lote.orden_id) : undefined
    return {
      ...p,
      numero_op: op?.numero_op ?? 0,
      referencia: op?.referencia ?? "—",
      lote_nombre: lote?.descripcion ?? `LOTE-${String(lote?.numero_lote ?? 0).padStart(4, "0")}`,
      prenda_nombre: p.prenda_id != null ? (prendaMap.get(p.prenda_id) ?? null) : null,
      abonos: abonosMap.get(p.id) ?? [],
    }
  })
}

// ── Abonos (pagos parciales) ────────────────────────────────────

async function recomputarPago(pagoId: number): Promise<void> {
  const db = createVanessaClient()
  const [{ data: pago, error: pErr }, { data: abonos, error: aErr }] = await Promise.all([
    db.from("pago_produccion").select("id, total").eq("id", pagoId).single(),
    db.from("pago_abono").select("valor").eq("pago_id", pagoId),
  ])
  if (pErr || !pago) throw new Error(pErr?.message ?? "Pago no encontrado")
  if (aErr) throw new Error(aErr.message)

  const pagado = ((abonos ?? []) as Array<{ valor: number }>).reduce(
    (s, a) => s + (Number(a.valor) || 0),
    0
  )
  const { error } = await db
    .from("pago_produccion")
    .update({ pagado, estado: calcEstado(Number(pago.total), pagado) })
    .eq("id", pagoId)
  if (error) throw new Error(error.message)
}

// Edita los datos de un pago habilitado (beneficiario, cantidad, precio);
// recalcula total y estado conservando los abonos
export async function updatePago(
  pagoId: number,
  campos: { beneficiario?: string; cantidad?: number; precio_unitario?: number }
): Promise<void> {
  const db = createVanessaClient()
  const { data: pago, error: selErr } = await db
    .from("pago_produccion")
    .select("id, cantidad, precio_unitario, pagado")
    .eq("id", pagoId)
    .single()
  if (selErr || !pago) throw new Error(selErr?.message ?? "Pago no encontrado")

  const cantidad = campos.cantidad ?? pago.cantidad
  const precio = campos.precio_unitario ?? Number(pago.precio_unitario)
  if (cantidad < 0 || precio < 0) throw new Error("Cantidad y precio no pueden ser negativos")
  const total = cantidad * precio
  const pagado = Number(pago.pagado) || 0

  const { error } = await db
    .from("pago_produccion")
    .update({
      ...(campos.beneficiario?.trim() ? { beneficiario: campos.beneficiario.trim() } : {}),
      cantidad,
      precio_unitario: precio,
      total,
      estado: calcEstado(total, pagado),
    })
    .eq("id", pagoId)
  if (error) throw new Error(error.message)
}

// Edita un abono existente y recalcula el estado del pago
export async function updateAbono(
  abonoId: number,
  campos: { valor?: number; fecha?: string; observacion?: string | null }
): Promise<void> {
  const db = createVanessaClient()
  const { data: abono, error: selErr } = await db
    .from("pago_abono")
    .select("id, pago_id")
    .eq("id", abonoId)
    .single()
  if (selErr || !abono) throw new Error(selErr?.message ?? "Abono no encontrado")
  if (campos.valor != null && !(campos.valor > 0)) {
    throw new Error("El valor del abono debe ser mayor que 0")
  }

  const upd: Record<string, unknown> = {}
  if (campos.valor != null) upd.valor = campos.valor
  if (campos.fecha) upd.fecha = campos.fecha
  if (campos.observacion !== undefined) upd.observacion = campos.observacion?.trim() || null
  if (Object.keys(upd).length > 0) {
    const { error } = await db.from("pago_abono").update(upd).eq("id", abonoId)
    if (error) throw new Error(error.message)
  }
  await recomputarPago(abono.pago_id)
}

export async function registrarAbono(input: {
  pago_id: number
  valor: number
  fecha: string
  observacion?: string | null
  creado_por: number
}): Promise<void> {
  if (!(input.valor > 0)) throw new Error("El valor del abono debe ser mayor que 0")
  const db = createVanessaClient()
  const { error } = await db.from("pago_abono").insert({
    pago_id: input.pago_id,
    valor: input.valor,
    fecha: input.fecha,
    observacion: input.observacion?.trim() || null,
    creado_por: input.creado_por,
  })
  if (error) throw new Error(error.message)
  await recomputarPago(input.pago_id)
}

export async function eliminarAbono(abonoId: number): Promise<void> {
  const db = createVanessaClient()
  const { data: abono, error: selErr } = await db
    .from("pago_abono")
    .select("id, pago_id")
    .eq("id", abonoId)
    .single()
  if (selErr || !abono) throw new Error(selErr?.message ?? "Abono no encontrado")
  const { error } = await db.from("pago_abono").delete().eq("id", abonoId)
  if (error) throw new Error(error.message)
  await recomputarPago(abono.pago_id)
}

export async function eliminarPago(pagoId: number): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("pago_produccion").delete().eq("id", pagoId)
  if (error) throw new Error(error.message)
}
