// Cálculo de fechas de entrega por número de días, sin contar domingos.
// Se usa en estampación y confección: se registra un número de días y la
// fecha estimada de entrega se calcula automáticamente a partir de la
// fecha de entrega del lote (o de hoy si aún no hay).

export function hoyBogota(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
}

// Suma días saltando los domingos. La fecha base no cuenta como día 1:
// con 1 día, el resultado es el siguiente día que no sea domingo.
export function sumarDiasSinDomingo(fechaBase: string, dias: number): string {
  if (!fechaBase || !(dias > 0)) return ""

  // Se construye en UTC para evitar corrimientos por zona horaria
  const [y, m, d] = fechaBase.split("-").map(Number)
  if (!y || !m || !d) return ""
  const fecha = new Date(Date.UTC(y, m - 1, d))

  let restantes = Math.floor(dias)
  while (restantes > 0) {
    fecha.setUTCDate(fecha.getUTCDate() + 1)
    // 0 = domingo: no cuenta como día de trabajo
    if (fecha.getUTCDay() !== 0) restantes--
  }

  // Si el resultado cae en domingo, se corre al lunes
  if (fecha.getUTCDay() === 0) fecha.setUTCDate(fecha.getUTCDate() + 1)

  return fecha.toISOString().slice(0, 10)
}

// Días (sin domingos) entre dos fechas; útil para mostrar el plazo cuando
// ya existe una fecha estimada registrada sin días capturados
export function diasSinDomingoEntre(desde: string, hasta: string): number | null {
  if (!desde || !hasta) return null
  const [y1, m1, d1] = desde.split("-").map(Number)
  const [y2, m2, d2] = hasta.split("-").map(Number)
  if (!y1 || !y2) return null

  const ini = new Date(Date.UTC(y1, m1 - 1, d1))
  const fin = new Date(Date.UTC(y2, m2 - 1, d2))
  if (fin <= ini) return 0

  let dias = 0
  const cursor = new Date(ini)
  while (cursor < fin) {
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    if (cursor.getUTCDay() !== 0) dias++
  }
  return dias
}
