import { createVanessaClient } from "@/lib/supabase/vanessa"

export interface VSeguimientoOP {
  orden_id: number
  numero_op: number
  referencia: string
  descripcion: string | null
  fecha_programacion: string | null
  estado: string
  total_unidades: number
  total_colores: number
  total_tallas: number
  costo_unitario: number
  precio_venta: number | null
  margen: number
  valor_total_venta: number
  costo_total_orden: number
  diseno_aprobado: boolean
  consecutivo_corte: number | null
  total_lotes: number
  lotes_en_estampacion: number
  lotes_en_confeccion: number
  lotes_en_conteo: number
  lotes_en_empaque: number
  lotes_finalizados: number
  unidades_empacadas: number
  porcentaje_avance: number
  dias_en_proceso: number
}

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

export async function getSeguimientoOPs(): Promise<VSeguimientoOP[]> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("v_seguimiento_op")
    .select("*")
    .order("fecha_programacion", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as VSeguimientoOP[]
}

export async function getPipelineProduccion(): Promise<VPipelineProduccion[]> {
  const db = createVanessaClient()
  const { data, error } = await db.from("v_pipeline_produccion").select("*")
  if (error) throw new Error(error.message)
  return (data ?? []) as VPipelineProduccion[]
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
