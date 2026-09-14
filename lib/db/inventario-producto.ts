import { createVanessaClient } from "@/lib/supabase/vanessa"

// Inventario de producto terminado. Cada empaque registrado genera una
// entrada con la trazabilidad completa (OP, referencia, lote, prenda,
// talla). Las salidas se registran manualmente y el disponible es la
// suma de entradas menos salidas.

export type TipoMovimiento = "entrada" | "salida" | "ajuste"

export interface InventransRow {
  id: number
  tipo: TipoMovimiento
  motivo: string
  orden_id: number | null
  numero_op: number | null
  referencia: string | null
  lote_id: number | null
  lote_nombre: string | null
  prenda_id: number | null
  prenda_nombre: string | null
  talla: string
  color: string | null
  cantidad: number
  fecha: string
  observacion: string | null
  empaque_registro_id: number | null
  creado_en: string
}

// Saldo del producto terminado. Se agrupa por REFERENCIA + TALLA: una vez
// empacada, la prenda deja de identificarse por su lote de origen, porque la
// entrega se hace por referencia y talla. Los lotes que la surtieron quedan
// en el kardex para la trazabilidad.
export interface SaldoInventario {
  referencia: string | null
  prenda_nombre: string | null
  talla: string
  disponible: number
  total_entradas: number
  total_salidas: number
  ultimo_movimiento: string | null
  // Trazabilidad: de qué OP y lotes proviene el disponible
  ops: number[]
  lotes: string[]
}

export const MOTIVOS_SALIDA = [
  "Despacho a cliente",
  "Traslado",
  "Devolución",
  "Muestra",
  "Avería",
  "Ajuste de inventario",
] as const

const SELECT_COLS =
  "id, tipo, motivo, orden_id, numero_op, referencia, lote_id, lote_nombre, prenda_id, prenda_nombre, talla, color, cantidad, fecha, observacion, empaque_registro_id, creado_en"

// Registra la entrada de inventario que genera un empaque. Es idempotente:
// el índice único por empaque_registro_id evita duplicar la entrada.
export async function registrarEntradaPorEmpaque(input: {
  empaque_registro_id: number
  lote_id: number
  talla: string
  cantidad: number
  fecha: string
  creado_por: number
}): Promise<void> {
  if (!(input.cantidad > 0)) return

  const db = createVanessaClient()

  // Trazabilidad del lote y su orden
  const { data: lote } = await db
    .from("lote")
    .select("id, numero_lote, descripcion, color, orden_id")
    .eq("id", input.lote_id)
    .maybeSingle()
  if (!lote) return
  const l = lote as {
    id: number
    numero_lote: number
    descripcion: string | null
    color: string | null
    orden_id: number
  }

  const { data: orden } = await db
    .from("orden_produccion")
    .select("id, numero_op, referencia")
    .eq("id", l.orden_id)
    .maybeSingle()
  const o = orden as { id: number; numero_op: number; referencia: string } | null

  const { error } = await db.from("inventrans").insert({
    tipo: "entrada",
    motivo: "empaque",
    orden_id: l.orden_id,
    numero_op: o?.numero_op ?? null,
    referencia: o?.referencia ?? null,
    lote_id: l.id,
    lote_nombre: l.descripcion ?? `LOTE-${String(l.numero_lote).padStart(4, "0")}`,
    prenda_id: null,
    prenda_nombre: null,
    talla: input.talla.trim(),
    color: l.color,
    cantidad: input.cantidad,
    fecha: input.fecha,
    empaque_registro_id: input.empaque_registro_id,
    creado_por: input.creado_por,
  })
  // Si ya existía la entrada de ese empaque, no es un error a propagar
  if (error && !error.message.toLowerCase().includes("duplicate")) {
    throw new Error(error.message)
  }
}

// Elimina la entrada asociada a un empaque (al borrar el registro)
export async function eliminarEntradaPorEmpaque(empaqueRegistroId: number): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db
    .from("inventrans")
    .delete()
    .eq("empaque_registro_id", empaqueRegistroId)
  if (error) throw new Error(error.message)
}

// Registra una salida (o ajuste) manual de inventario
// Registra una salida (o ajuste) manual. La entrega es por REFERENCIA y
// TALLA: no se ata a un lote, porque el producto terminado ya no se
// identifica por su lote de origen.
export async function registrarMovimiento(input: {
  tipo: TipoMovimiento
  motivo: string
  referencia: string
  prenda_nombre?: string | null
  talla: string
  cantidad: number
  fecha: string
  observacion?: string | null
  creado_por: number
}): Promise<void> {
  if (!(input.cantidad > 0)) throw new Error("La cantidad debe ser mayor que 0")
  if (!input.referencia.trim()) throw new Error("Indica la referencia")

  const db = createVanessaClient()
  const referencia = input.referencia.trim()

  // Se conserva el número de OP solo como dato informativo, tomándolo de la
  // orden más reciente de esa referencia
  const { data: ordenes } = await db
    .from("orden_produccion")
    .select("id, numero_op, referencia")
    .order("numero_op", { ascending: false })
  const orden = ((ordenes ?? []) as Array<{
    id: number
    numero_op: number
    referencia: string | null
  }>).find(
    (o) => (o.referencia ?? "").trim().toUpperCase() === referencia.toUpperCase()
  )

  const { error } = await db.from("inventrans").insert({
    tipo: input.tipo,
    motivo: input.motivo,
    orden_id: orden?.id ?? null,
    numero_op: orden?.numero_op ?? null,
    referencia,
    // La salida no se ata a un lote
    lote_id: null,
    lote_nombre: null,
    prenda_nombre: input.prenda_nombre?.trim() || null,
    talla: input.talla.trim(),
    color: null,
    cantidad: input.cantidad,
    fecha: input.fecha,
    observacion: input.observacion?.trim() || null,
    creado_por: input.creado_por,
  })
  if (error) throw new Error(error.message)
}

export async function eliminarMovimiento(id: number): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("inventrans").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

// Saldos de inventario: entradas menos salidas
export async function getSaldosInventario(): Promise<SaldoInventario[]> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("inventrans")
    .select("orden_id, numero_op, referencia, lote_id, lote_nombre, prenda_nombre, talla, tipo, cantidad, fecha")
    .limit(20000)
  if (error) throw new Error(error.message)

  const filas = (data ?? []) as Array<{
    orden_id: number | null
    numero_op: number | null
    referencia: string | null
    lote_id: number | null
    lote_nombre: string | null
    prenda_nombre: string | null
    talla: string
    tipo: TipoMovimiento
    cantidad: number
    fecha: string
  }>

  const map = new Map<string, SaldoInventario>()
  for (const f of filas) {
    // La clave es la referencia + prenda + talla: el lote no separa el saldo
    const key = `${(f.referencia ?? "").trim().toUpperCase()}|${f.prenda_nombre ?? ""}|${f.talla
      .trim()
      .toUpperCase()}`
    let s = map.get(key)
    if (!s) {
      s = {
        referencia: f.referencia,
        prenda_nombre: f.prenda_nombre,
        talla: f.talla.trim(),
        disponible: 0,
        total_entradas: 0,
        total_salidas: 0,
        ultimo_movimiento: null,
        ops: [],
        lotes: [],
      }
      map.set(key, s)
    }
    // Trazabilidad de origen (solo de las entradas)
    if (f.tipo === "entrada") {
      if (f.numero_op != null && !s.ops.includes(f.numero_op)) s.ops.push(f.numero_op)
      if (f.lote_nombre && !s.lotes.includes(f.lote_nombre)) s.lotes.push(f.lote_nombre)
    }
    if (f.tipo === "entrada") {
      s.total_entradas += f.cantidad
      s.disponible += f.cantidad
    } else if (f.tipo === "salida") {
      s.total_salidas += f.cantidad
      s.disponible -= f.cantidad
    } else {
      s.disponible += f.cantidad
    }
    if (!s.ultimo_movimiento || f.fecha > s.ultimo_movimiento) s.ultimo_movimiento = f.fecha
  }

  return [...map.values()].sort(
    (a, b) =>
      (a.referencia ?? "").localeCompare(b.referencia ?? "", "es", { numeric: true }) ||
      (a.prenda_nombre ?? "").localeCompare(b.prenda_nombre ?? "", "es") ||
      a.talla.localeCompare(b.talla, "es", { numeric: true })
  )
}

// Movimientos (kardex), opcionalmente filtrados por lote
export async function getMovimientos(loteId?: number | null): Promise<InventransRow[]> {
  const db = createVanessaClient()
  let q = db
    .from("inventrans")
    .select(SELECT_COLS)
    .order("fecha", { ascending: false })
    .order("id", { ascending: false })
    .limit(2000)
  if (loteId) q = q.eq("lote_id", loteId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as InventransRow[]
}

// Carga inicial: crea las entradas de los empaques que aún no las tienen
export async function sincronizarInventarioDesdeEmpaque(userId: number): Promise<number> {
  const db = createVanessaClient()

  const [{ data: registros }, { data: existentes }] = await Promise.all([
    db.from("empaque_registro").select("id, lote_id, talla, cantidad, fecha").limit(20000),
    db.from("inventrans").select("empaque_registro_id").not("empaque_registro_id", "is", null),
  ])

  const yaRegistrados = new Set(
    ((existentes ?? []) as Array<{ empaque_registro_id: number }>).map(
      (e) => e.empaque_registro_id
    )
  )
  const pendientes = ((registros ?? []) as Array<{
    id: number
    lote_id: number
    talla: string
    cantidad: number
    fecha: string
  }>).filter((r) => !yaRegistrados.has(r.id) && r.cantidad > 0)

  let creadas = 0
  for (const r of pendientes) {
    await registrarEntradaPorEmpaque({
      empaque_registro_id: r.id,
      lote_id: r.lote_id,
      talla: r.talla,
      cantidad: r.cantidad,
      fecha: r.fecha,
      creado_por: userId,
    })
    creadas++
  }
  return creadas
}
