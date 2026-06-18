import { createVanessaClient } from "@/lib/supabase/vanessa"

export interface PersonaRow {
  id: number
  documento: string
  nombre: string
  cargo: string | null
  salario: number
  tipo_pago: "salario" | "turno" | "produccion"
  dias_mes: number
  horas_dia: number
  valor_hora: number | null
  fecha_ingreso: string | null
  estado: "activo" | "inactivo"
  url_cedula: string | null
  url_contrato: string | null
  creado_en: string
}

const SELECT_COLS =
  "id, documento, nombre, cargo, salario, tipo_pago, dias_mes, horas_dia, valor_hora, fecha_ingreso, estado, url_cedula, url_contrato, creado_en"

export async function listPersonas(filtros?: {
  busqueda?: string
  tipo_pago?: string
  estado?: string
}): Promise<PersonaRow[]> {
  const db = createVanessaClient()
  let query = db.from("persona").select(SELECT_COLS).order("nombre")

  if (filtros?.tipo_pago && filtros.tipo_pago !== "todos") {
    query = query.eq("tipo_pago", filtros.tipo_pago)
  }
  if (filtros?.estado && filtros.estado !== "todos") {
    query = query.eq("estado", filtros.estado)
  }
  if (filtros?.busqueda?.trim()) {
    const b = filtros.busqueda.trim()
    query = query.or(`documento.ilike.%${b}%,nombre.ilike.%${b}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as PersonaRow[]
}

export async function getPersonaById(id: number): Promise<PersonaRow | null> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("persona")
    .select(SELECT_COLS)
    .eq("id", id)
    .single()

  if (error || !data) return null
  return data as PersonaRow
}

export async function createPersona(input: {
  documento: string
  nombre: string
  cargo?: string | null
  salario: number
  tipo_pago: "salario" | "turno" | "produccion"
  dias_mes: number
  horas_dia: number
  fecha_ingreso?: string | null
  estado: "activo" | "inactivo"
  url_cedula?: string | null
  url_contrato?: string | null
  creado_por: number
}): Promise<number> {
  const db = createVanessaClient()
  const { data, error } = await db
    .from("persona")
    .insert({
      documento: input.documento.trim(),
      nombre: input.nombre.trim(),
      cargo: input.cargo?.trim() || null,
      salario: input.salario,
      tipo_pago: input.tipo_pago,
      dias_mes: input.dias_mes,
      horas_dia: input.horas_dia,
      fecha_ingreso: input.fecha_ingreso || null,
      estado: input.estado,
      url_cedula: input.url_cedula || null,
      url_contrato: input.url_contrato || null,
      creado_por: input.creado_por,
    })
    .select("id")
    .single()

  if (error || !data) throw new Error(error?.message ?? "Error creando persona")
  return data.id
}

export async function updatePersona(
  id: number,
  input: Partial<{
    documento: string
    nombre: string
    cargo: string | null
    salario: number
    tipo_pago: "salario" | "turno" | "produccion"
    dias_mes: number
    horas_dia: number
    fecha_ingreso: string | null
    estado: "activo" | "inactivo"
    url_cedula: string | null
    url_contrato: string | null
  }>
): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("persona").update(input).eq("id", id)
  if (error) throw new Error(error.message)
}

export async function deletePersona(id: number): Promise<void> {
  const db = createVanessaClient()
  const { error } = await db.from("persona").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

export async function uploadDocumentoPersona(
  file: File,
  tipo: "cedula" | "contrato",
  personaId: number
): Promise<string> {
  const db = createVanessaClient()
  const ext = file.name.split(".").pop() ?? "pdf"
  const path = `${personaId}/${tipo}_${Date.now()}.${ext}`
  const buffer = await file.arrayBuffer()

  const { error } = await db.storage
    .from("documentos-personal")
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (error) throw new Error(error.message)

  const { data } = db.storage.from("documentos-personal").getPublicUrl(path)
  return data.publicUrl
}
