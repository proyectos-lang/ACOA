"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getSession } from "@/lib/auth/session"
import { createMaterial, updateMaterial, deleteMaterial } from "@/lib/db/material"

export interface MaterialActionResult {
  error?: string
  success?: boolean
}

const materialSchema = z.object({
  tipo: z.string().min(1, "Tipo requerido"),
  nombre: z.string().min(1, "Nombre requerido"),
  unidad_medida: z.string().min(1, "Unidad requerida"),
  valor_unitario: z.coerce.number().min(0, "Valor debe ser ≥ 0"),
})

export async function crearMaterialAction(
  _prev: MaterialActionResult,
  formData: FormData
): Promise<MaterialActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  const parsed = materialSchema.safeParse({
    tipo: formData.get("tipo"),
    nombre: formData.get("nombre"),
    unidad_medida: formData.get("unidad_medida"),
    valor_unitario: formData.get("valor_unitario"),
  })
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const activo = formData.get("activo") !== "false"

  try {
    await createMaterial({ ...parsed.data, activo, creado_por: session.userId })
    revalidatePath("/materiales")
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error creando material" }
  }
}

export async function editarMaterialAction(
  _prev: MaterialActionResult,
  formData: FormData
): Promise<MaterialActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  const id = Number(formData.get("id"))
  if (!id) return { error: "ID inválido" }

  const parsed = materialSchema.safeParse({
    tipo: formData.get("tipo"),
    nombre: formData.get("nombre"),
    unidad_medida: formData.get("unidad_medida"),
    valor_unitario: formData.get("valor_unitario"),
  })
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const activo = formData.get("activo") !== "false"

  try {
    await updateMaterial(id, { ...parsed.data, activo })
    revalidatePath("/materiales")
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error editando material" }
  }
}

export async function eliminarMaterialAction(id: number): Promise<MaterialActionResult> {
  const session = await getSession()
  if (!session) return { error: "No autorizado" }

  try {
    await deleteMaterial(id)
    revalidatePath("/materiales")
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error eliminando material" }
  }
}
