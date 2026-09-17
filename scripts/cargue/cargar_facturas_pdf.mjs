import { readFileSync } from "fs"
import { createClient } from "@supabase/supabase-js"

// Carga las facturas extraidas de los PDF de 2026 que NO existan ya en la
// base. Las del Excel CARTERA se dejan intactas.
//
// Trazabilidad: cada venta cargada aqui lleva observacion "Cargue PDF 2026"
// y el nombre del archivo de origen, para poder revisarlas o borrarlas
// despues sin tocar las del Excel.
//
//   node cargar-pdfs.mjs            -> simula
//   node cargar-pdfs.mjs --aplicar  -> escribe

const APLICAR = process.argv.includes("--aplicar")
const JSON_PATH =
  "C:\\Users\\Personal\\AppData\\Local\\Temp\\claude\\c--Users-Personal-Vanessa\\22ba96f0-7121-4866-8e25-0edd14edd493\\scratchpad\\facturas.json"

const MARCA = "Cargue PDF 2026"

const env = readFileSync(".env.local", "utf8")
const get = (k) => {
  const m = new RegExp(`^${k}=(.*)$`, "m").exec(env)
  return m ? m[1].trim() : null
}
const db = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), {
  db: { schema: "vanessa" },
  auth: { persistSession: false },
})

const todas = JSON.parse(readFileSync(JSON_PATH, "utf8"))

// ── 1) Resolver duplicados: gana la CORREGIDA ──
const esCorregida = (a) => /CORREGID/i.test(a)
// Cuando el numero del contenido no coincide con el del nombre, manda el nombre
const docDelNombre = (archivo) => {
  const m = /^(\d+)/.exec(archivo.trim())
  return m ? String(parseInt(m[1], 10)) : null
}

const utilizables = todas.filter((r) => r.detalle?.length && r.documento)

const porDoc = new Map()
for (const r of utilizables) {
  // El numero del nombre del archivo es mas confiable que el del PDF
  const doc = docDelNombre(r.archivo) ?? r.documento
  const prev = porDoc.get(doc)
  if (!prev) {
    porDoc.set(doc, r)
    continue
  }
  // Entre dos versiones del mismo documento, gana la CORREGIDA
  if (esCorregida(r.archivo) && !esCorregida(prev.archivo)) porDoc.set(doc, r)
}

console.log(`Facturas utilizables:        ${utilizables.length}`)
console.log(`Documentos unicos tras depurar duplicados: ${porDoc.size}`)

// ── 2) Descartar los que ya existen ──
const { data: existentes } = await db.from("venta").select("numero_documento").limit(10000)
const yaHay = new Set((existentes ?? []).map((v) => String(v.numero_documento).trim()))

const aCargar = [...porDoc.entries()].filter(([doc]) => !yaHay.has(doc))
console.log(`Ya existen en la base:       ${porDoc.size - aCargar.length}  (se omiten)`)
console.log(`A cargar:                    ${aCargar.length}\n`)

// ── 3) Fechas: normalizar y corregir las corruptas ──
function fechaISO(f, archivo) {
  if (!f) return null
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(f.trim())
  if (!m) return null
  const [, d, mes, y] = m
  const anio = Number(y)
  // 1900 y 2025 son errores de digitacion en el PDF: el lote es de 2026
  const anioReal = anio < 2026 ? 2026 : anio
  const iso = `${anioReal}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null
}

const sinFecha = aCargar.filter(([, r]) => !fechaISO(r.fecha, r.archivo))
if (sinFecha.length) {
  console.log(`Sin fecha valida (se omiten): ${sinFecha.length}`)
  for (const [doc, r] of sinFecha.slice(0, 5)) console.log(`   doc ${doc}: "${r.fecha}" (${r.archivo})`)
}

const listos = aCargar.filter(([, r]) => fechaISO(r.fecha, r.archivo))

// ── 4) Resumen ──
const totalValor = listos.reduce(
  (s, [, r]) => s + r.detalle.reduce((a, d) => a + (d.total || 0), 0),
  0
)
const totalUds = listos.reduce(
  (s, [, r]) => s + r.detalle.reduce((a, d) => a + d.unidades, 0),
  0
)
const lineas = listos.reduce((s, [, r]) => s + r.detalle.length, 0)

console.log(`\nSe cargaran ${listos.length} facturas, ${lineas} lineas`)
console.log(`   Valor:    $${totalValor.toLocaleString("es-CO")}`)
console.log(`   Unidades: ${totalUds.toLocaleString("es-CO")}`)

// Clientes y referencias nuevos
const clientesPdf = new Map()
for (const [, r] of listos) {
  const nombre = (r.cliente ?? "").trim().toUpperCase()
  if (nombre) clientesPdf.set(`${nombre}|${(r.ciudad ?? "").trim().toUpperCase()}`, {
    nombre,
    ciudad: (r.ciudad ?? "").trim().toUpperCase() || null,
  })
}
const refsPdf = new Map()
for (const [, r] of listos) {
  for (const d of r.detalle) {
    if (!refsPdf.has(d.referencia)) {
      refsPdf.set(d.referencia, { descripcion: d.descripcion, valor: d.valor_unitario })
    }
  }
}
console.log(`   Clientes distintos:    ${clientesPdf.size}`)
console.log(`   Referencias distintas: ${refsPdf.size}`)

if (!APLICAR) {
  console.log(`\nSIMULACION: no se escribio nada.`)
  console.log(`Para aplicar:  node cargar-pdfs.mjs --aplicar`)
  process.exit(0)
}

// ── 5) Usuario al que se atribuye ──
const { data: admins } = await db
  .from("permiso")
  .select("usuario_id")
  .eq("mod_usuarios", true)
  .limit(1)
const creadoPor = admins?.[0]?.usuario_id ?? null

// ── 6) Clientes ──
const { data: clientesBase } = await db.from("cliente").select("id, nombre, ciudad")
const clienteId = new Map()
for (const c of clientesBase ?? []) {
  clienteId.set(
    `${(c.nombre ?? "").trim().toUpperCase()}|${(c.ciudad ?? "").trim().toUpperCase()}`,
    c.id
  )
}
const clientesNuevos = [...clientesPdf.entries()].filter(([k]) => !clienteId.has(k))
for (let i = 0; i < clientesNuevos.length; i += 50) {
  const lote = clientesNuevos.slice(i, i + 50).map(([, v]) => ({
    nombre: v.nombre,
    ciudad: v.ciudad,
    creado_por: creadoPor,
  }))
  const { data, error } = await db.from("cliente").insert(lote).select("id, nombre, ciudad")
  if (error) {
    console.error("Error creando clientes:", error.message)
    process.exit(1)
  }
  for (const c of data ?? []) {
    clienteId.set(
      `${(c.nombre ?? "").trim().toUpperCase()}|${(c.ciudad ?? "").trim().toUpperCase()}`,
      c.id
    )
  }
}
console.log(`\nClientes creados: ${clientesNuevos.length}`)

// ── 7) Referencias de venta que falten ──
const { data: refsBase } = await db.from("referencia_venta").select("referencia")
const refsHay = new Set((refsBase ?? []).map((r) => r.referencia.trim().toUpperCase()))
const refsNuevas = [...refsPdf.entries()].filter(([ref]) => !refsHay.has(ref))
if (refsNuevas.length) {
  const filas = refsNuevas.map(([ref, v]) => ({
    referencia: ref,
    descripcion: v.descripcion ?? null,
    valor_unidad: v.valor ?? 0,
    creado_por: creadoPor,
  }))
  const { error } = await db.from("referencia_venta").insert(filas)
  if (error) console.error("Aviso: no se crearon referencias:", error.message)
  else console.log(`Referencias creadas: ${refsNuevas.length}`)
}

// ── 8) Ventas ──
let creadas = 0
for (const [doc, r] of listos) {
  const fecha = fechaISO(r.fecha, r.archivo)
  const nombre = (r.cliente ?? "").trim().toUpperCase()
  const ciudad = (r.ciudad ?? "").trim().toUpperCase() || null
  const totalUnidades = r.detalle.reduce((s, d) => s + d.unidades, 0)
  const totalValorDoc = r.detalle.reduce((s, d) => s + (d.total || 0), 0)

  // Condicion: "NETO A 30 DIAS" -> credito a 30 dias
  const mc = /^credito:(\d+)$/.exec(r.condicion_pago ?? "")
  const formaPago = mc ? "credito" : "contado"
  const diasCredito = mc ? Number(mc[1]) : 0

  const { data: venta, error } = await db
    .from("venta")
    .insert({
      numero_documento: doc,
      fecha,
      cliente_id: clienteId.get(`${nombre}|${ciudad ?? ""}`) ?? null,
      cliente_nombre: nombre || "(sin cliente)",
      ciudad,
      estado: "confirmada",
      forma_pago: formaPago,
      dias_credito: diasCredito,
      total_unidades: totalUnidades,
      total_valor: totalValorDoc,
      // Trazabilidad del cargue: permite filtrarlas y reversarlas
      observacion: `${MARCA} · ${r.archivo}`,
      confirmada_en: new Date().toISOString(),
      creado_por: creadoPor,
    })
    .select("id")
    .single()

  if (error) {
    console.error(`Error en doc ${doc} (${r.archivo}): ${error.message}`)
    continue
  }

  const detalle = r.detalle.map((d) => ({
    venta_id: venta.id,
    referencia: d.referencia,
    descripcion: d.descripcion ?? null,
    talla: null,
    cantidad: d.unidades,
    valor_unidad: d.valor_unitario ?? 0,
    valor_total: d.total ?? 0,
  }))
  const { error: errDet } = await db.from("venta_detalle").insert(detalle)
  if (errDet) {
    console.error(`Error en detalle de ${doc}: ${errDet.message}`)
    continue
  }

  await db.from("venta_historial").insert({
    venta_id: venta.id,
    nivel: "factura",
    accion: "cargue historico PDF",
    descripcion: `Importada de ${r.archivo}. ${MARCA}. No descuenta inventario.`,
    total_valor: totalValorDoc,
    total_unidades: totalUnidades,
    usuario_id: creadoPor,
  })

  creadas++
  if (creadas % 50 === 0) console.log(`   ...${creadas} facturas`)
}

console.log(`\nFacturas creadas: ${creadas} de ${listos.length}`)
console.log(`\nPara identificarlas despues: observacion empieza con "${MARCA}"`)
