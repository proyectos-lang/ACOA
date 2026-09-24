import { createVanessaClient } from "@/lib/supabase/vanessa"
import { getSaldosInventario } from "@/lib/db/inventario-producto"

// Conteo fisico de inventario: se abre sobre las referencias a contar, se
// registra lo que hay en fisico y al cerrarlo el sistema ajusta la
// diferencia con un movimiento por linea.

export type EstadoConteoFisico = "abierto" | "cerrado" | "anulado"

export interface ConteoFisicoRow {
  id: number
  numero: string
  fecha: string
  estado: EstadoConteoFisico
  alcance: "todo" | "seleccion"
  observacion: string | null
  total_lineas: number
  lineas_con_dif: number
  unidades_sistema: number
  unidades_fisico: number
  diferencia_total: number
  abierto_por: number | null
  abierto_nombre: string | null
  abierto_en: string
  cerrado_por: number | null
  cerrado_nombre: string | null
  cerrado_en: string | null
}

export interface ConteoFisicoDetalleRow {
  id: number
  conteo_fisico_id: number
  referencia: string
  descripcion: string | null
  talla: string
  cantidad_sistema: number
  cantidad_fisica: number | null
  observacion: string | null
  inventrans_id: number | null
}

export type ConteoFisicoConDetalle = ConteoFisicoRow & {
  detalle: ConteoFisicoDetalleRow[]
}

export const ESTADO_CF_LABEL: Record<EstadoConteoFisico, string> = {
  abierto: "En conteo",
  cerrado: "Cerrado",
  anulado: "Anulado",
}

export const ESTADO_CF_COLOR: Record<EstadoConteoFisico, string> = {
  abierto: "bg-amber-100 text-amber-800",
  cerrado: "bg-emerald-100 text-emerald-800",
  anulado: "bg-red-100 text-red-800",
}

const CF_COLS =
  "id, numero, fecha, estado, alcance, observacion, total_lineas, lineas_con_dif, unidades_sistema, unidades_fisico, diferencia_total, abierto_por, abierto_nombre, abierto_en, cerrado_por, cerrado_nombre, cerrado_en"
const CF_DET_COLS =
  "id, conteo_fisico_id, referencia, descripcion, talla, cantidad_sistema, cantidad_fisica, observacion, inventrans_id"

async function nombreUsuario(userId: number): Promise<string | null> {
  const db = createVanessaClient()
  const { data } = await db
    .from("usuario")
    .select("nombre_completo")
    .eq("id", userId)
    .maybeSingle()
  return (data as { nombre_completo: string } | null)?.nombre_completo ?? null
}

// ── Consulta ────────────────────────────────────────────────────

export async function listConteosFisicos(input?: {
  desde?: string
  hasta?: string
  estado?: string | null
}): Promise<ConteoFisicoConDetalle[]> {
  const db = createVanessaClient()

  let q = db
    .from("conteo_fisico")
    .select(CF_COLS)
    .order("fecha", { ascending: false })
    .order("id", { ascending: false })
    .limit(2000)
  if (input?.desde) q = q.gte("fecha", input.desde)
  if (input?.hasta) q = q.lte("fecha", input.hasta)
  if (input?.estado) q = q.eq("estado", input.estado)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  const conteos = (data ?? []) as ConteoFisicoRow[]
  if (conteos.length === 0) return []

  // El detalle se pide por bloques: Supabase corta en 1000 filas
  const ids = conteos.map((c) => c.id)
  const detalles: ConteoFisicoDetalleRow[] = []
  for (let i = 0; i < ids.length; i += 50) {
    const { data: bloque } = await db
      .from("conteo_fisico_detalle")
      .select(CF_DET_COLS)
      .in("conteo_fisico_id", ids.slice(i, i + 50))
      .order("referencia")
      .limit(10000)
    detalles.push(...((bloque ?? []) as ConteoFisicoDetalleRow[]))
  }

  const porConteo = new Map<number, ConteoFisicoDetalleRow[]>()
  for (const d of detalles) {
    const arr = porConteo.get(d.conteo_fisico_id) ?? []
    arr.push(d)
    porConteo.set(d.conteo_fisico_id, arr)
  }

  return conteos.map((c) => ({ ...c, detalle: porConteo.get(c.id) ?? [] }))
}

export async function getConteoFisico(id: number): Promise<ConteoFisicoConDetalle | null> {
  const db = createVanessaClient()
  const { data } = await db.from("conteo_fisico").select(CF_COLS).eq("id", id).maybeSingle()
  const conteo = data as ConteoFisicoRow | null
  if (!conteo) return null

  const { data: detalle } = await db
    .from("conteo_fisico_detalle")
    .select(CF_DET_COLS)
    .eq("conteo_fisico_id", id)
    .order("referencia")
    .limit(10000)

  return { ...conteo, detalle: (detalle ?? []) as ConteoFisicoDetalleRow[] }
}

// ── Abrir ───────────────────────────────────────────────────────

async function siguienteNumero(): Promise<string> {
  const db = createVanessaClient()
  const { data, error } = await db.rpc("siguiente_conteo_fisico")
  if (!error && data) return String(data)

  const { data: filas } = await db.from("conteo_fisico").select("numero").limit(5000)
  let maximo = 0
  for (const f of (filas ?? []) as Array<{ numero: string }>) {
    const m = /(\d+)\s*$/.exec((f.numero ?? "").trim())
    if (m) maximo = Math.max(maximo, parseInt(m[1], 10))
  }
  return `CF-${String(maximo + 1).padStart(5, "0")}`
}

// Abre un conteo con una foto del inventario al momento: cada linea
// guarda lo que decia el sistema, para poder compararlo con lo contado.
export async function abrirConteoFisico(
  input: {
    fecha: string
    // Referencias a contar; vacio = todo el inventario
    referencias?: string[]
    observacion?: string | null
  },
  abiertoPor: number
): Promise<{ id: number; lineas: number }> {
  const db = createVanessaClient()

  // No se permiten dos conteos abiertos a la vez: las fotos se pisarian
  const { data: abiertos } = await db
    .from("conteo_fisico")
    .select("numero")
    .eq("estado", "abierto")
    .limit(1)
  if ((abiertos ?? []).length > 0) {
    throw new Error(
      `Ya hay un conteo abierto (${(abiertos as Array<{ numero: string }>)[0].numero}): ciérralo o anúlalo antes de abrir otro`
    )
  }

  const saldos = await getSaldosInventario()
  const filtro = (input.referencias ?? [])
    .map((r) => r.trim().toUpperCase())
    .filter(Boolean)

  // Se consolidan por referencia + talla, que es como se lleva el inventario
  const porLinea = new Map<string, { referencia: string; talla: string; cantidad: number }>()
  for (const s of saldos) {
    const referencia = (s.referencia ?? "").trim()
    if (!referencia) continue
    if (filtro.length > 0 && !filtro.includes(referencia.toUpperCase())) continue
    const key = `${referencia.toUpperCase()}|${s.talla.trim().toUpperCase()}`
    const actual = porLinea.get(key)
    if (actual) actual.cantidad += s.disponible
    else porLinea.set(key, { referencia, talla: s.talla.trim(), cantidad: s.disponible })
  }

  const lineas = [...porLinea.values()]
  if (lineas.length === 0) {
    throw new Error("No hay inventario que contar con esa selección")
  }

  const numero = await siguienteNumero()
  const nombre = await nombreUsuario(abiertoPor)

  const { data: conteo, error } = await db
    .from("conteo_fisico")
    .insert({
      numero,
      fecha: input.fecha,
      estado: "abierto",
      alcance: filtro.length > 0 ? "seleccion" : "todo",
      observacion: input.observacion?.trim() || null,
      total_lineas: lineas.length,
      unidades_sistema: lineas.reduce((s, l) => s + l.cantidad, 0),
      abierto_por: abiertoPor,
      abierto_nombre: nombre,
    })
    .select("id")
    .single()
  if (error || !conteo) throw new Error(error?.message ?? "Error abriendo el conteo")

  const filas = lineas.map((l) => ({
    conteo_fisico_id: conteo.id,
    referencia: l.referencia.toUpperCase(),
    talla: l.talla.toUpperCase(),
    cantidad_sistema: l.cantidad,
    cantidad_fisica: null,
  }))
  for (let i = 0; i < filas.length; i += 200) {
    const { error: errDet } = await db
      .from("conteo_fisico_detalle")
      .insert(filas.slice(i, i + 200))
    if (errDet) throw new Error(errDet.message)
  }

  return { id: conteo.id, lineas: filas.length }
}

// ── Registrar lo contado ────────────────────────────────────────

export async function guardarConteoFisico(
  conteoId: number,
  lineas: Array<{ id: number; cantidad_fisica: number | null; observacion?: string | null }>
): Promise<void> {
  const db = createVanessaClient()

  const { data: conteo } = await db
    .from("conteo_fisico")
    .select("estado")
    .eq("id", conteoId)
    .maybeSingle()
  if ((conteo as { estado: string } | null)?.estado !== "abierto") {
    throw new Error("Solo se puede registrar en un conteo abierto")
  }

  for (const l of lineas) {
    const { error } = await db
      .from("conteo_fisico_detalle")
      .update({
        cantidad_fisica: l.cantidad_fisica,
        observacion: l.observacion?.trim() || null,
      })
      .eq("id", l.id)
      .eq("conteo_fisico_id", conteoId)
    if (error) throw new Error(error.message)
  }
}

// ── Cerrar: ajusta el inventario ────────────────────────────────

export async function cerrarConteoFisico(
  conteoId: number,
  cerradoPor: number
): Promise<{ ajustes: number; diferencia: number }> {
  const db = createVanessaClient()

  const conteo = await getConteoFisico(conteoId)
  if (!conteo) throw new Error("Conteo no encontrado")
  if (conteo.estado !== "abierto") throw new Error("El conteo ya está cerrado")

  const contadas = conteo.detalle.filter((d) => d.cantidad_fisica != null)
  if (contadas.length === 0) {
    throw new Error("Registra al menos una cantidad física antes de cerrar")
  }

  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
  let ajustes = 0
  let diferenciaTotal = 0

  for (const d of contadas) {
    const fisico = Number(d.cantidad_fisica)
    const diferencia = fisico - d.cantidad_sistema
    diferenciaTotal += diferencia
    if (diferencia === 0) continue

    // El ajuste lleva la diferencia con su signo: el saldo del inventario
    // suma los ajustes tal cual, asi el sistema queda igual al fisico
    const { data: mov, error } = await db
      .from("inventrans")
      .insert({
        tipo: "ajuste",
        motivo: `Conteo físico ${conteo.numero}`,
        orden_id: null,
        numero_op: null,
        referencia: d.referencia,
        lote_id: null,
        lote_nombre: null,
        prenda_nombre: null,
        talla: d.talla,
        color: null,
        cantidad: diferencia,
        fecha: hoy,
        observacion: `Sistema ${d.cantidad_sistema} → físico ${fisico}${
          d.observacion ? ` · ${d.observacion}` : ""
        }`,
        creado_por: cerradoPor,
      })
      .select("id")
      .single()
    if (error || !mov) throw new Error(error?.message ?? "Error ajustando el inventario")

    await db
      .from("conteo_fisico_detalle")
      .update({ inventrans_id: mov.id })
      .eq("id", d.id)
    ajustes++
  }

  const nombre = await nombreUsuario(cerradoPor)
  const { error: errCierre } = await db
    .from("conteo_fisico")
    .update({
      estado: "cerrado",
      lineas_con_dif: ajustes,
      unidades_fisico: contadas.reduce((s, d) => s + Number(d.cantidad_fisica), 0),
      diferencia_total: diferenciaTotal,
      cerrado_por: cerradoPor,
      cerrado_nombre: nombre,
      cerrado_en: new Date().toISOString(),
    })
    .eq("id", conteoId)
  if (errCierre) throw new Error(errCierre.message)

  return { ajustes, diferencia: diferenciaTotal }
}

// ── Anular ──────────────────────────────────────────────────────

export async function anularConteoFisico(
  conteoId: number,
  usuarioId: number
): Promise<void> {
  const db = createVanessaClient()

  const conteo = await getConteoFisico(conteoId)
  if (!conteo) throw new Error("Conteo no encontrado")

  // Si ya habia cerrado, se retiran sus ajustes del inventario
  const movIds = conteo.detalle
    .map((d) => d.inventrans_id)
    .filter((x): x is number => x != null)
  if (movIds.length > 0) {
    const { error } = await db.from("inventrans").delete().in("id", movIds)
    if (error) throw new Error(error.message)
    await db
      .from("conteo_fisico_detalle")
      .update({ inventrans_id: null })
      .eq("conteo_fisico_id", conteoId)
  }

  const nombre = await nombreUsuario(usuarioId)
  const { error } = await db
    .from("conteo_fisico")
    .update({
      estado: "anulado",
      cerrado_por: usuarioId,
      cerrado_nombre: nombre,
      cerrado_en: new Date().toISOString(),
    })
    .eq("id", conteoId)
  if (error) throw new Error(error.message)
}

// Referencias disponibles para armar la seleccion
export async function getReferenciasParaConteo(): Promise<
  Array<{ referencia: string; tallas: number; unidades: number }>
> {
  const saldos = await getSaldosInventario()
  const map = new Map<string, { referencia: string; tallas: number; unidades: number }>()
  for (const s of saldos) {
    const referencia = (s.referencia ?? "").trim()
    if (!referencia) continue
    const key = referencia.toUpperCase()
    const actual = map.get(key)
    if (actual) {
      actual.tallas += 1
      actual.unidades += s.disponible
    } else {
      map.set(key, { referencia, tallas: 1, unidades: s.disponible })
    }
  }
  return [...map.values()].sort((a, b) =>
    a.referencia.localeCompare(b.referencia, "es", { numeric: true })
  )
}
