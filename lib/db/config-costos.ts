import { createVanessaClient } from "@/lib/supabase/vanessa"

// Costos estándar por concepto fijo (clave = key de VALORES_FIJOS, ej. "valor_cordon").
// Se cargan como valor por defecto en la pestaña Materiales de cada OP.

export async function getConfigCostos(): Promise<Record<string, number>> {
  const db = createVanessaClient()
  const { data, error } = await db.from("config_costos").select("clave, valor")
  if (error) throw new Error(error.message)
  const out: Record<string, number> = {}
  for (const r of (data ?? []) as { clave: string; valor: number }[]) {
    out[r.clave] = Number(r.valor) || 0
  }
  return out
}

export async function saveConfigCostos(
  valores: Record<string, number>,
  userId: number
): Promise<void> {
  const db = createVanessaClient()
  const rows = Object.entries(valores).map(([clave, valor]) => ({
    clave,
    valor,
    actualizado_por: userId,
    actualizado_en: new Date().toISOString(),
  }))
  if (rows.length === 0) return
  const { error } = await db.from("config_costos").upsert(rows, { onConflict: "clave" })
  if (error) throw new Error(error.message)
}
