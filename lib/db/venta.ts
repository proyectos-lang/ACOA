import { createVanessaClient } from "@/lib/supabase/vanessa"
import { getSaldosInventario } from "@/lib/db/inventario-producto"

// Ventas (cartera). Cada venta es un documento de un cliente con una o más
// líneas de referencia. Al confirmarla, cada línea descuenta del inventario
// de producto terminado mediante una salida en inventrans.

export type EstadoVenta = "borrador" | "confirmada" | "anulada"

export interface ClienteRow {
  id: number
  nombre: string
  ciudad: string | null
  nit: string | null
  telefono: string | null
  direccion: string | null
  contacto: string | null
  activo: boolean
}

export interface ReferenciaVentaRow {
  id: number
  referencia: string
  descripcion: string | null
  linea: string | null
  categoria: string | null
  valor_unidad: number
  activo: boolean
}

export interface VentaDetalleRow {
  id: number
  venta_id: number
  referencia: string
  descripcion: string | null
  linea: string | null
  categoria: string | null
  talla: string | null
  cantidad: number
  valor_unidad: number
  valor_total: number
  inventrans_id: number | null
}

export interface VentaRow {
  id: number
  numero_documento: string
  fecha: string
  cliente_id: number | null
  cliente_nombre: string
  ciudad: string | null
  estado: EstadoVenta
  total_unidades: number
  total_valor: number
  observacion: string | null
  creado_en: string
  confirmada_en: string | null
}

export type VentaConDetalle = VentaRow & { detalle: VentaDetalleRow[] }

export const ESTADO_VENTA_LABEL: Record<EstadoVenta, string> = {
  borrador: "Borrador",
  confirmada: "Confirmada",
  anulada: "Anulada",
}

export const ESTADO_VENTA_COLOR: Record<EstadoVenta, string> = {
  borrador: "bg-stone-100 text-stone-700",
  confirmada: "bg-emerald-100 text-emerald-800",
  anulada: "bg-red-100 text-red-800",
}

const VENTA_COLS =
  "id, numero_documento, fecha, cliente_id, cliente_nombre, ciudad, estado, total_unidades, total_valor, observacion, creado_en, confirmada_en"
const DETALLE_COLS =
  "id, venta_id, referencia, descripcion, linea, categoria, talla, cantidad, valor_unidad, valor_total, inventrans_id"

// ── Clientes ────────────────────────────────────────────────────

export async function listClientes(soloActivos = false): Promise<ClienteRow[]> {
  const db = createVanessaClient()
  let q = db
    .from("cliente")
    .select("id, nombre, ciudad, nit, telefono, direccion, contacto, activo")
    .order("nombre")
  if (soloActivos) q = q.eq("activo", true)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as ClienteRow[]
}

export async function createCliente(
  input: {
    nombre: string
    ciudad?: string | null
    nit?: string | null
    telefono?: string | null
    direccion?: string | null
    contacto?: string | null
  },
  creadoPor: number
): Promise<number> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("cliente")
    .insert({
      nombre: input.nombre.trim().toUpperCase(),
      ciudad: input.ciudad?.trim().toUpperCase() || null,
      nit: input.nit?.trim() || null,
      telefono: input.telefono?.trim() || null,
      direccion: input.direccion?.trim() || null,
      contacto: input.contacto?.trim() || null,
      creado_por: creadoPor,
    })
    .select("id")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Error creando el cliente")
  return data.id
}

export async function updateCliente(
  id: number,
  campos: Partial<Omit<ClienteRow, "id">>
): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("cliente").update(campos).eq("id", id)
  if (error) throw new Error(error.message)
}

export async function deleteCliente(id: number): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("cliente").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

// ── Referencias de venta (precio y clasificación) ───────────────

export async function listReferenciasVenta(): Promise<ReferenciaVentaRow[]> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("referencia_venta")
    .select("id, referencia, descripcion, linea, categoria, valor_unidad, activo")
    .eq("activo", true)
    .order("referencia")
  if (error) throw new Error(error.message)
  return (data ?? []) as ReferenciaVentaRow[]
}

export async function upsertReferenciaVenta(
  input: {
    referencia: string
    descripcion?: string | null
    linea?: string | null
    categoria?: string | null
    valor_unidad: number
  },
  creadoPor: number
): Promise<void> {
  const db = createVanessaClient()
  const ref = input.referencia.trim().toUpperCase()

  const { data: existente } = await db
    .from("referencia_venta")
    .select("id")
    .ilike("referencia", ref)
    .maybeSingle()

  const campos = {
    descripcion: input.descripcion?.trim() || null,
    linea: input.linea?.trim() || null,
    categoria: input.categoria?.trim() || null,
    valor_unidad: input.valor_unidad,
  }

  if (existente) {
    const { error } = await db
      .from("referencia_venta")
      .update(campos)
      .eq("id", (existente as { id: number }).id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await db
      .from("referencia_venta")
      .insert({ referencia: ref, ...campos, creado_por: creadoPor })
    if (error) throw new Error(error.message)
  }
}

// ── Ventas ──────────────────────────────────────────────────────

export async function listVentas(input?: {
  desde?: string
  hasta?: string
  clienteId?: number | null
  estado?: string | null
}): Promise<VentaConDetalle[]> {
  const db = createVanessaClient()

  let q = db.from("venta").select(VENTA_COLS).order("fecha", { ascending: false }).order("id", {
    ascending: false,
  })
  if (input?.desde) q = q.gte("fecha", input.desde)
  if (input?.hasta) q = q.lte("fecha", input.hasta)
  if (input?.clienteId) q = q.eq("cliente_id", input.clienteId)
  if (input?.estado) q = q.eq("estado", input.estado)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  const ventas = (data ?? []) as VentaRow[]
  if (ventas.length === 0) return []

  const { data: detalles } = await db
    .from("venta_detalle")
    .select(DETALLE_COLS)
    .in(
      "venta_id",
      ventas.map((v) => v.id)
    )
    .order("id")

  const porVenta = new Map<number, VentaDetalleRow[]>()
  for (const d of (detalles ?? []) as VentaDetalleRow[]) {
    const arr = porVenta.get(d.venta_id) ?? []
    arr.push(d)
    porVenta.set(d.venta_id, arr)
  }

  return ventas.map((v) => ({ ...v, detalle: porVenta.get(v.id) ?? [] }))
}

export interface LineaVentaInput {
  referencia: string
  descripcion?: string | null
  linea?: string | null
  categoria?: string | null
  talla?: string | null
  cantidad: number
  valor_unidad: number
}

// Crea o actualiza una venta en borrador con sus líneas
export async function guardarVenta(
  input: {
    id?: number | null
    numero_documento: string
    fecha: string
    cliente_id: number | null
    cliente_nombre: string
    ciudad?: string | null
    observacion?: string | null
    lineas: LineaVentaInput[]
  },
  creadoPor: number
): Promise<number> {
  const db = createVanessaClient()

  if (input.lineas.length === 0) throw new Error("Agrega al menos una referencia a la venta")
  const invalida = input.lineas.find((l) => !l.referencia.trim() || !(l.cantidad > 0))
  if (invalida) throw new Error("Cada línea necesita referencia y cantidad mayor que 0")

  const totalUnidades = input.lineas.reduce((s, l) => s + l.cantidad, 0)
  const totalValor = input.lineas.reduce((s, l) => s + l.cantidad * l.valor_unidad, 0)

  const cabecera = {
    numero_documento: input.numero_documento.trim(),
    fecha: input.fecha,
    cliente_id: input.cliente_id,
    cliente_nombre: input.cliente_nombre.trim().toUpperCase(),
    ciudad: input.ciudad?.trim().toUpperCase() || null,
    total_unidades: totalUnidades,
    total_valor: totalValor,
    observacion: input.observacion?.trim() || null,
  }

  let ventaId = input.id ?? null

  if (ventaId) {
    // Solo se edita mientras esté en borrador
    const { data: actual } = await db
      .from("venta")
      .select("estado")
      .eq("id", ventaId)
      .maybeSingle()
    if ((actual as { estado: string } | null)?.estado === "confirmada") {
      throw new Error("La venta ya fue confirmada y descontó inventario; anúlala para cambiarla")
    }
    const { error } = await db.from("venta").update(cabecera).eq("id", ventaId)
    if (error) throw new Error(error.message)
    await db.from("venta_detalle").delete().eq("venta_id", ventaId)
  } else {
    const { data, error } = await db
      .from("venta")
      .insert({ ...cabecera, estado: "borrador", creado_por: creadoPor })
      .select("id")
      .single()
    if (error || !data) throw new Error(error?.message ?? "Error creando la venta")
    ventaId = data.id
  }

  const filas = input.lineas.map((l) => ({
    venta_id: ventaId,
    referencia: l.referencia.trim().toUpperCase(),
    descripcion: l.descripcion?.trim() || null,
    linea: l.linea?.trim() || null,
    categoria: l.categoria?.trim() || null,
    talla: l.talla?.trim().toUpperCase() || null,
    cantidad: l.cantidad,
    valor_unidad: l.valor_unidad,
    valor_total: l.cantidad * l.valor_unidad,
  }))
  const { error: errDet } = await db.from("venta_detalle").insert(filas)
  if (errDet) throw new Error(errDet.message)

  return ventaId as number
}

export interface FaltanteInventario {
  referencia: string
  talla: string
  solicitado: number
  disponible: number
}

// Compara lo que pide la venta contra el saldo de inventario por
// referencia + talla. Varias lineas de la misma referencia/talla suman,
// para que no se apruebe una venta que en conjunto excede el disponible.
export async function verificarDisponible(
  lineas: Array<{ referencia: string; talla: string | null; cantidad: number }>
): Promise<FaltanteInventario[]> {
  const saldos = await getSaldosInventario()

  const disponiblePor = new Map<string, number>()
  for (const s of saldos) {
    const key = `${(s.referencia ?? "").trim().toUpperCase()}|${s.talla.trim().toUpperCase()}`
    disponiblePor.set(key, (disponiblePor.get(key) ?? 0) + s.disponible)
  }

  const solicitadoPor = new Map<string, { referencia: string; talla: string; cantidad: number }>()
  for (const l of lineas) {
    const referencia = l.referencia.trim().toUpperCase()
    const talla = (l.talla ?? "").trim().toUpperCase()
    const key = `${referencia}|${talla}`
    const actual = solicitadoPor.get(key)
    if (actual) actual.cantidad += l.cantidad
    else solicitadoPor.set(key, { referencia, talla, cantidad: l.cantidad })
  }

  const faltantes: FaltanteInventario[] = []
  for (const [key, s] of solicitadoPor) {
    const disponible = disponiblePor.get(key) ?? 0
    if (s.cantidad > disponible) {
      faltantes.push({
        referencia: s.referencia,
        talla: s.talla || "(sin talla)",
        solicitado: s.cantidad,
        disponible,
      })
    }
  }
  return faltantes
}

// Confirma la venta y descuenta del inventario: cada línea genera una
// salida en inventrans por referencia y talla.
export async function confirmarVenta(
  ventaId: number,
  creadoPor: number
): Promise<{ lineas: number }> {
  const db = createVanessaClient()

  const { data: venta } = await db
    .from("venta")
    .select(VENTA_COLS)
    .eq("id", ventaId)
    .maybeSingle()
  const v = venta as VentaRow | null
  if (!v) throw new Error("Venta no encontrada")
  if (v.estado === "confirmada") throw new Error("La venta ya está confirmada")

  const { data: detalles } = await db
    .from("venta_detalle")
    .select(DETALLE_COLS)
    .eq("venta_id", ventaId)
  const lineas = (detalles ?? []) as VentaDetalleRow[]
  if (lineas.length === 0) throw new Error("La venta no tiene líneas")

  // El inventario se lleva por referencia + talla: sin talla no hay contra
  // que descontar, asi que la venta no se puede confirmar.
  const sinTallaRefs = lineas.filter((l) => !l.talla?.trim()).map((l) => l.referencia)
  if (sinTallaRefs.length > 0) {
    throw new Error(
      `Indica la talla para descontar del inventario: ${[...new Set(sinTallaRefs)].join(", ")}`
    )
  }

  // Antes de descontar nada, comprobar que haya disponible para todas las
  // lineas: la venta se confirma completa o no se confirma.
  const faltantes = await verificarDisponible(lineas)
  if (faltantes.length > 0) {
    const detalle = faltantes
      .map(
        (f) =>
          `${f.referencia} talla ${f.talla}: pide ${f.solicitado}, disponible ${f.disponible}`
      )
      .join("; ")
    throw new Error(`No hay inventario suficiente. ${detalle}`)
  }

  // La OP más reciente de cada referencia, solo como dato informativo
  const { data: ordenes } = await db
    .from("orden_produccion")
    .select("id, numero_op, referencia")
    .order("numero_op", { ascending: false })
  const ordenesRows = (ordenes ?? []) as Array<{
    id: number
    numero_op: number
    referencia: string | null
  }>

  for (const l of lineas) {
    const orden = ordenesRows.find(
      (o) => (o.referencia ?? "").trim().toUpperCase() === l.referencia.trim().toUpperCase()
    )

    const { data: mov, error } = await db
      .from("inventrans")
      .insert({
        tipo: "salida",
        motivo: `Venta ${v.numero_documento}`,
        orden_id: orden?.id ?? null,
        numero_op: orden?.numero_op ?? null,
        referencia: l.referencia,
        // La salida de venta no se ata a un lote
        lote_id: null,
        lote_nombre: null,
        prenda_nombre: null,
        talla: (l.talla ?? "").trim(),
        color: null,
        cantidad: l.cantidad,
        fecha: v.fecha,
        observacion: `${v.cliente_nombre}${v.ciudad ? ` · ${v.ciudad}` : ""}`,
        creado_por: creadoPor,
      })
      .select("id")
      .single()
    if (error || !mov) throw new Error(error?.message ?? "Error descontando del inventario")

    await db.from("venta_detalle").update({ inventrans_id: mov.id }).eq("id", l.id)
  }

  const { error: errEstado } = await db
    .from("venta")
    .update({ estado: "confirmada", confirmada_en: new Date().toISOString() })
    .eq("id", ventaId)
  if (errEstado) throw new Error(errEstado.message)

  return { lineas: lineas.length }
}

// Anula la venta y devuelve al inventario lo que había descontado
export async function anularVenta(ventaId: number): Promise<void> {
  const db = createVanessaClient()

  const { data: detalles } = await db
    .from("venta_detalle")
    .select("id, inventrans_id")
    .eq("venta_id", ventaId)

  const movIds = ((detalles ?? []) as Array<{ id: number; inventrans_id: number | null }>)
    .map((d) => d.inventrans_id)
    .filter((x): x is number => x != null)

  if (movIds.length > 0) {
    const { error } = await db.from("inventrans").delete().in("id", movIds)
    if (error) throw new Error(error.message)
    await db.from("venta_detalle").update({ inventrans_id: null }).eq("venta_id", ventaId)
  }

  const { error } = await db.from("venta").update({ estado: "anulada" }).eq("id", ventaId)
  if (error) throw new Error(error.message)
}

export async function eliminarVenta(ventaId: number): Promise<void> {
  const db = createVanessaClient()
  // Devolver el inventario antes de borrar
  await anularVenta(ventaId)
  const { error } = await db.from("venta").delete().eq("id", ventaId)
  if (error) throw new Error(error.message)
}

// Siguiente número de documento (consecutivo)
export async function getSiguienteDocumento(): Promise<string> {
  const db = createVanessaClient()
  const { data } = await db.from("venta").select("numero_documento").limit(5000)

  let maximo = 0
  for (const v of (data ?? []) as Array<{ numero_documento: string }>) {
    const m = /(\d+)\s*$/.exec((v.numero_documento ?? "").trim())
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > maximo) maximo = n
    }
  }
  return String(maximo + 1)
}
