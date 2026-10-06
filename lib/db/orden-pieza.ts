import { createVanessaClient } from "@/lib/supabase/vanessa"

// Piezas de un conjunto, definidas una sola vez en la ficha de la OP.
// Todos los lotes de la orden las heredan al entrar a estampacion
// (lote_prenda.orden_pieza_id). Antes cada lote escribia sus piezas a
// mano y la base acumulo 11 variantes de nombre para lo mismo.

export interface OrdenPiezaRow {
  id: number
  orden_id: number
  nombre: string
  posicion: number
}

export const PIEZAS_POR_DEFECTO = ["Superior", "Inferior"] as const

// Una OP cuya unica pieza es esta se trabaja sin dividir
export const PIEZA_CONJUNTO_COMPLETO = "Conjunto completo"

// Misma regla que vanessa.normalizar_pieza() en la base: espacios
// simples, Capitalizado, y cualquier variante de "conjunto completo"
// unificada
export function normalizarNombrePieza(nombre: string): string {
  const limpio = nombre.trim().replace(/\s+/g, " ")
  if (/^conjunto complet/i.test(limpio)) return PIEZA_CONJUNTO_COMPLETO
  return limpio.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())
}

// La tabla llega con el script 46. Si aun no se ha corrido, la ficha de la
// OP no se cae: muestra la seccion vacia y el guardado avisa que falta.
function tablaNoExiste(msg: string): boolean {
  const m = msg.toLowerCase()
  return m.includes("schema cache") || m.includes("does not exist")
}

export async function listPiezasByOrden(ordenId: number): Promise<OrdenPiezaRow[]> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("orden_pieza")
    .select("id, orden_id, nombre, posicion")
    .eq("orden_id", ordenId)
    .order("posicion")
    .order("id")
  if (error) {
    if (tablaNoExiste(error.message)) return []
    throw new Error(error.message)
  }
  return (data ?? []) as OrdenPiezaRow[]
}

// Garantiza que una OP tipo conjunto tenga piezas: si no definio ninguna
// se crean las de por defecto. Idempotente. Para OPs de una sola prenda
// devuelve la lista vacia sin crear nada.
export async function asegurarPiezasOrden(
  ordenId: number,
  creadoPor: number
): Promise<OrdenPiezaRow[]> {
  const existentes = await listPiezasByOrden(ordenId)
  if (existentes.length > 0) return existentes

  const db = createVanessaClient()
  const { data: orden } = await db
    .from("orden_produccion")
    .select("tipo_prenda")
    .eq("id", ordenId)
    .maybeSingle()
  if ((orden as { tipo_prenda: string } | null)?.tipo_prenda !== "conjunto") return []

  const { error } = await db.from("orden_pieza").insert(
    PIEZAS_POR_DEFECTO.map((nombre, i) => ({
      orden_id: ordenId,
      nombre,
      posicion: i + 1,
      creado_por: creadoPor,
    }))
  )
  if (error) throw new Error(error.message)
  return listPiezasByOrden(ordenId)
}

// Cuantos lotes ya tienen esta pieza en proceso. Una pieza en uso no se
// puede retirar de la OP: sus lotes perderian el enlace.
async function lotesUsandoPieza(piezaId: number): Promise<number> {
  const db = createVanessaClient()
  const { count, error } = await db
    .from("lote_prenda")
    .select("*", { count: "exact", head: true })
    .eq("orden_pieza_id", piezaId)
  if (error) throw new Error(error.message)
  return count ?? 0
}

// Deja la OP con exactamente estas piezas, en este orden. Crea las nuevas,
// reordena las que siguen y retira las que ya no estan, siempre que ningun
// lote las use.
export async function guardarPiezasOrden(
  ordenId: number,
  nombres: string[],
  creadoPor: number
): Promise<{ creadas: number; retiradas: number }> {
  const limpios: string[] = []
  for (const n of nombres) {
    const limpio = normalizarNombrePieza(n)
    if (limpio && !limpios.some((x) => x.toLowerCase() === limpio.toLowerCase())) {
      limpios.push(limpio)
    }
  }
  if (limpios.length === 0) throw new Error("Un conjunto necesita al menos una pieza")

  const db = createVanessaClient()
  const actuales = await listPiezasByOrden(ordenId)

  // Retirar las que ya no estan
  let retiradas = 0
  for (const p of actuales) {
    if (limpios.some((n) => n.toLowerCase() === p.nombre.toLowerCase())) continue
    const enUso = await lotesUsandoPieza(p.id)
    if (enUso > 0) {
      throw new Error(
        `La pieza "${p.nombre}" ya esta en ${enUso} lote(s) en proceso y no se puede retirar`
      )
    }
    const { error } = await db.from("orden_pieza").delete().eq("id", p.id)
    if (error) throw new Error(error.message)
    retiradas++
  }

  // Crear las nuevas y fijar la posicion de todas
  let creadas = 0
  for (let i = 0; i < limpios.length; i++) {
    const nombre = limpios[i]
    const existente = actuales.find((p) => p.nombre.toLowerCase() === nombre.toLowerCase())
    if (existente) {
      if (existente.posicion !== i + 1 || existente.nombre !== nombre) {
        const { error } = await db
          .from("orden_pieza")
          .update({ posicion: i + 1, nombre })
          .eq("id", existente.id)
        if (error) throw new Error(error.message)
      }
    } else {
      const { error } = await db
        .from("orden_pieza")
        .insert({ orden_id: ordenId, nombre, posicion: i + 1, creado_por: creadoPor })
      if (error) throw new Error(error.message)
      creadas++
    }
  }

  return { creadas, retiradas }
}
