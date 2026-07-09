import { createVanessaClient } from "@/lib/supabase/vanessa"

export interface HojaCostosRow {
  id: number
  orden_id: number
  valor_cordon: number
  valor_empaque: number
  valor_bandera: number
  valor_corte: number
  valor_trazos_insumos_corte: number
  valor_estampacion_aplique_dtf: number
  valor_confeccion: number
  valor_bolsas_flechas_stickers: number
  valor_etiqueta: number
  valor_instruccion: number
  valor_comision: number
  valor_transporte: number
  valor_flete: number
  valor_viaticos: number
  valor_oros: number
  costo_materiales: number
  costo_unitario: number
  precio_venta: number | null
  margen: number
  total_unidades: number
  costo_total: number
  porc_iva: number
  porc_retencion: number
}

export const VALORES_FIJOS: Array<{ key: keyof HojaCostosRow; label: string }> = [
  { key: "valor_cordon",                  label: "Cordón" },
  { key: "valor_empaque",                 label: "Empaque" },
  { key: "valor_bandera",                 label: "Bandera" },
  { key: "valor_corte",                   label: "Corte" },
  { key: "valor_trazos_insumos_corte",    label: "Trazos e insumos de corte" },
  { key: "valor_estampacion_aplique_dtf", label: "Estampación / Aplique DTF" },
  { key: "valor_confeccion",              label: "Confección" },
  { key: "valor_bolsas_flechas_stickers", label: "Bolsas, flechas y stickers" },
  { key: "valor_etiqueta",                label: "Etiqueta" },
  { key: "valor_instruccion",             label: "Instrucción" },
  { key: "valor_comision",                label: "Comisión" },
  { key: "valor_transporte",              label: "Transporte" },
  { key: "valor_flete",                   label: "Flete" },
  { key: "valor_viaticos",                label: "Viáticos" },
  { key: "valor_oros",                    label: "Oros" },
]

const SELECT_COLS = [
  "id", "orden_id",
  "valor_cordon", "valor_empaque", "valor_bandera", "valor_corte",
  "valor_trazos_insumos_corte", "valor_estampacion_aplique_dtf",
  "valor_confeccion", "valor_bolsas_flechas_stickers", "valor_etiqueta",
  "valor_instruccion", "valor_comision", "valor_transporte", "valor_flete",
  "valor_viaticos", "valor_oros",
  "costo_materiales", "costo_unitario", "precio_venta", "margen",
  "total_unidades", "costo_total", "porc_iva", "porc_retencion",
].join(", ")

export async function getHojaCostos(ordenId: number): Promise<HojaCostosRow | null> {
  const db = createVanessaClient()
  const { data } = await db
    .from("hoja_costos")
    .select(SELECT_COLS)
    .eq("orden_id", ordenId)
    .single()
  return data as HojaCostosRow | null
}

export async function updateHojaCostos(
  ordenId: number,
  input: Partial<Omit<HojaCostosRow, "id" | "orden_id" | "margen" | "costo_total">>
): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db
    .from("hoja_costos")
    .upsert({ orden_id: ordenId, ...input }, { onConflict: "orden_id" })
  if (error) throw new Error(error.message)
}
