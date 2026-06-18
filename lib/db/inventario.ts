import { createVanessaClient } from "@/lib/supabase/vanessa"

export interface MovimientoRow {
  id: number
  material_id: number
  tipo: "entrada" | "salida"
  concepto: "compra" | "ajuste" | "devolucion" | "op_consumo" | "otro"
  cantidad: number
  orden_id: number | null
  observacion: string | null
  fecha: string
  creado_por: number | null
  creado_en: string
}

export interface VStockMaterialRow {
  material_id: number
  nombre: string
  tipo: string
  unidad_medida: string
  valor_unitario: number
  activo: boolean
  total_entradas: number
  total_salidas: number
  existencias: number
}

export async function getStockMateriales(): Promise<VStockMaterialRow[]> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("v_stock_material")
    .select("*")
    .order("nombre")
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as VStockMaterialRow[]
}

export async function getStockMaterial(materialId: number): Promise<VStockMaterialRow | null> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("v_stock_material")
    .select("*")
    .eq("material_id", materialId)
    .single()
  if (error) return null
  return data as unknown as VStockMaterialRow
}

export async function getMovimientosByMaterial(materialId: number): Promise<MovimientoRow[]> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("movimiento_inventario")
    .select("*")
    .eq("material_id", materialId)
    .order("fecha", { ascending: false })
    .order("creado_en", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as MovimientoRow[]
}

export async function createMovimiento(input: {
  material_id: number
  tipo: "entrada" | "salida"
  concepto: "compra" | "ajuste" | "devolucion" | "op_consumo" | "otro"
  cantidad: number
  orden_id?: number
  observacion?: string
  fecha?: string
  creado_por: number
}): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("movimiento_inventario").insert({
    material_id: input.material_id,
    tipo: input.tipo,
    concepto: input.concepto,
    cantidad: input.cantidad,
    orden_id: input.orden_id ?? null,
    observacion: input.observacion ?? null,
    fecha: input.fecha ?? new Date().toLocaleDateString("sv-SE", { timeZone: "America/Bogota" }),
    creado_por: input.creado_por,
  })
  if (error) throw new Error(error.message)
}
