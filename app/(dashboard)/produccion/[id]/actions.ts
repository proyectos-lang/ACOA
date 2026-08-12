"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getSession } from "@/lib/auth/session"
import { updateOrden, uploadMolde, cambiarEstado } from "@/lib/db/orden-produccion"
import {
  addOpMaterial, updateOpMaterial, deleteOpMaterial,
  batchSaveOpMateriales, sumValorPorPrenda, deleteOpMaterialTelasNoUsadas,
  type OpMaterialBatchFila,
} from "@/lib/db/op-material"
import { batchReplaceCurvaTallas, getCurvaTallas } from "@/lib/db/curva-talla"
import { getHojaCostos, updateHojaCostos, VALORES_FIJOS } from "@/lib/db/hoja-costos"
import { insertOpTelas, deleteOpTela, getOpTelas } from "@/lib/db/op-tela"
import { batchSaveSlotLotes, getOpTelaLotes } from "@/lib/db/op-tela-lote"
import { createLoteDesdeOP, upsertLoteDesdeGrid } from "@/lib/db/lote"
import { createCategoria } from "@/lib/db/categoria"
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
  categoria_id: z.coerce.number().int().positive().optional(),
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
    categoria_id: formData.get("categoria_id") || undefined,
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
      categoria_id: parsed.data.categoria_id ?? null,
      // Checkbox: presente en el form = true, ausente = false
      pasa_estampacion: formData.get("pasa_estampacion") != null,
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

// ── Categorías ────────────────────────────────────────────────────────────────

export async function crearCategoriaAction(
  ordenId: number,
  nombre: string
): Promise<ActionResult & { id?: number }> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  const n = nombre.trim()
  if (!n) return { error: "El nombre de la categoría es requerido" }

  try {
    const id = await createCategoria(n, session.userId)
    revalidatePath(`/produccion/${ordenId}`)
    return { success: true, id }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error creando categoría"
    return { error: msg.includes("duplicate") ? `La categoría "${n}" ya existe` : msg }
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
    // Las cantidades de los lotes dependen del número de tallas: recalcular
    // para que los lotes guardados antes de definir tallas no queden en 0
    await recalcularCantidadesLotes(ordenId, tallas.length, session.userId)
    await recalcularHojaCostos(ordenId)
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

// Recalcula la cantidad programada de TODOS los lotes de la OP a partir de
// las capas guardadas en op_tela_lote (Material 1; fallback al slot más bajo
// disponible) × número de tallas. No exportada (archivo "use server").
async function recalcularCantidadesLotes(
  ordenId: number,
  tallasCount: number,
  userId: number
): Promise<void> {
  const telaLotes = await getOpTelaLotes(ordenId)
  const nombres = [...new Set(telaLotes.map((r) => r.lote_nombre))]
  for (const nombre of nombres) {
    let filas = telaLotes.filter((r) => r.lote_nombre === nombre && r.slot === 1)
    if (filas.length === 0) {
      const filasNombre = telaLotes.filter((r) => r.lote_nombre === nombre)
      const slotMin = Math.min(...filasNombre.map((r) => r.slot))
      filas = filasNombre.filter((r) => r.slot === slotMin)
    }
    const totalCapas = filas.reduce((s, r) => s + r.capas, 0)
    await upsertLoteDesdeGrid(ordenId, nombre, totalCapas * tallasCount, userId)
  }
}

// Recalcula costo_materiales / costo_unitario / total_unidades en hoja_costos.
// No exportada: los archivos "use server" solo pueden exportar actions async.
async function recalcularHojaCostos(ordenId: number): Promise<void> {
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
    await recalcularHojaCostos(ordenId)

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
      // La tela de este slot puede quedar huérfana en el costeo
      const telasRestantes = await getOpTelas(ordenId)
      const nombresRestantes = [
        ...new Set(telasRestantes.map((t) => (t.tipo_tela ?? "").trim()).filter(Boolean)),
      ]
      const eliminadas = await deleteOpMaterialTelasNoUsadas(ordenId, nombresRestantes)
      if (eliminadas > 0) await recalcularHojaCostos(ordenId)
      revalidatePath(`/produccion/${ordenId}`)
      return { success: true }
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : "Error limpiando slot" }
    }
  }

  try {
    // 1. Reemplazar filas de color del slot. Los colores PUEDEN repetirse:
    // la identidad de cada fila es su posición (fila = índice).
    await deleteOpTela(ordenId, slot)
    await insertOpTelas(ordenId, slot, tipoTela || null, coloresFiltrados, session.userId)

    // 2. Construir y guardar filas op_tela_lote (identidad = fila + lote)
    const filas: { fila: number; color: string; lote_nombre: string; capas: number }[] = []
    for (const loteEntry of grid) {
      const loteNombre = loteEntry.lote_nombre.trim()
      if (!loteNombre) continue
      coloresFiltrados.forEach((color, ci) => {
        const capas = loteEntry.capas_por_color[ci] ?? 0
        if (capas > 0) filas.push({ fila: ci, color: color.trim(), lote_nombre: loteNombre, capas })
      })
    }
    await batchSaveSlotLotes(ordenId, slot, filas, session.userId)

    // 3. Actualizar lote records. Las cantidades se basan SOLO en Material 1
    // (fallback al slot más bajo si el lote no existe en M1): M2/M3 son telas
    // adicionales de las mismas prendas, no prendas extra.
    await recalcularCantidadesLotes(ordenId, tallasCount, session.userId)

    // 4. Limpiar telas huérfanas del costeo: filas de op_material tipo Tela
    // cuya tela ya no se usa en ningún material de la curva, y recalcular
    // la hoja de costos para que Costos no sume telas fantasma
    const telasActuales = await getOpTelas(ordenId)
    const nombresUsados = [
      ...new Set(
        telasActuales.map((t) => (t.tipo_tela ?? "").trim()).filter(Boolean)
      ),
    ]
    const eliminadas = await deleteOpMaterialTelasNoUsadas(ordenId, nombresUsados)
    if (eliminadas > 0) await recalcularHojaCostos(ordenId)

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
