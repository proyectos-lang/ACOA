"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getSession } from "@/lib/auth/session"
import { createNovedad, updateNovedad, deleteNovedad } from "@/lib/db/novedad"

export interface NovedadActionResult {
  error?: string
  success?: boolean
}

const novedadSchema = z.object({
  persona_id: z.coerce.number().int().positive(),
  tipo: z.enum([
    "falta_justificada",
    "falta_injustificada",
    "incapacidad",
    "licencia",
    "permiso",
    "vacaciones",
  ]),
  fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fecha_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  observacion: z.string().optional(),
})

export async function crearNovedadAction(
  _prev: NovedadActionResult,
  formData: FormData
): Promise<NovedadActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  const parsed = novedadSchema.safeParse({
    persona_id: formData.get("persona_id"),
    tipo: formData.get("tipo"),
    fecha_inicio: formData.get("fecha_inicio"),
    fecha_fin: formData.get("fecha_fin"),
    observacion: formData.get("observacion") || undefined,
  })

  if (!parsed.success) return { error: parsed.error.errors[0].message }
  const { persona_id, tipo, fecha_inicio, fecha_fin, observacion } = parsed.data

  if (fecha_fin < fecha_inicio) return { error: "Fecha fin debe ser ≥ fecha inicio" }

  try {
    await createNovedad({ persona_id, tipo, fecha_inicio, fecha_fin, observacion, creado_por: session.userId })
    revalidatePath("/asistencia/novedades")
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error creando novedad" }
  }
}

export async function editarNovedadAction(
  _prev: NovedadActionResult,
  formData: FormData
): Promise<NovedadActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  const id = Number(formData.get("id"))
  if (!id) return { error: "ID inválido" }

  const parsed = novedadSchema.safeParse({
    persona_id: formData.get("persona_id"),
    tipo: formData.get("tipo"),
    fecha_inicio: formData.get("fecha_inicio"),
    fecha_fin: formData.get("fecha_fin"),
    observacion: formData.get("observacion") || undefined,
  })

  if (!parsed.success) return { error: parsed.error.errors[0].message }
  const { tipo, fecha_inicio, fecha_fin, observacion } = parsed.data

  if (fecha_fin < fecha_inicio) return { error: "Fecha fin debe ser ≥ fecha inicio" }

  try {
    await updateNovedad(id, { tipo, fecha_inicio, fecha_fin, observacion: observacion ?? null })
    revalidatePath("/asistencia/novedades")
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error editando novedad" }
  }
}

export async function eliminarNovedadAction(id: number): Promise<NovedadActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await deleteNovedad(id)
    revalidatePath("/asistencia/novedades")
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error eliminando novedad" }
  }
}
