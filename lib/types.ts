export type HistorialRow = {
  id: number
  persona_id: number
  fecha: string
  hora_entrada: string | null
  hora_salida: string | null
  umbral_horas_extra: number
  horas_trabajadas: number
  horas_ordinarias: number
  horas_extra: number
  horas_nocturnas: number
  trabajado: boolean
  es_festivo: boolean
  es_domingo: boolean
  observacion: string | null
  creado_en: string
  documento: string
  nombre: string
  tipo_pago: string
  cargo: string | null
  salario: number
  valor_hora: number
}
