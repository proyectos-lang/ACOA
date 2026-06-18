import { createVanessaClient } from "@/lib/supabase/vanessa"

export interface LiquidacionRow {
  id: number
  periodo_id: number
  persona_id: number
  tipo_pago: string
  valor_hora: number | null
  valor_dia: number | null
  total_devengado: number
  estado: "borrador" | "liquidado"
}

export interface LiquidacionConPersona extends LiquidacionRow {
  persona: { nombre: string; documento: string } | null
}

export interface LiquidacionDetalleRow {
  id: number
  liquidacion_id: number
  concepto: string
  descripcion: string | null
  cantidad: number
  valor_unitario: number
  valor_total: number
}

export async function getLiquidacionesPorPeriodo(
  periodoId: number
): Promise<LiquidacionConPersona[]> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("liquidacion")
    .select("*, persona!fk_liquidacion_persona(nombre, documento)")
    .eq("periodo_id", periodoId)
    .order("persona_id")
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as LiquidacionConPersona[]
}

export async function upsertLiquidacion(input: {
  periodo_id: number
  persona_id: number
  tipo_pago: string
  valor_hora: number | null
  valor_dia: number | null
  total_devengado: number
  creado_por: number
}): Promise<number> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("liquidacion")
    .upsert(
      {
        periodo_id: input.periodo_id,
        persona_id: input.persona_id,
        tipo_pago: input.tipo_pago,
        valor_hora: input.valor_hora,
        valor_dia: input.valor_dia,
        total_devengado: input.total_devengado,
        estado: "borrador",
        creado_por: input.creado_por,
      },
      { onConflict: "periodo_id,persona_id" }
    )
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  return data!.id
}

export async function deleteLiquidacionDetalles(liquidacionId: number): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db
    .from("liquidacion_detalle")
    .delete()
    .eq("liquidacion_id", liquidacionId)
  if (error) throw new Error(error.message)
}

export async function insertLiquidacionDetalles(
  liquidacionId: number,
  detalles: Array<{
    concepto: string
    descripcion?: string
    cantidad: number
    valor_unitario: number
    valor_total: number
  }>
): Promise<void> {
  if (detalles.length === 0) return
  const db = createVanessaClient()
  const rows = detalles.map((d) => ({
    liquidacion_id: liquidacionId,
    concepto: d.concepto,
    descripcion: d.descripcion ?? null,
    cantidad: d.cantidad,
    valor_unitario: d.valor_unitario,
    valor_total: d.valor_total,
  }))
  const { error } = await db.from("liquidacion_detalle").insert(rows)
  if (error) throw new Error(error.message)
}

export async function getDetallesPorLiquidacion(
  liquidacionId: number
): Promise<LiquidacionDetalleRow[]> {
  const db = createVanessaClient()
  const { data } = await db
    .from("liquidacion_detalle")
    .select("*")
    .eq("liquidacion_id", liquidacionId)
    .order("id")
  return (data ?? []) as LiquidacionDetalleRow[]
}
