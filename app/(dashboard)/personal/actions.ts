"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getSession } from "@/lib/auth/session"
import {
  createPersona,
  updatePersona,
  deletePersona,
  uploadDocumentoPersona,
} from "@/lib/db/persona"

const personaSchema = z.object({
  documento:     z.string().min(1, "Requerido"),
  nombre:        z.string().min(1, "Requerido"),
  cargo:         z.string().optional(),
  salario:       z.coerce.number().min(0, "Debe ser positivo"),
  tipo_pago:     z.enum(["salario", "turno", "produccion"]),
  dias_mes:      z.coerce.number().int().min(1).max(31),
  horas_dia:     z.coerce.number().min(0.5).max(24),
  fecha_ingreso: z.string().optional(),
  estado:        z.enum(["activo", "inactivo"]),
})

export interface ActionResult {
  error?: string
  success?: boolean
}

async function requireSession() {
  const session = await getSession()
  if (!session) throw new Error("No autorizado")
  return session
}

export async function crearPersonaAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession()

    const raw = {
      documento:     formData.get("documento"),
      nombre:        formData.get("nombre"),
      cargo:         formData.get("cargo") || undefined,
      salario:       formData.get("salario"),
      tipo_pago:     formData.get("tipo_pago"),
      dias_mes:      formData.get("dias_mes"),
      horas_dia:     formData.get("horas_dia"),
      fecha_ingreso: formData.get("fecha_ingreso") || undefined,
      estado:        formData.get("estado"),
    }

    const parsed = personaSchema.safeParse(raw)
    if (!parsed.success) return { error: parsed.error.errors[0].message }

    const personaId = await createPersona({
      ...parsed.data,
      cargo: parsed.data.cargo || null,
      fecha_ingreso: parsed.data.fecha_ingreso || null,
      creado_por: session.userId,
    })

    // Subida de documentos
    const cedulaFile = formData.get("cedula") as File | null
    const contratoFile = formData.get("contrato") as File | null

    const updates: { url_cedula?: string; url_contrato?: string } = {}

    if (cedulaFile && cedulaFile.size > 0) {
      updates.url_cedula = await uploadDocumentoPersona(cedulaFile, "cedula", personaId)
    }
    if (contratoFile && contratoFile.size > 0) {
      updates.url_contrato = await uploadDocumentoPersona(contratoFile, "contrato", personaId)
    }
    if (Object.keys(updates).length > 0) {
      await updatePersona(personaId, updates)
    }

    revalidatePath("/personal")
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error creando persona"
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return { error: "El número de documento ya está registrado" }
    }
    return { error: msg }
  }
}

export async function editarPersonaAction(
  id: number,
  formData: FormData
): Promise<ActionResult> {
  try {
    await requireSession()

    const raw = {
      documento:     formData.get("documento"),
      nombre:        formData.get("nombre"),
      cargo:         formData.get("cargo") || undefined,
      salario:       formData.get("salario"),
      tipo_pago:     formData.get("tipo_pago"),
      dias_mes:      formData.get("dias_mes"),
      horas_dia:     formData.get("horas_dia"),
      fecha_ingreso: formData.get("fecha_ingreso") || undefined,
      estado:        formData.get("estado"),
    }

    const parsed = personaSchema.safeParse(raw)
    if (!parsed.success) return { error: parsed.error.errors[0].message }

    const updates: Parameters<typeof updatePersona>[1] = {
      ...parsed.data,
      cargo: parsed.data.cargo || null,
      fecha_ingreso: parsed.data.fecha_ingreso || null,
    }

    // Subida de documentos
    const cedulaFile = formData.get("cedula") as File | null
    const contratoFile = formData.get("contrato") as File | null

    if (cedulaFile && cedulaFile.size > 0) {
      updates.url_cedula = await uploadDocumentoPersona(cedulaFile, "cedula", id)
    }
    if (contratoFile && contratoFile.size > 0) {
      updates.url_contrato = await uploadDocumentoPersona(contratoFile, "contrato", id)
    }

    await updatePersona(id, updates)
    revalidatePath("/personal")
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error actualizando persona"
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return { error: "El número de documento ya está registrado" }
    }
    return { error: msg }
  }
}

export async function eliminarPersonaAction(id: number): Promise<ActionResult> {
  try {
    await requireSession()
    await deletePersona(id)
    revalidatePath("/personal")
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error eliminando persona" }
  }
}
