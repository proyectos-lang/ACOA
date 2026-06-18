"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getSession } from "@/lib/auth/session"
import { createOrden, updateOrden, uploadMolde } from "@/lib/db/orden-produccion"

export interface OrdenActionResult {
  error?: string
  success?: boolean
  id?: number
}

const ordenSchema = z.object({
  referencia: z.string().min(1, "Referencia requerida"),
  descripcion: z.string().optional(),
  fecha_programacion: z.string().optional(),
  gama_color: z.string().optional(),
  observaciones: z.string().optional(),
})

export async function crearOrdenAction(formData: FormData): Promise<OrdenActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  const parsed = ordenSchema.safeParse({
    referencia: formData.get("referencia"),
    descripcion: formData.get("descripcion") || undefined,
    fecha_programacion: formData.get("fecha_programacion") || undefined,
    gama_color: formData.get("gama_color") || undefined,
    observaciones: formData.get("observaciones") || undefined,
  })
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  try {
    const id = await createOrden({ ...parsed.data, creado_por: session.userId })

    const moldeFile = formData.get("url_molde") as File | null
    if (moldeFile && moldeFile.size > 0) {
      const url = await uploadMolde(moldeFile, id)
      await updateOrden(id, { url_molde: url })
    }

    revalidatePath("/produccion")
    return { success: true, id }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error creando orden" }
  }
}

export async function editarOrdenAction(formData: FormData): Promise<OrdenActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  const id = Number(formData.get("id"))
  if (!id) return { error: "ID inválido" }

  const parsed = ordenSchema.safeParse({
    referencia: formData.get("referencia"),
    descripcion: formData.get("descripcion") || undefined,
    fecha_programacion: formData.get("fecha_programacion") || undefined,
    gama_color: formData.get("gama_color") || undefined,
    observaciones: formData.get("observaciones") || undefined,
  })
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  try {
    await updateOrden(id, {
      referencia: parsed.data.referencia,
      descripcion: parsed.data.descripcion || null,
      fecha_programacion: parsed.data.fecha_programacion || null,
      gama_color: parsed.data.gama_color || null,
      observaciones: parsed.data.observaciones || null,
    })

    const moldeFile = formData.get("url_molde") as File | null
    if (moldeFile && moldeFile.size > 0) {
      const url = await uploadMolde(moldeFile, id)
      await updateOrden(id, { url_molde: url })
    }

    revalidatePath("/produccion")
    revalidatePath(`/produccion/${id}`)
    return { success: true, id }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error editando orden" }
  }
}
