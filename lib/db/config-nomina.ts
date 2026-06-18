import { createVanessaClient } from "@/lib/supabase/vanessa"

export interface ConfigNominaRow {
  id: number
  vigente_desde: string
  umbral_horas_extra_diario: number
  factor_extra_diurna: number
  factor_extra_nocturna: number
  factor_recargo_nocturno: number
  factor_dominical_festivo: number
  hora_inicio_nocturno: string
  hora_fin_nocturno: string
  vigente: boolean
}

/** Configuración vigente en una fecha dada (mayor vigente_desde <= fecha). */
export async function getConfigVigente(fecha: string): Promise<ConfigNominaRow | null> {
  const db = createVanessaClient()
  const { data } = await db
    .from("configuracion_nomina")
    .select("*")
    .lte("vigente_desde", fecha)
    .order("vigente_desde", { ascending: false })
    .limit(1)
    .single()
  return data as ConfigNominaRow | null
}

export async function getConfigActual(): Promise<ConfigNominaRow | null> {
  return getConfigVigente(new Date().toISOString().substring(0, 10))
}

export async function listConfigs(): Promise<ConfigNominaRow[]> {
  const db = createVanessaClient()
  const { data } = await db
    .from("configuracion_nomina")
    .select("*")
    .order("vigente_desde", { ascending: false })
  return (data ?? []) as ConfigNominaRow[]
}

export async function updateConfig(id: number, updates: Partial<Omit<ConfigNominaRow, "id">>): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("configuracion_nomina").update(updates).eq("id", id)
  if (error) throw new Error(error.message)
}
