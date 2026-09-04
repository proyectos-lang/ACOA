import { createVanessaClient } from "@/lib/supabase/vanessa"

// Historial de registros por módulo (solo administrador).
// Muestra TODOS los registros de cada proceso, incluidos los lotes que ya
// avanzaron y dejaron de aparecer en su bandeja, y permite editarlos.

export type CampoTipo = "texto" | "numero" | "fecha" | "booleano" | "textarea"

export interface CampoDef {
  key: string
  label: string
  tipo: CampoTipo
  editable: boolean
}

export interface ModuloDef {
  key: string
  label: string
  tabla: string
  // Columna que enlaza con el lote (para mostrar OP / lote); null si la
  // tabla se enlaza directamente con la orden
  loteKey: string | null
  ordenKey: string | null
  campos: CampoDef[]
}

// Definición de cada módulo: qué tabla se lista y qué campos se pueden editar
export const MODULOS: ModuloDef[] = [
  {
    key: "estampacion",
    label: "Estampación",
    tabla: "estampacion",
    loteKey: "lote_id",
    ordenKey: null,
    campos: [
      { key: "nombre_estampador", label: "Estampador", tipo: "texto", editable: true },
      { key: "precio_estampacion", label: "Precio", tipo: "numero", editable: true },
      { key: "fecha_entrega_lote", label: "F. entrega", tipo: "fecha", editable: true },
      { key: "fecha_estimada_entrega", label: "F. estimada", tipo: "fecha", editable: true },
      { key: "fecha_retorno_lote", label: "F. retorno", tipo: "fecha", editable: true },
      { key: "observaciones_estampado", label: "Observaciones", tipo: "textarea", editable: true },
    ],
  },
  {
    key: "confeccion",
    label: "Confección",
    tabla: "confeccion",
    loteKey: "lote_id",
    ordenKey: null,
    campos: [
      { key: "nombre_confeccionista", label: "Confeccionista", tipo: "texto", editable: true },
      { key: "cantidad_reconfirmada", label: "Cant. reconf.", tipo: "numero", editable: true },
      { key: "precio_confeccion", label: "Precio", tipo: "numero", editable: true },
      { key: "fecha_entrega_lote", label: "F. entrega", tipo: "fecha", editable: true },
      { key: "fecha_estimada_entrega", label: "F. estimada", tipo: "fecha", editable: true },
      { key: "fecha_retorno_lote", label: "F. retorno", tipo: "fecha", editable: true },
      { key: "condiciones_confeccion", label: "Condiciones", tipo: "textarea", editable: true },
    ],
  },
  {
    key: "conteo",
    label: "Conteo",
    tabla: "conteo",
    loteKey: "lote_id",
    ordenKey: null,
    campos: [
      { key: "fecha_conteo", label: "F. conteo", tipo: "fecha", editable: true },
      { key: "total_contado", label: "Total contado", tipo: "numero", editable: true },
      { key: "validado", label: "Validado", tipo: "booleano", editable: true },
      { key: "observacion", label: "Observación", tipo: "textarea", editable: true },
      { key: "justificacion_diferencia", label: "Justificación", tipo: "textarea", editable: true },
    ],
  },
  {
    key: "conteo_detalle",
    label: "Conteo por talla",
    tabla: "conteo_detalle",
    loteKey: null,
    ordenKey: null,
    campos: [
      { key: "talla", label: "Talla", tipo: "texto", editable: true },
      { key: "cantidad_contada", label: "Contado", tipo: "numero", editable: true },
      { key: "imperfectos", label: "Imperfectos", tipo: "numero", editable: true },
    ],
  },
  {
    key: "empaque",
    label: "Empaque",
    tabla: "empaque_registro",
    loteKey: "lote_id",
    ordenKey: null,
    campos: [
      { key: "fecha", label: "Fecha", tipo: "fecha", editable: true },
      { key: "talla", label: "Talla", tipo: "texto", editable: true },
      { key: "cantidad", label: "Cantidad", tipo: "numero", editable: true },
      { key: "imperfectos", label: "Imperfectos", tipo: "numero", editable: true },
      { key: "precio_unidad", label: "Precio/ud", tipo: "numero", editable: true },
    ],
  },
  {
    key: "corte",
    label: "Corte",
    tabla: "corte",
    loteKey: null,
    ordenKey: "orden_id",
    campos: [
      { key: "consecutivo_corte", label: "Consecutivo", tipo: "numero", editable: true },
      { key: "fecha_programacion", label: "F. programación", tipo: "fecha", editable: true },
      { key: "fecha_corte", label: "F. corte", tipo: "fecha", editable: true },
      { key: "pendiente", label: "Pendiente", tipo: "booleano", editable: true },
      { key: "pendiente_motivo", label: "Motivo pendiente", tipo: "texto", editable: true },
    ],
  },
  {
    key: "lote_prenda",
    label: "Prendas de conjunto",
    tabla: "lote_prenda",
    loteKey: "lote_id",
    ordenKey: null,
    campos: [
      { key: "nombre", label: "Prenda", tipo: "texto", editable: true },
      { key: "estado", label: "Estado", tipo: "texto", editable: true },
      { key: "nombre_estampador", label: "Estampador", tipo: "texto", editable: true },
      { key: "est_precio", label: "Precio est.", tipo: "numero", editable: true },
      { key: "est_fecha_entrega", label: "Est. entrega", tipo: "fecha", editable: true },
      { key: "est_fecha_estimada", label: "Est. estimada", tipo: "fecha", editable: true },
      { key: "est_fecha_retorno", label: "Est. retorno", tipo: "fecha", editable: true },
      { key: "nombre_confeccionista", label: "Confeccionista", tipo: "texto", editable: true },
      { key: "conf_precio", label: "Precio conf.", tipo: "numero", editable: true },
      { key: "conf_fecha_entrega", label: "Conf. entrega", tipo: "fecha", editable: true },
      { key: "conf_fecha_estimada", label: "Conf. estimada", tipo: "fecha", editable: true },
      { key: "conf_fecha_retorno", label: "Conf. retorno", tipo: "fecha", editable: true },
      { key: "cantidad_contada", label: "Contadas", tipo: "numero", editable: true },
    ],
  },
  {
    key: "pagos",
    label: "Pagos",
    tabla: "pago_produccion",
    loteKey: "lote_id",
    ordenKey: null,
    campos: [
      { key: "proceso", label: "Proceso", tipo: "texto", editable: true },
      { key: "beneficiario", label: "Beneficiario", tipo: "texto", editable: true },
      { key: "cantidad", label: "Cantidad", tipo: "numero", editable: true },
      { key: "precio_unitario", label: "Precio unit.", tipo: "numero", editable: true },
      { key: "total", label: "Total", tipo: "numero", editable: true },
      { key: "pagado", label: "Pagado", tipo: "numero", editable: true },
      { key: "estado", label: "Estado", tipo: "texto", editable: true },
    ],
  },
]

export function getModulo(key: string): ModuloDef | null {
  return MODULOS.find((m) => m.key === key) ?? null
}

export interface RegistroHistorial {
  id: number
  // Contexto para ubicar la línea
  numero_op: number | null
  referencia: string | null
  lote_nombre: string | null
  valores: Record<string, unknown>
}

// Lista todos los registros de un módulo con su contexto de OP y lote
export async function listHistorial(moduloKey: string): Promise<RegistroHistorial[]> {
  const modulo = getModulo(moduloKey)
  if (!modulo) throw new Error("Módulo no válido")

  const db = createVanessaClient()
  const cols = ["id", ...modulo.campos.map((c) => c.key)]
  if (modulo.loteKey) cols.push(modulo.loteKey)
  if (modulo.ordenKey) cols.push(modulo.ordenKey)
  // conteo_detalle se enlaza al lote a través del conteo
  if (modulo.key === "conteo_detalle") cols.push("conteo_id")

  const { data, error } = await db
    .from(modulo.tabla)
    .select(cols.join(", "))
    .order("id", { ascending: false })
    .limit(2000)
  if (error) throw new Error(error.message)

  const filas = (data ?? []) as unknown as Array<Record<string, unknown>>
  if (filas.length === 0) return []

  // Resolver lote → orden para mostrar OP, referencia y nombre del lote
  const loteIds = new Set<number>()
  const ordenIds = new Set<number>()

  // conteo_detalle: conteo_id → lote_id
  const conteoALote = new Map<number, number>()
  if (modulo.key === "conteo_detalle") {
    const conteoIds = [...new Set(filas.map((f) => f.conteo_id as number).filter(Boolean))]
    if (conteoIds.length > 0) {
      const { data: conteos } = await db.from("conteo").select("id, lote_id").in("id", conteoIds)
      for (const c of (conteos ?? []) as Array<{ id: number; lote_id: number }>) {
        conteoALote.set(c.id, c.lote_id)
        loteIds.add(c.lote_id)
      }
    }
  }

  for (const f of filas) {
    if (modulo.loteKey && f[modulo.loteKey]) loteIds.add(f[modulo.loteKey] as number)
    if (modulo.ordenKey && f[modulo.ordenKey]) ordenIds.add(f[modulo.ordenKey] as number)
  }

  const lotesMap = new Map<number, { nombre: string; orden_id: number }>()
  if (loteIds.size > 0) {
    const { data: lotes } = await db
      .from("lote")
      .select("id, numero_lote, descripcion, orden_id")
      .in("id", [...loteIds])
    for (const l of (lotes ?? []) as Array<{
      id: number
      numero_lote: number
      descripcion: string | null
      orden_id: number
    }>) {
      lotesMap.set(l.id, {
        nombre: l.descripcion ?? `LOTE-${String(l.numero_lote).padStart(4, "0")}`,
        orden_id: l.orden_id,
      })
      ordenIds.add(l.orden_id)
    }
  }

  const ordenesMap = new Map<number, { numero_op: number; referencia: string }>()
  if (ordenIds.size > 0) {
    const { data: ops } = await db
      .from("orden_produccion")
      .select("id, numero_op, referencia")
      .in("id", [...ordenIds])
    for (const o of (ops ?? []) as Array<{ id: number; numero_op: number; referencia: string }>) {
      ordenesMap.set(o.id, { numero_op: o.numero_op, referencia: o.referencia })
    }
  }

  return filas.map((f) => {
    let loteId: number | null = null
    if (modulo.key === "conteo_detalle") {
      loteId = conteoALote.get(f.conteo_id as number) ?? null
    } else if (modulo.loteKey) {
      loteId = (f[modulo.loteKey] as number) ?? null
    }

    const lote = loteId != null ? lotesMap.get(loteId) : undefined
    const ordenId = lote?.orden_id ?? (modulo.ordenKey ? (f[modulo.ordenKey] as number) : null)
    const orden = ordenId != null ? ordenesMap.get(ordenId) : undefined

    const valores: Record<string, unknown> = {}
    for (const c of modulo.campos) valores[c.key] = f[c.key]

    return {
      id: f.id as number,
      numero_op: orden?.numero_op ?? null,
      referencia: orden?.referencia ?? null,
      lote_nombre: lote?.nombre ?? null,
      valores,
    }
  })
}

// Edita un registro del historial. Solo se aceptan campos declarados como
// editables en la definición del módulo (evita tocar columnas arbitrarias).
export async function updateRegistroHistorial(
  moduloKey: string,
  registroId: number,
  campos: Record<string, unknown>
): Promise<void> {
  const modulo = getModulo(moduloKey)
  if (!modulo) throw new Error("Módulo no válido")

  const permitidos = new Map(modulo.campos.filter((c) => c.editable).map((c) => [c.key, c]))
  const updates: Record<string, unknown> = {}

  for (const [key, valor] of Object.entries(campos)) {
    const def = permitidos.get(key)
    if (!def) continue
    if (valor === "" || valor === null || valor === undefined) {
      updates[key] = null
    } else if (def.tipo === "numero") {
      const n = Number(valor)
      if (isNaN(n)) throw new Error(`El campo "${def.label}" debe ser numérico`)
      updates[key] = n
    } else if (def.tipo === "booleano") {
      updates[key] = valor === true || valor === "true"
    } else {
      updates[key] = String(valor)
    }
  }

  if (Object.keys(updates).length === 0) return

  const db = createVanessaClient()
  const { error } = await db.from(modulo.tabla).update(updates).eq("id", registroId)
  if (error) throw new Error(error.message)
}

export async function deleteRegistroHistorial(
  moduloKey: string,
  registroId: number
): Promise<void> {
  const modulo = getModulo(moduloKey)
  if (!modulo) throw new Error("Módulo no válido")
  const db = createVanessaClient()
  const { error } = await db.from(modulo.tabla).delete().eq("id", registroId)
  if (error) throw new Error(error.message)
}
