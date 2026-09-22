import { createVanessaClient } from "@/lib/supabase/vanessa"
import { getSaldosInventario } from "@/lib/db/inventario-producto"

// Ordenes de salida de inventario: descargan producto terminado a nombre
// de un cliente. De una orden confirmada se puede generar la venta con
// sus datos ya cargados.

export type EstadoOrdenSalida = "borrador" | "confirmada" | "anulada"

export interface OrdenSalidaRow {
  id: number
  numero: string
  fecha: string
  cliente_id: number | null
  cliente_nombre: string
  ciudad: string | null
  estado: EstadoOrdenSalida
  motivo: string
  observacion: string | null
  total_unidades: number
  venta_id: number | null
  creado_en: string
  confirmada_en: string | null
}

export interface OrdenSalidaDetalleRow {
  id: number
  orden_salida_id: number
  referencia: string
  descripcion: string | null
  talla: string
  cantidad: number
  inventrans_id: number | null
}

export interface OrdenSalidaHistorialRow {
  id: number
  orden_salida_id: number
  nivel: "cabecera" | "detalle"
  accion: string
  descripcion: string | null
  referencia: string | null
  talla: string | null
  cantidad: number | null
  total_unidades: number | null
  usuario_id: number | null
  usuario_nombre: string | null
  creado_en: string
}

export type OrdenSalidaConDetalle = OrdenSalidaRow & {
  detalle: OrdenSalidaDetalleRow[]
  // Documento de la venta generada, si ya se facturo
  venta_documento?: string | null
}

export const ESTADO_OS_LABEL: Record<EstadoOrdenSalida, string> = {
  borrador: "Borrador",
  confirmada: "Confirmada",
  anulada: "Anulada",
}

export const ESTADO_OS_COLOR: Record<EstadoOrdenSalida, string> = {
  borrador: "bg-stone-100 text-stone-700",
  confirmada: "bg-emerald-100 text-emerald-800",
  anulada: "bg-red-100 text-red-800",
}

// Lo que ve el usuario. Una orden confirmada ya descargo inventario,
// pero mientras no se facture sigue siendo trabajo pendiente: se
// distingue de la que ya tiene su venta.
export type EtapaOrdenSalida =
  | "borrador"
  | "pendiente_facturar"
  | "facturada"
  | "anulada"

export const ETAPA_OS_LABEL: Record<EtapaOrdenSalida, string> = {
  borrador: "Borrador",
  pendiente_facturar: "Pendiente por facturar",
  facturada: "Facturada",
  anulada: "Anulada",
}

export const ETAPA_OS_COLOR: Record<EtapaOrdenSalida, string> = {
  borrador: "bg-stone-100 text-stone-700",
  pendiente_facturar: "bg-amber-100 text-amber-800",
  facturada: "bg-emerald-100 text-emerald-800",
  anulada: "bg-red-100 text-red-800",
}

export function etapaDeOrden(o: {
  estado: EstadoOrdenSalida
  venta_id: number | null
}): EtapaOrdenSalida {
  if (o.estado === "anulada") return "anulada"
  if (o.estado === "borrador") return "borrador"
  return o.venta_id ? "facturada" : "pendiente_facturar"
}

export const MOTIVOS_ORDEN_SALIDA = [
  "Despacho a cliente",
  "Traslado",
  "Muestra",
  "Consignación",
  "Cambio / garantía",
] as const

const OS_COLS =
  "id, numero, fecha, cliente_id, cliente_nombre, ciudad, estado, motivo, observacion, total_unidades, venta_id, creado_en, confirmada_en"
const OS_DET_COLS =
  "id, orden_salida_id, referencia, descripcion, talla, cantidad, inventrans_id"

export interface LineaOrdenSalidaInput {
  referencia: string
  descripcion?: string | null
  talla: string
  cantidad: number
}

// ── Consulta ────────────────────────────────────────────────────

export async function listOrdenesSalida(input?: {
  desde?: string
  hasta?: string
  estado?: string | null
  clienteId?: number | null
}): Promise<OrdenSalidaConDetalle[]> {
  const db = createVanessaClient()

  let q = db
    .from("orden_salida")
    .select(OS_COLS)
    .order("fecha", { ascending: false })
    .order("id", { ascending: false })
    .limit(5000)
  if (input?.desde) q = q.gte("fecha", input.desde)
  if (input?.hasta) q = q.lte("fecha", input.hasta)
  if (input?.estado) q = q.eq("estado", input.estado)
  if (input?.clienteId) q = q.eq("cliente_id", input.clienteId)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  const ordenes = (data ?? []) as OrdenSalidaRow[]
  if (ordenes.length === 0) return []

  const ids = ordenes.map((o) => o.id)
  const { data: detalles } = await db
    .from("orden_salida_detalle")
    .select(OS_DET_COLS)
    .in("orden_salida_id", ids)
    .order("id")

  const porOrden = new Map<number, OrdenSalidaDetalleRow[]>()
  for (const d of (detalles ?? []) as OrdenSalidaDetalleRow[]) {
    const arr = porOrden.get(d.orden_salida_id) ?? []
    arr.push(d)
    porOrden.set(d.orden_salida_id, arr)
  }

  // Documento de las ventas ya generadas
  const ventaIds = ordenes.map((o) => o.venta_id).filter((x): x is number => x != null)
  const docPorVenta = new Map<number, string>()
  if (ventaIds.length > 0) {
    const { data: ventas } = await db
      .from("venta")
      .select("id, numero_documento")
      .in("id", ventaIds)
    for (const v of (ventas ?? []) as Array<{ id: number; numero_documento: string }>) {
      docPorVenta.set(v.id, v.numero_documento)
    }
  }

  return ordenes.map((o) => ({
    ...o,
    detalle: porOrden.get(o.id) ?? [],
    venta_documento: o.venta_id ? (docPorVenta.get(o.venta_id) ?? null) : null,
  }))
}

export async function getOrdenSalida(id: number): Promise<OrdenSalidaConDetalle | null> {
  const db = createVanessaClient()
  const { data } = await db.from("orden_salida").select(OS_COLS).eq("id", id).maybeSingle()
  const orden = data as OrdenSalidaRow | null
  if (!orden) return null

  const { data: detalle } = await db
    .from("orden_salida_detalle")
    .select(OS_DET_COLS)
    .eq("orden_salida_id", id)
    .order("id")

  let venta_documento: string | null = null
  if (orden.venta_id) {
    const { data: v } = await db
      .from("venta")
      .select("numero_documento")
      .eq("id", orden.venta_id)
      .maybeSingle()
    venta_documento = (v as { numero_documento: string } | null)?.numero_documento ?? null
  }

  return {
    ...orden,
    detalle: (detalle ?? []) as OrdenSalidaDetalleRow[],
    venta_documento,
  }
}

// ── Consecutivo ─────────────────────────────────────────────────

async function siguienteNumero(): Promise<string> {
  const db = createVanessaClient()
  const { data, error } = await db.rpc("siguiente_orden_salida")
  if (!error && data) return String(data)

  // Respaldo si la funcion no esta creada
  const { data: filas } = await db.from("orden_salida").select("numero").limit(5000)
  let maximo = 0
  for (const f of (filas ?? []) as Array<{ numero: string }>) {
    const m = /(\d+)\s*$/.exec((f.numero ?? "").trim())
    if (m) maximo = Math.max(maximo, parseInt(m[1], 10))
  }
  return `OS-${String(maximo + 1).padStart(5, "0")}`
}

// ── Historial ───────────────────────────────────────────────────

async function registrarHistorial(input: {
  orden_salida_id: number
  nivel: "cabecera" | "detalle"
  accion: string
  descripcion?: string | null
  referencia?: string | null
  talla?: string | null
  cantidad?: number | null
  total_unidades?: number | null
  usuario_id?: number | null
}): Promise<void> {
  const db = createVanessaClient()

  let usuarioNombre: string | null = null
  if (input.usuario_id) {
    const { data } = await db
      .from("usuario")
      .select("nombre_completo")
      .eq("id", input.usuario_id)
      .maybeSingle()
    usuarioNombre = (data as { nombre_completo: string } | null)?.nombre_completo ?? null
  }

  await db.from("orden_salida_historial").insert({
    orden_salida_id: input.orden_salida_id,
    nivel: input.nivel,
    accion: input.accion,
    descripcion: input.descripcion ?? null,
    referencia: input.referencia ?? null,
    talla: input.talla ?? null,
    cantidad: input.cantidad ?? null,
    total_unidades: input.total_unidades ?? null,
    usuario_id: input.usuario_id ?? null,
    usuario_nombre: usuarioNombre,
  })
}

export async function getHistorialOrdenSalida(
  ordenSalidaId: number
): Promise<OrdenSalidaHistorialRow[]> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("orden_salida_historial")
    .select("*")
    .eq("orden_salida_id", ordenSalidaId)
    .order("creado_en", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as OrdenSalidaHistorialRow[]
}

// Historial de todas las ordenes, para la consulta del administrador
export type HistorialOSConOrden = OrdenSalidaHistorialRow & {
  numero: string
  cliente_nombre: string
  fecha_orden: string
}

// El historial se consulta agrupado por orden, asi que se traen las
// ordenes mas recientes COMPLETAS: cortar por evento dejaria alguna con
// su detalle a medias sin que se note.
const ORDENES_EN_HISTORIAL = 200

export async function getHistorialOrdenesSalida(input?: {
  nivel?: "cabecera" | "detalle" | null
}): Promise<HistorialOSConOrden[]> {
  const db = createVanessaClient()

  // 1) Las ordenes mas recientes
  const { data: recientes, error: errOrd } = await db
    .from("orden_salida")
    .select("id, numero, cliente_nombre, fecha")
    .order("id", { ascending: false })
    .limit(ORDENES_EN_HISTORIAL)
  if (errOrd) throw new Error(errOrd.message)
  const ordenes = (recientes ?? []) as Array<{
    id: number
    numero: string
    cliente_nombre: string
    fecha: string
  }>
  if (ordenes.length === 0) return []

  // 2) Todos sus eventos, sin cortar ninguna a la mitad
  let q = db
    .from("orden_salida_historial")
    .select("*")
    .in(
      "orden_salida_id",
      ordenes.map((o) => o.id)
    )
    .order("creado_en", { ascending: false })
    .limit(20000)
  if (input?.nivel) q = q.eq("nivel", input.nivel)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  const filas = (data ?? []) as OrdenSalidaHistorialRow[]
  if (filas.length === 0) return []

  const porId = new Map(ordenes.map((o) => [o.id, o]))

  return filas.map((f) => {
    const o = porId.get(f.orden_salida_id)
    return {
      ...f,
      numero: o?.numero ?? "(eliminada)",
      cliente_nombre: o?.cliente_nombre ?? "",
      fecha_orden: o?.fecha ?? "",
    }
  })
}

// ── Disponible ──────────────────────────────────────────────────

export interface FaltanteSalida {
  referencia: string
  talla: string
  solicitado: number
  disponible: number
}

// Compara lo que pide la orden contra el saldo por referencia + talla.
// Varias lineas de la misma combinacion suman.
export async function verificarDisponibleSalida(
  lineas: Array<{ referencia: string; talla: string; cantidad: number }>
): Promise<FaltanteSalida[]> {
  const saldos = await getSaldosInventario()

  const disponible = new Map<string, number>()
  for (const s of saldos) {
    const key = `${(s.referencia ?? "").trim().toUpperCase()}|${s.talla.trim().toUpperCase()}`
    disponible.set(key, (disponible.get(key) ?? 0) + s.disponible)
  }

  const solicitado = new Map<string, { referencia: string; talla: string; cantidad: number }>()
  for (const l of lineas) {
    const referencia = l.referencia.trim().toUpperCase()
    const talla = l.talla.trim().toUpperCase()
    const key = `${referencia}|${talla}`
    const actual = solicitado.get(key)
    if (actual) actual.cantidad += l.cantidad
    else solicitado.set(key, { referencia, talla, cantidad: l.cantidad })
  }

  const faltantes: FaltanteSalida[] = []
  for (const [key, s] of solicitado) {
    const disp = disponible.get(key) ?? 0
    if (s.cantidad > disp) {
      faltantes.push({
        referencia: s.referencia,
        talla: s.talla,
        solicitado: s.cantidad,
        disponible: disp,
      })
    }
  }
  return faltantes
}

// ── Guardar ─────────────────────────────────────────────────────

export async function guardarOrdenSalida(
  input: {
    id?: number | null
    fecha: string
    cliente_id: number | null
    cliente_nombre: string
    ciudad?: string | null
    motivo?: string | null
    observacion?: string | null
    lineas: LineaOrdenSalidaInput[]
  },
  creadoPor: number
): Promise<number> {
  const db = createVanessaClient()

  if (input.lineas.length === 0) throw new Error("Agrega al menos una referencia")
  const invalida = input.lineas.find(
    (l) => !l.referencia.trim() || !l.talla.trim() || !(l.cantidad > 0)
  )
  if (invalida) throw new Error("Cada línea necesita referencia, talla y cantidad mayor que 0")

  const totalUnidades = input.lineas.reduce((s, l) => s + l.cantidad, 0)

  const cabecera = {
    fecha: input.fecha,
    cliente_id: input.cliente_id,
    cliente_nombre: input.cliente_nombre.trim().toUpperCase(),
    ciudad: input.ciudad?.trim().toUpperCase() || null,
    motivo: input.motivo?.trim() || "Despacho a cliente",
    observacion: input.observacion?.trim() || null,
    total_unidades: totalUnidades,
  }

  let ordenId = input.id ?? null

  if (ordenId) {
    const { data: actual } = await db
      .from("orden_salida")
      .select("estado")
      .eq("id", ordenId)
      .maybeSingle()
    if ((actual as { estado: string } | null)?.estado === "confirmada") {
      throw new Error(
        "La orden ya fue confirmada y descontó inventario; anúlala para cambiarla"
      )
    }
    const { error } = await db.from("orden_salida").update(cabecera).eq("id", ordenId)
    if (error) throw new Error(error.message)
    await db.from("orden_salida_detalle").delete().eq("orden_salida_id", ordenId)
  } else {
    const numero = await siguienteNumero()
    const { data, error } = await db
      .from("orden_salida")
      .insert({ ...cabecera, numero, estado: "borrador", creado_por: creadoPor })
      .select("id")
      .single()
    if (error || !data) throw new Error(error?.message ?? "Error creando la orden de salida")
    ordenId = data.id
  }

  const filas = input.lineas.map((l) => ({
    orden_salida_id: ordenId,
    referencia: l.referencia.trim().toUpperCase(),
    descripcion: l.descripcion?.trim() || null,
    talla: l.talla.trim().toUpperCase(),
    cantidad: l.cantidad,
  }))
  const { error: errDet } = await db.from("orden_salida_detalle").insert(filas)
  if (errDet) throw new Error(errDet.message)

  await registrarHistorial({
    orden_salida_id: ordenId as number,
    nivel: "cabecera",
    accion: input.id ? "editada" : "creada",
    descripcion: `${cabecera.motivo} · ${filas.length} línea(s)`,
    total_unidades: totalUnidades,
    usuario_id: creadoPor,
  })
  for (const f of filas) {
    await registrarHistorial({
      orden_salida_id: ordenId as number,
      nivel: "detalle",
      accion: input.id ? "línea editada" : "línea agregada",
      referencia: f.referencia,
      talla: f.talla,
      cantidad: f.cantidad,
      usuario_id: creadoPor,
    })
  }

  return ordenId as number
}

// ── Confirmar: descuenta inventario ─────────────────────────────

export async function confirmarOrdenSalida(
  ordenId: number,
  creadoPor: number
): Promise<{ lineas: number }> {
  const db = createVanessaClient()

  const { data: orden } = await db
    .from("orden_salida")
    .select(OS_COLS)
    .eq("id", ordenId)
    .maybeSingle()
  const o = orden as OrdenSalidaRow | null
  if (!o) throw new Error("Orden de salida no encontrada")
  if (o.estado === "confirmada") throw new Error("La orden ya está confirmada")

  const { data: detalles } = await db
    .from("orden_salida_detalle")
    .select(OS_DET_COLS)
    .eq("orden_salida_id", ordenId)
  const lineas = (detalles ?? []) as OrdenSalidaDetalleRow[]
  if (lineas.length === 0) throw new Error("La orden no tiene líneas")

  // O sale completa o no sale: media salida descuadra el inventario
  const faltantes = await verificarDisponibleSalida(lineas)
  if (faltantes.length > 0) {
    const detalle = faltantes
      .map((f) => `${f.referencia} talla ${f.talla}: pide ${f.solicitado}, hay ${f.disponible}`)
      .join("; ")
    throw new Error(`No hay inventario suficiente. ${detalle}`)
  }

  // La OP mas reciente de cada referencia, solo como dato informativo
  const { data: ordenes } = await db
    .from("orden_produccion")
    .select("id, numero_op, referencia")
    .order("numero_op", { ascending: false })
  const ops = (ordenes ?? []) as Array<{
    id: number
    numero_op: number
    referencia: string | null
  }>

  for (const l of lineas) {
    const op = ops.find(
      (x) => (x.referencia ?? "").trim().toUpperCase() === l.referencia.trim().toUpperCase()
    )

    const { data: mov, error } = await db
      .from("inventrans")
      .insert({
        tipo: "salida",
        motivo: `${o.motivo} · ${o.numero}`,
        orden_id: op?.id ?? null,
        numero_op: op?.numero_op ?? null,
        referencia: l.referencia,
        lote_id: null,
        lote_nombre: null,
        prenda_nombre: null,
        talla: l.talla,
        color: null,
        cantidad: l.cantidad,
        fecha: o.fecha,
        observacion: `${o.cliente_nombre}${o.ciudad ? ` · ${o.ciudad}` : ""}`,
        creado_por: creadoPor,
      })
      .select("id")
      .single()
    if (error || !mov) throw new Error(error?.message ?? "Error descontando del inventario")

    await db
      .from("orden_salida_detalle")
      .update({ inventrans_id: mov.id })
      .eq("id", l.id)
  }

  const { error: errEstado } = await db
    .from("orden_salida")
    .update({ estado: "confirmada", confirmada_en: new Date().toISOString() })
    .eq("id", ordenId)
  if (errEstado) throw new Error(errEstado.message)

  await registrarHistorial({
    orden_salida_id: ordenId,
    nivel: "cabecera",
    accion: "confirmada",
    descripcion: `Descontó ${o.total_unidades} unidad(es) del inventario`,
    total_unidades: o.total_unidades,
    usuario_id: creadoPor,
  })

  return { lineas: lineas.length }
}

// ── Anular: devuelve el inventario ──────────────────────────────

export async function anularOrdenSalida(
  ordenId: number,
  creadoPor: number
): Promise<void> {
  const db = createVanessaClient()

  const { data: orden } = await db
    .from("orden_salida")
    .select("id, venta_id, numero")
    .eq("id", ordenId)
    .maybeSingle()
  const o = orden as { id: number; venta_id: number | null; numero: string } | null
  if (!o) throw new Error("Orden de salida no encontrada")
  if (o.venta_id) {
    throw new Error(
      "Esta orden ya generó una venta: anula primero la venta para poder anular la orden"
    )
  }

  const { data: detalles } = await db
    .from("orden_salida_detalle")
    .select("id, inventrans_id")
    .eq("orden_salida_id", ordenId)

  const movIds = ((detalles ?? []) as Array<{ id: number; inventrans_id: number | null }>)
    .map((d) => d.inventrans_id)
    .filter((x): x is number => x != null)

  if (movIds.length > 0) {
    const { error } = await db.from("inventrans").delete().in("id", movIds)
    if (error) throw new Error(error.message)
    await db
      .from("orden_salida_detalle")
      .update({ inventrans_id: null })
      .eq("orden_salida_id", ordenId)
  }

  const { error } = await db
    .from("orden_salida")
    .update({ estado: "anulada" })
    .eq("id", ordenId)
  if (error) throw new Error(error.message)

  await registrarHistorial({
    orden_salida_id: ordenId,
    nivel: "cabecera",
    accion: "anulada",
    descripcion:
      movIds.length > 0
        ? `Se devolvieron ${movIds.length} movimiento(s) al inventario`
        : "Sin movimientos que devolver",
    usuario_id: creadoPor,
  })
}

export async function eliminarOrdenSalida(
  ordenId: number,
  creadoPor: number
): Promise<void> {
  const db = createVanessaClient()
  // Devolver el inventario antes de borrar
  const { data: o } = await db
    .from("orden_salida")
    .select("estado, venta_id")
    .eq("id", ordenId)
    .maybeSingle()
  const row = o as { estado: string; venta_id: number | null } | null
  if (row?.venta_id) {
    throw new Error("Esta orden ya generó una venta: anula primero la venta")
  }
  if (row?.estado === "confirmada") await anularOrdenSalida(ordenId, creadoPor)

  const { error } = await db.from("orden_salida").delete().eq("id", ordenId)
  if (error) throw new Error(error.message)
}

// ── Enlazar con la venta generada ───────────────────────────────

export async function marcarVentaGenerada(
  ordenId: number,
  ventaId: number,
  creadoPor: number
): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db
    .from("orden_salida")
    .update({ venta_id: ventaId })
    .eq("id", ordenId)
  if (error) throw new Error(error.message)

  const { data: v } = await db
    .from("venta")
    .select("numero_documento")
    .eq("id", ventaId)
    .maybeSingle()

  await registrarHistorial({
    orden_salida_id: ordenId,
    nivel: "cabecera",
    accion: "venta generada",
    descripcion: `Se facturó con el documento ${
      (v as { numero_documento: string } | null)?.numero_documento ?? ventaId
    }`,
    usuario_id: creadoPor,
  })
}
