import { createVanessaClient } from "@/lib/supabase/vanessa"

export interface VPipelineProduccion {
  estado: string
  cantidad_ordenes: number
  total_unidades: number
  valor_total: number
}

export interface VLotesActivos {
  lote_id: number
  numero_lote: number
  color: string
  cantidad_programada: number
  estado_lote: string
  orden_id: number
  numero_op: number
  referencia: string
  nombre_estampador: string | null
  fecha_entrega_lote: string | null
  fecha_retorno_lote: string | null
  total_contado: number
  unidades_empacadas: number
}

// Antes leia la vista v_pipeline_produccion, que nunca existio en la base
// (no esta en ningun script ni en el commit inicial): la consulta fallaba,
// /seguimiento devolvia HTTP 500 y la gerente no podia abrir el modulo.
// Se calcula aqui para no depender de una vista que hay que crear a mano.
export async function getPipelineProduccion(): Promise<VPipelineProduccion[]> {
  const db = createVanessaClient()
  const [
    { data: ordenes, error: errOrdenes },
    { data: lotes, error: errLotes },
    { data: hojas, error: errHojas },
  ] = await Promise.all([
    db.from("orden_produccion").select("id, estado").limit(10000),
    db.from("lote").select("orden_id, cantidad_programada").limit(20000),
    db.from("hoja_costos").select("orden_id, precio_venta").limit(10000),
  ])
  if (errOrdenes) throw new Error(errOrdenes.message)
  if (errLotes) throw new Error(errLotes.message)
  if (errHojas) throw new Error(errHojas.message)

  const unidadesPorOrden = new Map<number, number>()
  for (const l of (lotes ?? []) as Array<{ orden_id: number; cantidad_programada: number }>) {
    unidadesPorOrden.set(
      l.orden_id,
      (unidadesPorOrden.get(l.orden_id) ?? 0) + (Number(l.cantidad_programada) || 0)
    )
  }
  const precioPorOrden = new Map<number, number>()
  for (const h of (hojas ?? []) as Array<{ orden_id: number; precio_venta: number | null }>) {
    precioPorOrden.set(h.orden_id, Number(h.precio_venta) || 0)
  }

  const porEstado = new Map<string, VPipelineProduccion>()
  for (const o of (ordenes ?? []) as Array<{ id: number; estado: string }>) {
    const acc = porEstado.get(o.estado) ?? {
      estado: o.estado,
      cantidad_ordenes: 0,
      total_unidades: 0,
      valor_total: 0,
    }
    const unidades = unidadesPorOrden.get(o.id) ?? 0
    acc.cantidad_ordenes += 1
    acc.total_unidades += unidades
    acc.valor_total += unidades * (precioPorOrden.get(o.id) ?? 0)
    porEstado.set(o.estado, acc)
  }
  return [...porEstado.values()]
}

export async function getLotesActivos(): Promise<VLotesActivos[]> {
  const db = createVanessaClient()
  const { data, error } = await db.from("v_lotes_activos").select("*")
  if (error) throw new Error(error.message)
  return (data ?? []) as VLotesActivos[]
}

export interface VSeguimientoLote {
  lote_id: number
  numero_lote: number
  lote_descripcion: string | null
  cantidad_programada: number
  estado_lote: string
  orden_id: number
  numero_op: number
  referencia: string
  op_descripcion: string | null
  estado_op: string
  total_capas: number
  nombre_estampador: string | null
  fecha_retorno_estampacion: string | null
  nombre_confeccionista: string | null
  fecha_retorno_confeccion: string | null
  total_contado: number | null
  conteo_validado: boolean | null
  total_empacado: number
}

export async function getSeguimientoLotes(): Promise<VSeguimientoLote[]> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("v_seguimiento_lotes")
    .select("*")
  if (error) throw new Error(error.message)
  return (data ?? []) as VSeguimientoLote[]
}
