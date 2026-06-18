import { createVanessaClient } from "@/lib/supabase/vanessa"

export interface NovedadProcesoRow {
  id: number
  lote_id: number
  proceso: "estampacion" | "confeccion"
  tipo: "reposicion" | "averia" | "dano" | "cobro" | "compra"
  cantidad: number
  valor: number
  descripcion: string | null
  creado_en: string
}

export const TIPO_NOVEDAD_LABEL: Record<string, string> = {
  reposicion: "Reposición",
  averia:     "Avería",
  dano:       "Daño",
  cobro:      "Cobro",
  compra:     "Compra",
}

export const TIPO_NOVEDAD_COLOR: Record<string, string> = {
  reposicion: "bg-blue-100 text-blue-800",
  averia:     "bg-amber-100 text-amber-800",
  dano:       "bg-red-100 text-red-800",
  cobro:      "bg-purple-100 text-purple-800",
  compra:     "bg-green-100 text-green-800",
}

const SELECT_COLS = "id, lote_id, proceso, tipo, cantidad, valor, descripcion, creado_en"

export async function getNovedadesByLote(
  loteId: number,
  proceso?: "estampacion" | "confeccion"
): Promise<NovedadProcesoRow[]> {
  const db = createVanessaClient()
  let q = db.from("novedad_proceso").select(SELECT_COLS).eq("lote_id", loteId)
  if (proceso) q = q.eq("proceso", proceso)
  q = q.order("id")
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as NovedadProcesoRow[]
}

export async function createNovedadProceso(input: {
  lote_id: number
  proceso: "estampacion" | "confeccion"
  tipo: "reposicion" | "averia" | "dano" | "cobro" | "compra"
  cantidad: number
  valor: number
  descripcion?: string | null
  creado_por: number
}): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("novedad_proceso").insert({
    lote_id: input.lote_id,
    proceso: input.proceso,
    tipo: input.tipo,
    cantidad: input.cantidad,
    valor: input.valor,
    descripcion: input.descripcion ?? null,
    creado_por: input.creado_por,
  })
  if (error) throw new Error(error.message)
}

export async function deleteNovedadProceso(id: number): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("novedad_proceso").delete().eq("id", id)
  if (error) throw new Error(error.message)
}
