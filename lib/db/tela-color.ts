import { createVanessaClient } from "@/lib/supabase/vanessa"

// Gama de colores preestablecida por tela. Al elegir la tela en la Curva
// de una OP, sus colores se cargan automáticamente.

export interface TelaColorRow {
  id: number
  material_id: number
  color: string
  orden: number
  activo: boolean
}

const SELECT_COLS = "id, material_id, color, orden, activo"

// Gama de una tela (solo colores activos, en su orden)
export async function getGamaTela(materialId: number): Promise<TelaColorRow[]> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("tela_color")
    .select(SELECT_COLS)
    .eq("material_id", materialId)
    .eq("activo", true)
    .order("orden")
    .order("color")
  if (error) throw new Error(error.message)
  return (data ?? []) as TelaColorRow[]
}

// Todas las gamas, indexadas por material: para la pantalla de Materiales
export async function getGamasPorMaterial(): Promise<Record<number, string[]>> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("tela_color")
    .select(SELECT_COLS)
    .eq("activo", true)
    .order("orden")
    .order("color")
  if (error) throw new Error(error.message)

  const mapa: Record<number, string[]> = {}
  for (const c of (data ?? []) as TelaColorRow[]) {
    if (!mapa[c.material_id]) mapa[c.material_id] = []
    mapa[c.material_id].push(c.color)
  }
  return mapa
}

// Gamas indexadas por NOMBRE de tela en mayúsculas: la Curva de la OP
// trabaja con el nombre del material, no con su id
export async function getGamasPorNombreTela(): Promise<Record<string, string[]>> {
  const db = createVanessaClient()

  const [{ data: colores, error }, { data: materiales }] = await Promise.all([
    db.from("tela_color").select(SELECT_COLS).eq("activo", true).order("orden").order("color"),
    db.from("material").select("id, nombre"),
  ])
  if (error) throw new Error(error.message)

  const nombrePorId = new Map(
    ((materiales ?? []) as Array<{ id: number; nombre: string }>).map((m) => [
      m.id,
      m.nombre.trim().toUpperCase(),
    ])
  )

  const mapa: Record<string, string[]> = {}
  for (const c of (colores ?? []) as TelaColorRow[]) {
    const nombre = nombrePorId.get(c.material_id)
    if (!nombre) continue
    if (!mapa[nombre]) mapa[nombre] = []
    mapa[nombre].push(c.color)
  }
  return mapa
}

// Reemplaza la gama completa de una tela (el orden es el del arreglo)
export async function replaceGamaTela(
  materialId: number,
  colores: string[],
  creadoPor: number
): Promise<void> {
  const db = createVanessaClient()

  const { error: delErr } = await db.from("tela_color").delete().eq("material_id", materialId)
  if (delErr) throw new Error(delErr.message)

  // Sin duplicados y respetando el orden en que quedaron
  const vistos = new Set<string>()
  const filas: Array<{ material_id: number; color: string; orden: number; creado_por: number }> = []
  colores.forEach((c) => {
    const color = c.trim().toUpperCase().replace(/\s+/g, " ")
    if (!color || vistos.has(color)) return
    vistos.add(color)
    filas.push({
      material_id: materialId,
      color,
      orden: filas.length + 1,
      creado_por: creadoPor,
    })
  })

  if (filas.length > 0) {
    const { error } = await db.from("tela_color").insert(filas)
    if (error) throw new Error(error.message)
  }
}

// Agrega un color al final de la gama de una tela
export async function agregarColorTela(
  materialId: number,
  color: string,
  creadoPor: number
): Promise<void> {
  const limpio = color.trim().toUpperCase().replace(/\s+/g, " ")
  if (!limpio) throw new Error("Escribe el nombre del color")

  const actuales = await getGamaTela(materialId)
  if (actuales.some((c) => c.color.toUpperCase() === limpio)) {
    throw new Error(`El color "${limpio}" ya está en la gama de esta tela`)
  }

  const db = createVanessaClient()
  const { error } = await db.from("tela_color").insert({
    material_id: materialId,
    color: limpio,
    orden: actuales.length + 1,
    creado_por: creadoPor,
  })
  if (error) throw new Error(error.message)
}

export async function eliminarColorTela(id: number): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("tela_color").delete().eq("id", id)
  if (error) throw new Error(error.message)
}
