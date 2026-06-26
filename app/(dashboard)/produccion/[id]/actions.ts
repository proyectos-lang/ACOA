"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getSession } from "@/lib/auth/session"
import { updateOrden, uploadMolde, cambiarEstado } from "@/lib/db/orden-produccion"
import { addOpMaterial, updateOpMaterial, deleteOpMaterial } from "@/lib/db/op-material"
import { batchReplaceCurvaTallas } from "@/lib/db/curva-talla"
import { upsertOpTela, deleteOpTela } from "@/lib/db/op-tela"
import { batchSaveSlotLotes, getOpTelaLotes } from "@/lib/db/op-tela-lote"
import { createLoteDesdeOP, upsertLoteDesdeGrid } from "@/lib/db/lote"
import { createVanessaClient } from "@/lib/supabase/vanessa"

export interface ActionResult {
  error?: string
  success?: boolean
}

// ── Info general de la OP ─────────────────────────────────────────────────────

const infoSchema = z.object({
  referencia: z.string().min(1, "Referencia requerida"),
  descripcion: z.string().optional(),
  fecha_programacion: z.string().optional(),
  gama_color: z.string().optional(),
})

export async function guardarInfoGeneralAction(
  ordenId: number,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  const parsed = infoSchema.safeParse({
    referencia: formData.get("referencia"),
    descripcion: formData.get("descripcion") || undefined,
    fecha_programacion: formData.get("fecha_programacion") || undefined,
    gama_color: formData.get("gama_color") || undefined,
  })
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  try {
    await updateOrden(ordenId, {
      referencia: parsed.data.referencia,
      descripcion: parsed.data.descripcion || null,
      fecha_programacion: parsed.data.fecha_programacion || null,
      gama_color: parsed.data.gama_color || null,
    })

    const moldeFile = formData.get("molde") as File | null
    if (moldeFile && moldeFile.size > 0) {
      const url = await uploadMolde(moldeFile, ordenId)
      await updateOrden(ordenId, { url_molde: url })
    }

    revalidatePath(`/produccion/${ordenId}`)
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error guardando información" }
  }
}

// ── Instrucciones para costura ────────────────────────────────────────────────

export async function guardarInstruccionesAction(
  ordenId: number,
  observaciones: string
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await updateOrden(ordenId, { observaciones: observaciones.trim() || null })
    revalidatePath(`/produccion/${ordenId}`)
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error guardando instrucciones" }
  }
}

// ── Curva de tallas ───────────────────────────────────────────────────────────

export async function guardarCurvaAction(
  ordenId: number,
  tallas: string[]
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await batchReplaceCurvaTallas(ordenId, tallas, session.userId)
    revalidatePath(`/produccion/${ordenId}`)
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error guardando curva" }
  }
}

// ── Materiales ────────────────────────────────────────────────────────────────

export async function addOpMaterialAction(input: {
  orden_id: number
  material_id?: number | null
  tipo: string
  nombre: string
  unidad_medida: string
  valor_unitario: number
  consumo_estimado?: number | null
}): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  if (!input.tipo || !input.nombre || !input.unidad_medida)
    return { error: "Tipo, nombre y unidad son requeridos" }

  try {
    await addOpMaterial({ ...input, creado_por: session.userId })
    revalidatePath(`/produccion/${input.orden_id}`)
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error agregando material" }
  }
}

export async function updateOpMaterialAction(
  id: number,
  ordenId: number,
  input: {
    tipo?: string
    nombre?: string
    unidad_medida?: string
    valor_unitario?: number
    consumo_estimado?: number | null
  }
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await updateOpMaterial(id, input)
    revalidatePath(`/produccion/${ordenId}`)
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error actualizando material" }
  }
}

export async function deleteOpMaterialAction(
  id: number,
  ordenId: number
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await deleteOpMaterial(id)
    revalidatePath(`/produccion/${ordenId}`)
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error eliminando material" }
  }
}

// ── Materiales de tela por OP (slots 1-3) ────────────────────────────────────

export async function guardarSlotAction(
  ordenId: number,
  slot: 1 | 2 | 3,
  tipoTela: string | null,
  colores: string[],
  grid: { lote_nombre: string; capas_por_color: number[] }[],
  tallasCount: number
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  const coloresFiltrados = colores.filter((c) => c.trim())
  if (coloresFiltrados.length === 0 && grid.length === 0) {
    // Slot vacío: limpiar
    try {
      await deleteOpTela(ordenId, slot)
      await batchSaveSlotLotes(ordenId, slot, [], session.userId)
      revalidatePath(`/produccion/${ordenId}`)
      return { success: true }
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : "Error limpiando slot" }
    }
  }

  try {
    // 1. Reemplazar colores del slot
    await deleteOpTela(ordenId, slot)
    for (const color of coloresFiltrados) {
      await upsertOpTela({ orden_id: ordenId, slot, tipo_tela: tipoTela || null, color, creado_por: session.userId })
    }

    // 2. Construir y guardar filas op_tela_lote
    const filas: { color: string; lote_nombre: string; capas: number }[] = []
    for (const loteEntry of grid) {
      if (!loteEntry.lote_nombre.trim()) continue
      coloresFiltrados.forEach((color, ci) => {
        const capas = loteEntry.capas_por_color[ci] ?? 0
        if (capas > 0) filas.push({ color, lote_nombre: loteEntry.lote_nombre, capas })
      })
    }
    await batchSaveSlotLotes(ordenId, slot, filas, session.userId)

    // 3. Actualizar lote records: recalcular capas totales de cada lote sumando todos los slots
    const todosLotes = await getOpTelaLotes(ordenId)
    const loteNombres = new Set(grid.map((g) => g.lote_nombre).filter((n) => n.trim()))
    for (const nombre of loteNombres) {
      const totalCapas = todosLotes.filter((r) => r.lote_nombre === nombre).reduce((s, r) => s + r.capas, 0)
      const cantidadProgramada = totalCapas * tallasCount
      await upsertLoteDesdeGrid(ordenId, nombre, cantidadProgramada, session.userId)
    }

    revalidatePath(`/produccion/${ordenId}`)
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error guardando material de tela" }
  }
}

// ── Lotes desde OP ────────────────────────────────────────────────────────────

export async function crearLoteAction(input: {
  orden_id: number
  cantidad_programada: number
  descripcion?: string
}): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  if (!input.cantidad_programada || input.cantidad_programada <= 0)
    return { error: "Cantidad debe ser mayor a 0" }
  try {
    await createLoteDesdeOP({
      orden_id: input.orden_id,
      cantidad_programada: input.cantidad_programada,
      descripcion: input.descripcion,
    }, session.userId)
    revalidatePath(`/produccion/${input.orden_id}`)
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error creando lote" }
  }
}

export async function eliminarLoteAction(
  loteId: number,
  ordenId: number
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }
  try {
    const db = createVanessaClient()
    const { data: lote } = await db.from("lote").select("estado").eq("id", loteId).maybeSingle()
    if (!lote) return { error: "Lote no encontrado" }
    if ((lote as { estado: string }).estado !== "cortado")
      return { error: "Solo se pueden eliminar lotes en estado 'cortado'" }
    const { error } = await db.from("lote").delete().eq("id", loteId)
    if (error) throw new Error(error.message)
    revalidatePath(`/produccion/${ordenId}`)
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error eliminando lote" }
  }
}

// ── Transición de estado ──────────────────────────────────────────────────────

export async function enviarADisenoAction(ordenId: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await cambiarEstado(ordenId, "diseno")
    revalidatePath(`/produccion/${ordenId}`)
    revalidatePath("/produccion")
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error cambiando estado" }
  }
}
