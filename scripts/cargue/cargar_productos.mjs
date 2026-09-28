import { readFileSync } from "fs"
import { createClient } from "@supabase/supabase-js"

// Carga el maestro de productos (referencia, descripcion, precio,
// empresa) desde el JSON que deja leer_libro2.py.
//
//   node scripts/cargue/cargar_productos.mjs            -> simula
//   node scripts/cargue/cargar_productos.mjs --aplicar  -> escribe

const APLICAR = process.argv.includes("--aplicar")
const JSON_PATH =
  process.argv.find((a) => a.endsWith(".json")) ??
  "C:\\Users\\Personal\\AppData\\Local\\Temp\\claude\\c--Users-Personal-Vanessa\\22ba96f0-7121-4866-8e25-0edd14edd493\\scratchpad\\productos.json"

const env = readFileSync(".env.local", "utf8")
const get = (k) => {
  const m = new RegExp(`^${k}=(.*)$`, "m").exec(env)
  return m ? m[1].trim() : null
}
const db = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), {
  db: { schema: "vanessa" },
  auth: { persistSession: false },
})

const productos = JSON.parse(readFileSync(JSON_PATH, "utf8")).filter((p) => p.empresa)
console.log(`Productos en el archivo: ${productos.length}`)

const porEmpresa = {}
for (const p of productos) porEmpresa[p.empresa] = (porEmpresa[p.empresa] ?? 0) + 1
console.log(`   ${JSON.stringify(porEmpresa)}`)

const { data: existentes } = await db
  .from("referencia_venta")
  .select("id, referencia, valor_unidad, empresa")
  .limit(5000)
const porRef = new Map(
  (existentes ?? []).map((r) => [r.referencia.trim().toUpperCase(), r])
)
console.log(`Referencias ya en la base: ${porRef.size}`)

const nuevos = []
const cambios = []
for (const p of productos) {
  const ref = p.referencia.trim().toUpperCase()
  const actual = porRef.get(ref)
  if (!actual) {
    nuevos.push(p)
  } else {
    const difPrecio = Number(actual.valor_unidad) !== p.precio
    const difEmpresa = (actual.empresa ?? "ACOA") !== p.empresa
    if (difPrecio || difEmpresa) {
      cambios.push({
        ...p,
        id: actual.id,
        antes_precio: Number(actual.valor_unidad),
        antes_empresa: actual.empresa ?? "ACOA",
      })
    }
  }
}

console.log(`\nA crear:     ${nuevos.length}`)
console.log(`A actualizar: ${cambios.length}`)
for (const c of cambios.slice(0, 12)) {
  const partes = []
  if (c.antes_precio !== c.precio)
    partes.push(`precio $${c.antes_precio.toLocaleString("es-CO")} → $${c.precio.toLocaleString("es-CO")}`)
  if (c.antes_empresa !== c.empresa) partes.push(`empresa ${c.antes_empresa} → ${c.empresa}`)
  console.log(`   ${c.referencia}: ${partes.join(", ")}`)
}
if (cambios.length > 12) console.log(`   ...y ${cambios.length - 12} mas`)

// Referencias que hay en la base y no en el archivo
const enArchivo = new Set(productos.map((p) => p.referencia.trim().toUpperCase()))
const sobrantes = [...porRef.keys()].filter((r) => !enArchivo.has(r))
if (sobrantes.length > 0) {
  console.log(`\nEn la base pero no en el archivo: ${sobrantes.length}`)
  console.log(`   ${sobrantes.slice(0, 20).join(", ")}`)
  console.log(`   (se dejan como estan: pueden tener ventas registradas)`)
}

if (!APLICAR) {
  console.log(`\nSIMULACION: no se escribio nada.`)
  console.log(`Para aplicar:  node scripts/cargue/cargar_productos.mjs --aplicar`)
  process.exit(0)
}

// Referencias que en la base quedaron con ceros a la izquierda y en el
// maestro van sin ellos: son la misma prenda. Se unifican antes de
// cargar, para no dejar dos productos para lo mismo.
const EQUIVALENTES = [
  ["022", "22"],
  ["001", "1"],
]

for (const [viejo, nuevo] of EQUIVALENTES) {
  const enMaestro = productos.some((p) => p.referencia.trim().toUpperCase() === nuevo)
  if (!enMaestro) continue

  const { count } = await db
    .from("venta_detalle")
    .update({ referencia: nuevo }, { count: "exact" })
    .eq("referencia", viejo)
  if ((count ?? 0) > 0) {
    console.log(`Unificado: ${count} linea(s) de venta pasaron de ${viejo} a ${nuevo}`)
  }
  // El producto viejo se retira del maestro
  const { error } = await db.from("referencia_venta").delete().eq("referencia", viejo)
  if (!error) console.log(`   se retiro la referencia ${viejo} del maestro`)
}

const { data: admins } = await db
  .from("permiso")
  .select("usuario_id")
  .eq("mod_usuarios", true)
  .limit(1)
const creadoPor = admins?.[0]?.usuario_id ?? null

let creados = 0
for (let i = 0; i < nuevos.length; i += 50) {
  const lote = nuevos.slice(i, i + 50).map((p) => ({
    referencia: p.referencia.trim().toUpperCase(),
    descripcion: p.descripcion || null,
    valor_unidad: p.precio,
    empresa: p.empresa,
    creado_por: creadoPor,
  }))
  const { error } = await db.from("referencia_venta").insert(lote)
  if (error) {
    console.error("Error creando:", error.message)
    process.exit(1)
  }
  creados += lote.length
}

let actualizados = 0
for (const c of cambios) {
  const { error } = await db
    .from("referencia_venta")
    .update({
      descripcion: c.descripcion || null,
      valor_unidad: c.precio,
      empresa: c.empresa,
    })
    .eq("id", c.id)
  if (error) {
    console.error(`Error en ${c.referencia}:`, error.message)
    continue
  }
  actualizados++
}

console.log(`\nCreados: ${creados}   Actualizados: ${actualizados}`)

// El detalle ya registrado toma la empresa de su referencia
const { data: refs } = await db.from("referencia_venta").select("referencia, empresa").limit(5000)
let lineas = 0
for (const r of refs ?? []) {
  const { count } = await db
    .from("venta_detalle")
    .update({ empresa: r.empresa }, { count: "exact" })
    .ilike("referencia", r.referencia.trim())
  lineas += count ?? 0
}
console.log(`Lineas de venta actualizadas con su empresa: ${lineas}`)
