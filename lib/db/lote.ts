import { createVanessaClient } from "@/lib/supabase/vanessa"

export interface LoteRow {
  id: number
  corte_id: number | null
  orden_id: number
  numero_lote: number
  descripcion: string | null
  color: string | null
  cantidad_programada: number
  precio_empaque_unidad: number
  estado: string
  url_imagen: string | null
  notas_diseno: string | null
}

export const LOTE_ESTADO_LABEL: Record<string, string> = {
  cortado:     "Cortado",
  estampacion: "Estampación",
  confeccion:  "Confección",
  conteo:      "Conteo",
  empaque:     "Empaque",
  completado:  "Completado",
  finalizado:  "Finalizado",
}

export const LOTE_ESTADO_COLOR: Record<string, string> = {
  cortado:     "bg-stone-100 text-stone-700",
  estampacion: "bg-pink-100 text-pink-800",
  confeccion:  "bg-teal-100 text-teal-800",
  conteo:      "bg-yellow-100 text-yellow-800",
  empaque:     "bg-green-100 text-green-800",
  completado:  "bg-stone-100 text-stone-500",
  finalizado:  "bg-emerald-100 text-emerald-800",
}

const SELECT_COLS =
  "id, corte_id, orden_id, numero_lote, descripcion, color, cantidad_programada, precio_empaque_unidad, estado, url_imagen, notas_diseno"

export async function getLotesByOrden(ordenId: number): Promise<LoteRow[]> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("lote")
    .select(SELECT_COLS)
    .eq("orden_id", ordenId)
    .order("numero_lote")
  if (error) throw new Error(error.message)
  return (data ?? []) as LoteRow[]
}

export async function getLoteById(id: number): Promise<LoteRow | null> {
  const db = createVanessaClient()
  const { data } = await db.from("lote").select(SELECT_COLS).eq("id", id).maybeSingle()
  return data as LoteRow | null
}

export async function createLote(input: {
  corte_id: number | null
  orden_id: number
  descripcion?: string | null
  color?: string | null
  cantidad_programada: number
  precio_empaque_unidad?: number
  estado?: string
  creado_por: number
}): Promise<number> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("lote")
    .insert({
      corte_id: input.corte_id,
      orden_id: input.orden_id,
      descripcion: input.descripcion ?? null,
      color: input.color ?? null,
      cantidad_programada: input.cantidad_programada,
      precio_empaque_unidad: input.precio_empaque_unidad ?? 0,
      estado: input.estado ?? "cortado",
      creado_por: input.creado_por,
    })
    .select("id")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Error creando lote")
  return data.id
}

export async function createLoteDesdeOP(
  input: { orden_id: number; cantidad_programada?: number; descripcion?: string },
  creadoPor: number
): Promise<number> {
  return createLote({
    corte_id: null,
    orden_id: input.orden_id,
    descripcion: input.descripcion ?? null,
    color: null,
    cantidad_programada: input.cantidad_programada ?? 0,
    estado: "cortado",
    creado_por: creadoPor,
  })
}

export async function upsertLoteDesdeGrid(
  ordenId: number,
  loteNombre: string,
  cantidadProgramada: number,
  creadoPor: number
): Promise<void> {
  const db = createVanessaClient()
  // Traer TODOS los lotes con ese nombre: con maybeSingle() un duplicado
  // devolvía error (ignorado) → existing null → se creaba otro duplicado más
  const { data, error: selError } = await db
    .from("lote")
    .select("id, estado")
    .eq("orden_id", ordenId)
    .eq("descripcion", loteNombre)
    .order("id")
  if (selError) throw new Error(selError.message)
  const rows = (data ?? []) as { id: number; estado: string }[]

  if (rows.length === 0) {
    await createLoteDesdeOP(
      { orden_id: ordenId, descripcion: loteNombre, cantidad_programada: cantidadProgramada },
      creadoPor
    )
    return
  }

  // Canónico: preferir uno que ya esté en producción; si no, el más antiguo
  const canonico = rows.find((r) => r.estado !== "cortado") ?? rows[0]

  if (canonico.estado === "cortado") {
    const { error } = await db
      .from("lote")
      .update({ cantidad_programada: cantidadProgramada })
      .eq("id", canonico.id)
    if (error) throw new Error(error.message)
  }
  // Si el canónico ya está en producción, no se modifica

  // Auto-sanar: eliminar duplicados en estado "cortado" distintos del canónico
  for (const r of rows) {
    if (r.id !== canonico.id && r.estado === "cortado") {
      const { error } = await db.from("lote").delete().eq("id", r.id)
      if (error) throw new Error(error.message)
    }
  }
}

// Elimina un lote y TODOS sus registros asociados en los procesos
// (estampación, confección + insumos, conteo, empaque, novedades),
// sin importar el estado del lote.
export async function deleteLoteCascada(loteId: number): Promise<void> {
  const db = createVanessaClient()

  // Las tablas que dependen de otra fila (no de lote_id) se borran primero.
  // Si alguna tabla aún no existe en la base, se ignora y se continúa: el
  // borrado no debe quedarse a medias por un módulo no instalado.
  const ignorable = (msg: string) =>
    msg.toLowerCase().includes("does not exist") ||
    msg.toLowerCase().includes("schema cache")

  // Insumos de confección (dependen de confeccion.id)
  const { data: confs } = await db.from("confeccion").select("id").eq("lote_id", loteId)
  const confIds = ((confs ?? []) as { id: number }[]).map((c) => c.id)
  if (confIds.length > 0) {
    const { error } = await db.from("confeccion_insumo").delete().in("confeccion_id", confIds)
    if (error && !ignorable(error.message)) {
      throw new Error(`confeccion_insumo: ${error.message}`)
    }
  }

  // Detalle del conteo (depende de conteo.id)
  const { data: conteos } = await db.from("conteo").select("id").eq("lote_id", loteId)
  const conteoIds = ((conteos ?? []) as { id: number }[]).map((c) => c.id)
  if (conteoIds.length > 0) {
    const { error } = await db.from("conteo_detalle").delete().in("conteo_id", conteoIds)
    if (error && !ignorable(error.message)) {
      throw new Error(`conteo_detalle: ${error.message}`)
    }
  }

  // Abonos y comprobantes de los pagos del lote (dependen de pago_produccion.id)
  const { data: pagos } = await db.from("pago_produccion").select("id").eq("lote_id", loteId)
  const pagoIds = ((pagos ?? []) as { id: number }[]).map((x) => x.id)
  if (pagoIds.length > 0) {
    for (const tabla of ["pago_abono", "pago_comprobante"]) {
      const { error } = await db.from(tabla).delete().in("pago_id", pagoIds)
      if (error && !ignorable(error.message)) throw new Error(`${tabla}: ${error.message}`)
    }
  }

  // Todo lo que cuelga directamente del lote, incluidos los módulos nuevos:
  // inventario de producto terminado, pagos y piezas de conjunto
  for (const tabla of [
    "inventrans",
    "pago_produccion",
    "empaque_registro",
    "conteo",
    "confeccion",
    "estampacion",
    "novedad_proceso",
    "lote_prenda",
  ]) {
    const { error } = await db.from(tabla).delete().eq("lote_id", loteId)
    if (error && !ignorable(error.message)) throw new Error(`${tabla}: ${error.message}`)
  }

  const { error } = await db.from("lote").delete().eq("id", loteId)
  if (error) throw new Error(error.message)
}

// ── Diseño por lote ───────────────────────────────────────────────────────────

export async function updateLoteDiseno(
  id: number,
  input: { url_imagen?: string; notas_diseno?: string | null }
): Promise<void> {
  const db = createVanessaClient()
  const payload: Record<string, unknown> = {}
  if (input.url_imagen !== undefined) payload.url_imagen = input.url_imagen
  if (input.notas_diseno !== undefined) payload.notas_diseno = input.notas_diseno
  if (Object.keys(payload).length === 0) return
  const { error } = await db.from("lote").update(payload).eq("id", id)
  if (error) throw new Error(error.message)
}

export async function uploadImagenLote(
  file: File,
  ordenId: number,
  loteId: number
): Promise<string> {
  const db = createVanessaClient()
  const ext = file.name.split(".").pop() ?? "jpg"
  const path = `${ordenId}/lote_${loteId}_${Date.now()}.${ext}`
  const buffer = await file.arrayBuffer()
  const { error } = await db.storage
    .from("disenos")
    .upload(path, buffer, { contentType: file.type, upsert: true })
  if (error) throw new Error(error.message)
  const { data } = db.storage.from("disenos").getPublicUrl(path)
  return data.publicUrl
}

// Siguiente consecutivo de lote PARA UNA REFERENCIA. Cada referencia lleva
// su propia numeracion: el mismo "Lote 5" puede existir en referencias
// distintas. Si la referencia 910 va en 201, su siguiente lote es el 202,
// mientras que otra referencia arranca donde vaya la suya.
export async function getSiguienteConsecutivoLote(referencia?: string | null): Promise<number> {
  const db = createVanessaClient()

  const ref = (referencia ?? "").trim().toUpperCase()
  if (!ref) return 1

  // Ordenes de esa referencia (comparando sin espacios ni mayusculas)
  const { data: ordenes, error: errOrd } = await db
    .from("orden_produccion")
    .select("id, referencia")
  if (errOrd) throw new Error(errOrd.message)

  const ordenIds = ((ordenes ?? []) as Array<{ id: number; referencia: string | null }>)
    .filter((o) => (o.referencia ?? "").trim().toUpperCase() === ref)
    .map((o) => o.id)
  if (ordenIds.length === 0) return 1

  const { data, error } = await db
    .from("lote")
    .select("descripcion")
    .in("orden_id", ordenIds)
    .not("descripcion", "is", null)
    .limit(20000)
  if (error) throw new Error(error.message)

  let maximo = 0
  for (const l of (data ?? []) as Array<{ descripcion: string | null }>) {
    // Toma el numero final del nombre ("Lote 201" -> 201)
    const m = /(\d+)\s*$/.exec((l.descripcion ?? "").trim())
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > maximo) maximo = n
    }
  }
  return maximo + 1
}

export async function updateLoteEstado(id: number, estado: string): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("lote").update({ estado }).eq("id", id)
  if (error) throw new Error(error.message)
}

// Justificación registrada al finalizar el lote en empaque cuando lo
// empacado + imperfectos quedó por debajo de lo contado
export async function updateLoteJustificacionEmpaque(
  id: number,
  justificacion: string | null
): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db
    .from("lote")
    .update({ justificacion_empaque: justificacion?.trim() || null })
    .eq("id", id)
  if (error) throw new Error(error.message)
}

export type LoteConInfo = LoteRow & {
  orden: { numero_op: number; referencia: string; gama_color: string | null }
  estampacion: {
    nombre_estampador: string | null
    precio_estampacion: number | null
    fecha_entrega_lote: string | null
    fecha_estimada_entrega: string | null
    fecha_retorno_lote: string | null
  } | null
}

export async function getLotesEnEstampacion(): Promise<LoteConInfo[]> {
  const db = createVanessaClient()
  const { data: lotes, error } = await db
    .from("lote")
    .select(SELECT_COLS)
    .eq("estado", "estampacion")
    .order("numero_lote", { ascending: false })
  if (error) throw new Error(error.message)
  if (!lotes?.length) return []

  const rows = lotes as LoteRow[]

  const ordenIds = [...new Set(rows.map((l) => l.orden_id))]
  const loteIds = rows.map((l) => l.id)

  const [{ data: ops }, { data: estampaciones }] = await Promise.all([
    db
      .from("orden_produccion")
      .select("id, numero_op, referencia, gama_color")
      .in("id", ordenIds),
    db
      .from("estampacion")
      .select("lote_id, nombre_estampador, precio_estampacion, fecha_entrega_lote, fecha_estimada_entrega, fecha_retorno_lote")
      .in("lote_id", loteIds),
  ])

  const opMap = new Map(
    ((ops ?? []) as Array<{ id: number; numero_op: number; referencia: string; gama_color: string | null }>).map(
      (o) => [o.id, o]
    )
  )
  const estMap = new Map(
    (
      (estampaciones ?? []) as Array<{
        lote_id: number
        nombre_estampador: string | null
        precio_estampacion: number | null
        fecha_entrega_lote: string | null
        fecha_estimada_entrega: string | null
        fecha_retorno_lote: string | null
      }>
    ).map((e) => [e.lote_id, e])
  )

  return rows.map((l) => ({
    ...l,
    orden: opMap.get(l.orden_id) ?? { numero_op: 0, referencia: "—", gama_color: null },
    estampacion: estMap.get(l.id) ?? null,
  }))
}
