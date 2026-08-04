"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getSession } from "@/lib/auth/session"
import { updateOrden, uploadMolde, cambiarEstado } from "@/lib/db/orden-produccion"
import {
  addOpMaterial, updateOpMaterial, deleteOpMaterial,
  batchSaveOpMateriales, sumValorPorPrenda,
  type OpMaterialBatchFila,
} from "@/lib/db/op-material"
import { batchReplaceCurvaTallas, getCurvaTallas } from "@/lib/db/curva-talla"
import { getHojaCostos, updateHojaCostos, VALORES_FIJOS } from "@/lib/db/hoja-costos"
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
  numero_op: z.coerce.number().int("Número OP debe ser entero").positive("Número OP debe ser mayor a 0").optional(),
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
    numero_op: formData.get("numero_op") || undefined,
    referencia: formData.get("referencia"),
    descripcion: formData.get("descripcion") || undefined,
    fecha_programacion: formData.get("fecha_programacion") || undefined,
    gama_color: formData.get("gama_color") || undefined,
  })
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  try {
    // Validar que el número OP no esté en uso por otra orden
    if (parsed.data.numero_op != null) {
      const db = createVanessaClient()
      const { data: existente } = await db
        .from("orden_produccion")
        .select("id")
        .eq("numero_op", parsed.data.numero_op)
        .neq("id", ordenId)
        .maybeSingle()
      if (existente) {
        return { error: `El número OP ${parsed.data.numero_op} ya está en uso por otra orden` }
      }
    }

    await updateOrden(ordenId, {
      ...(parsed.data.numero_op != null ? { numero_op: parsed.data.numero_op } : {}),
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

// Guarda el listado completo de materiales de la OP y recalcula la hoja de costos
export async function guardarMaterialesOPAction(
  ordenId: number,
  filas: OpMaterialBatchFila[]
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await batchSaveOpMateriales(ordenId, filas, session.userId)

    // Recalcular costo de materiales en hoja_costos para la pestaña Costos
    const [costo_m_raw, curva, telaLotes, hoja] = await Promise.all([
      sumValorPorPrenda(ordenId),
      getCurvaTallas(ordenId),
      getOpTelaLotes(ordenId),
      getHojaCostos(ordenId),
    ])
    const costo_materiales = Math.round(costo_m_raw * 10000) / 10000
    const sumaFijos = hoja
      ? VALORES_FIJOS.reduce((s, f) => s + (Number(hoja[f.key]) || 0), 0)
      : 0
    const costo_unitario = Math.round((costo_materiales + sumaFijos) * 10000) / 10000
    // Total de prendas basado solo en Material 1 (slot 1)
    const totalCapas = telaLotes.filter((r) => r.slot === 1).reduce((s, r) => s + r.capas, 0)
    const total_unidades = totalCapas * curva.length

    await updateHojaCostos(ordenId, { costo_materiales, costo_unitario, total_unidades })

    revalidatePath(`/produccion/${ordenId}`)
    revalidatePath(`/produccion/${ordenId}/costos`)
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error guardando materiales" }
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
    // 1. Reemplazar colores del slot (sin repetidos: la clave es orden+slot+color)
    const coloresUnicos = [...new Set(coloresFiltrados.map((c) => c.trim()))]
    await deleteOpTela(ordenId, slot)
    for (const color of coloresUnicos) {
      await upsertOpTela({ orden_id: ordenId, slot, tipo_tela: tipoTela || null, color, creado_por: session.userId })
    }

    // 2. Construir y guardar filas op_tela_lote. Si un (color, lote) viene
    // repetido, se agregan las capas sumándolas — un upsert con claves
    // duplicadas falla con "ON CONFLICT DO UPDATE cannot affect row a second time"
    // y dejaría el slot vacío (el delete ya habría corrido).
    const filasMap = new Map<string, { color: string; lote_nombre: string; capas: number }>()
    for (const loteEntry of grid) {
      const loteNombre = loteEntry.lote_nombre.trim()
      if (!loteNombre) continue
      coloresFiltrados.forEach((color, ci) => {
        const capas = loteEntry.capas_por_color[ci] ?? 0
        if (capas <= 0) return
        const key = `${color.trim()}||${loteNombre}`
        const prev = filasMap.get(key)
        if (prev) prev.capas += capas
        else filasMap.set(key, { color: color.trim(), lote_nombre: loteNombre, capas })
      })
    }
    await batchSaveSlotLotes(ordenId, slot, [...filasMap.values()], session.userId)

    // 3. Actualizar lote records. Las cantidades se basan SOLO en Material 1:
    // M2/M3 son telas adicionales de las mismas prendas, no prendas extra.
    const todosLotes = await getOpTelaLotes(ordenId)
    const loteNombres = new Set(grid.map((g) => g.lote_nombre).filter((n) => n.trim()))
    for (const nombre of loteNombres) {
      let filasLote = todosLotes.filter((r) => r.lote_nombre === nombre && r.slot === 1)
      // Fallback: si el lote no existe en Material 1, usar las filas del slot guardado
      if (filasLote.length === 0) {
        filasLote = todosLotes.filter((r) => r.lote_nombre === nombre && r.slot === slot)
      }
      const totalCapas = filasLote.reduce((s, r) => s + r.capas, 0)
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
