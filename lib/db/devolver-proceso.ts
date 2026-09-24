import { createVanessaClient } from "@/lib/supabase/vanessa"

// Devolver un lote al proceso anterior. Se borra lo que se registro en el
// proceso actual, de modo que el lote queda como estaba justo antes de
// que lo enviaran: se puede volver a enviar y registrar de nuevo.

export type EstadoLote =
  | "cortado"
  | "estampacion"
  | "confeccion"
  | "conteo"
  | "empaque"
  | "finalizado"

// Cadena de procesos. El anterior de cada uno es el que lo precede.
const CADENA: EstadoLote[] = [
  "cortado",
  "estampacion",
  "confeccion",
  "conteo",
  "empaque",
  "finalizado",
]

export function procesoAnterior(estado: string): EstadoLote | null {
  const i = CADENA.indexOf(estado as EstadoLote)
  if (i <= 0) return null
  return CADENA[i - 1]
}

export const PROCESO_LABEL: Record<string, string> = {
  cortado: "Corte",
  estampacion: "Estampación",
  confeccion: "Confección",
  conteo: "Conteo",
  empaque: "Empaque",
  finalizado: "Finalizado",
}

export interface ResumenDevolucion {
  lote_id: number
  numero_lote: number
  descripcion: string | null
  numero_op: number
  referencia: string
  estado_actual: string
  estado_destino: string
  // Lo que se va a borrar al devolver
  registros: Array<{ que: string; cantidad: number }>
  // Avisos de cosas que conviene revisar antes
  advertencias: string[]
}

// Que se borraria al devolver, sin tocar nada: sirve para avisarle al
// usuario antes de que confirme.
export async function previsualizarDevolucion(
  loteId: number
): Promise<ResumenDevolucion> {
  const db = createVanessaClient()

  const { data: lote } = await db
    .from("lote")
    .select("id, numero_lote, descripcion, estado, orden_id")
    .eq("id", loteId)
    .maybeSingle()
  const l = lote as {
    id: number
    numero_lote: number
    descripcion: string | null
    estado: string
    orden_id: number
  } | null
  if (!l) throw new Error("Lote no encontrado")

  const destino = procesoAnterior(l.estado)
  if (!destino) {
    throw new Error(
      `El lote está en ${PROCESO_LABEL[l.estado] ?? l.estado} y no tiene proceso anterior`
    )
  }

  const { data: orden } = await db
    .from("orden_produccion")
    .select("numero_op, referencia")
    .eq("id", l.orden_id)
    .maybeSingle()
  const o = orden as { numero_op: number; referencia: string } | null

  const registros: Array<{ que: string; cantidad: number }> = []
  const advertencias: string[] = []

  const contar = async (tabla: string, campo: string, valor: number, etiqueta: string) => {
    const { count, error } = await db
      .from(tabla)
      .select("*", { count: "exact", head: true })
      .eq(campo, valor)
    if (!error && (count ?? 0) > 0) {
      registros.push({ que: etiqueta, cantidad: count ?? 0 })
    }
    return count ?? 0
  }

  // Lo que cuelga del proceso en el que esta hoy
  if (l.estado === "estampacion") {
    await contar("estampacion", "lote_id", loteId, "Datos de estampación")
  } else if (l.estado === "confeccion") {
    const { data: confs } = await db.from("confeccion").select("id").eq("lote_id", loteId)
    const ids = ((confs ?? []) as Array<{ id: number }>).map((c) => c.id)
    if (ids.length > 0) {
      const { count } = await db
        .from("confeccion_insumo")
        .select("*", { count: "exact", head: true })
        .in("confeccion_id", ids)
      if ((count ?? 0) > 0) registros.push({ que: "Insumos de confección", cantidad: count ?? 0 })
    }
    await contar("confeccion", "lote_id", loteId, "Datos de confección")
  } else if (l.estado === "conteo") {
    const { data: conteos } = await db.from("conteo").select("id").eq("lote_id", loteId)
    const ids = ((conteos ?? []) as Array<{ id: number }>).map((c) => c.id)
    if (ids.length > 0) {
      const { count } = await db
        .from("conteo_detalle")
        .select("*", { count: "exact", head: true })
        .in("conteo_id", ids)
      if ((count ?? 0) > 0) registros.push({ que: "Líneas de conteo", cantidad: count ?? 0 })
    }
    await contar("conteo", "lote_id", loteId, "Conteo del lote")
  } else if (l.estado === "empaque" || l.estado === "finalizado") {
    const empacados = await contar(
      "empaque_registro",
      "lote_id",
      loteId,
      "Registros de empaque"
    )
    if (empacados > 0) {
      // El empaque cargo inventario: al borrarlo el producto sale del saldo
      const { data: movs } = await db
        .from("inventrans")
        .select("cantidad")
        .eq("lote_id", loteId)
        .eq("tipo", "entrada")
      const unidades = ((movs ?? []) as Array<{ cantidad: number }>).reduce(
        (s, m) => s + m.cantidad,
        0
      )
      if (unidades > 0) {
        registros.push({ que: "Entradas de inventario", cantidad: unidades })
        advertencias.push(
          `Se retirarán ${unidades.toLocaleString("es-CO")} unidades del inventario que había cargado este empaque`
        )
      }
    }
  }

  // Los pagos ya generados no se borran solos: hay que revisarlos
  const { count: pagos } = await db
    .from("pago_produccion")
    .select("*", { count: "exact", head: true })
    .eq("lote_id", loteId)
  if ((pagos ?? 0) > 0) {
    advertencias.push(
      `Este lote tiene ${pagos} pago(s) registrados: revísalos, no se borran al devolver`
    )
  }

  return {
    lote_id: l.id,
    numero_lote: l.numero_lote,
    descripcion: l.descripcion,
    numero_op: o?.numero_op ?? 0,
    referencia: o?.referencia ?? "—",
    estado_actual: l.estado,
    estado_destino: destino,
    registros,
    advertencias,
  }
}

// Devuelve el lote al proceso anterior y borra lo del proceso actual.
export async function devolverLoteAlProcesoAnterior(
  loteId: number,
  usuarioId: number
): Promise<{ destino: string; borrados: number }> {
  const db = createVanessaClient()

  const previo = await previsualizarDevolucion(loteId)
  const { estado_actual: actual, estado_destino: destino } = previo

  const ignorable = (msg: string) =>
    msg.includes("does not exist") || msg.includes("schema cache")

  const borrar = async (tabla: string, campo: string, valor: number | number[]) => {
    const q = Array.isArray(valor)
      ? db.from(tabla).delete().in(campo, valor)
      : db.from(tabla).delete().eq(campo, valor)
    const { error } = await q
    if (error && !ignorable(error.message)) throw new Error(`${tabla}: ${error.message}`)
  }

  let borrados = 0

  if (actual === "estampacion") {
    await borrar("estampacion", "lote_id", loteId)
    borrados++
  } else if (actual === "confeccion") {
    const { data: confs } = await db.from("confeccion").select("id").eq("lote_id", loteId)
    const ids = ((confs ?? []) as Array<{ id: number }>).map((c) => c.id)
    if (ids.length > 0) await borrar("confeccion_insumo", "confeccion_id", ids)
    await borrar("confeccion", "lote_id", loteId)
    borrados++
  } else if (actual === "conteo") {
    const { data: conteos } = await db.from("conteo").select("id").eq("lote_id", loteId)
    const ids = ((conteos ?? []) as Array<{ id: number }>).map((c) => c.id)
    if (ids.length > 0) await borrar("conteo_detalle", "conteo_id", ids)
    await borrar("conteo", "lote_id", loteId)
    borrados++
  } else if (actual === "empaque" || actual === "finalizado") {
    // Primero el inventario que cargo el empaque, luego los registros
    await borrar("inventrans", "lote_id", loteId)
    await borrar("empaque_registro", "lote_id", loteId)
    borrados++
  }

  // Las prendas del conjunto vuelven a la etapa de destino
  const etapaPrenda =
    destino === "confeccion"
      ? "confeccion"
      : destino === "conteo" || destino === "empaque"
        ? "conteo"
        : "estampacion"
  const { error: errPrenda } = await db
    .from("lote_prenda")
    .update({ estado: etapaPrenda })
    .eq("lote_id", loteId)
  if (errPrenda && !ignorable(errPrenda.message)) {
    throw new Error(`lote_prenda: ${errPrenda.message}`)
  }

  const { error } = await db.from("lote").update({ estado: destino }).eq("id", loteId)
  if (error) throw new Error(error.message)

  // La OP vuelve al proceso del lote menos avanzado que tenga
  const { data: lote } = await db
    .from("lote")
    .select("orden_id")
    .eq("id", loteId)
    .maybeSingle()
  const ordenId = (lote as { orden_id: number } | null)?.orden_id
  if (ordenId) {
    const { data: hermanos } = await db
      .from("lote")
      .select("estado")
      .eq("orden_id", ordenId)
    const estados = ((hermanos ?? []) as Array<{ estado: string }>).map((h) => h.estado)
    const ORDEN_OP = [
      "cortado",
      "estampacion",
      "confeccion",
      "conteo",
      "empaque",
      "finalizado",
    ]
    let menor = ORDEN_OP.length - 1
    for (const e of estados) {
      const i = ORDEN_OP.indexOf(e)
      if (i >= 0 && i < menor) menor = i
    }
    // "cortado" en el lote equivale a "corte" en la orden
    const estadoOP = ORDEN_OP[menor] === "cortado" ? "corte" : ORDEN_OP[menor]
    const { data: ordenActual } = await db
      .from("orden_produccion")
      .select("estado")
      .eq("id", ordenId)
      .maybeSingle()
    if ((ordenActual as { estado: string } | null)?.estado !== estadoOP) {
      await db.from("orden_produccion").update({ estado: estadoOP }).eq("id", ordenId)
    }
  }

  return { destino, borrados }
}

export interface LoteEnProceso {
  id: number
  numero_lote: number
  descripcion: string | null
  estado: string
  cantidad_programada: number
  numero_op: number
  referencia: string
  puede_devolver: boolean
  estado_destino: string | null
}

// Lotes con el proceso en el que estan, para la vista de devoluciones
export async function listLotesEnProceso(input?: {
  estado?: string | null
  texto?: string
}): Promise<LoteEnProceso[]> {
  const db = createVanessaClient()

  let q = db
    .from("lote")
    .select("id, numero_lote, descripcion, estado, cantidad_programada, orden_id")
    .order("id", { ascending: false })
    .limit(3000)
  if (input?.estado) q = q.eq("estado", input.estado)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  const lotes = (data ?? []) as Array<{
    id: number
    numero_lote: number
    descripcion: string | null
    estado: string
    cantidad_programada: number
    orden_id: number
  }>
  if (lotes.length === 0) return []

  const { data: ops } = await db
    .from("orden_produccion")
    .select("id, numero_op, referencia")
    .in("id", [...new Set(lotes.map((l) => l.orden_id))])
  const opMap = new Map(
    ((ops ?? []) as Array<{ id: number; numero_op: number; referencia: string }>).map((o) => [
      o.id,
      o,
    ])
  )

  const filas = lotes.map((l) => {
    const o = opMap.get(l.orden_id)
    const destino = procesoAnterior(l.estado)
    return {
      id: l.id,
      numero_lote: l.numero_lote,
      descripcion: l.descripcion,
      estado: l.estado,
      cantidad_programada: l.cantidad_programada,
      numero_op: o?.numero_op ?? 0,
      referencia: o?.referencia ?? "—",
      puede_devolver: destino != null,
      estado_destino: destino,
    }
  })

  const q2 = (input?.texto ?? "").trim().toLowerCase()
  if (!q2) return filas
  return filas.filter(
    (f) =>
      String(f.numero_op).includes(q2) ||
      f.referencia.toLowerCase().includes(q2) ||
      (f.descripcion ?? "").toLowerCase().includes(q2) ||
      String(f.numero_lote).includes(q2)
  )
}
