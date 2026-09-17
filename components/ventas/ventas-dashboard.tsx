"use client"

import * as React from "react"
import { TrendingUp, Package, FileText, Users, Wallet, AlertTriangle } from "lucide-react"
import type { DashboardVentas, PuntoMes, FilaCliente, FilaReferencia } from "@/lib/db/ventas-dashboard"
import { Card } from "@/components/ui/card"

// Paleta validada con el script de dataviz (light y dark):
//   categorica  #2a78d6,#eb6834,#1baf7a,#eda100  -> ALL CHECKS PASS
//   rampa azul  #86b6ef..#0d366b (ordinal)       -> ALL CHECKS PASS
const RAMPA = ["#0d366b", "#184f95", "#2a78d6", "#5598e7", "#86b6ef"]

function pesos(n: number) {
  return "$" + Math.round(n).toLocaleString("es-CO")
}

// Cifras grandes legibles en el eje: 1.2 M, 850 k
function corto(n: number) {
  if (n === 0) return "0"
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)} M`
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)} k`
  return String(Math.round(n))
}

// Techo del eje en una cifra redonda por encima del pico, para que las
// marcas queden equiespaciadas y legibles
function techoEje(pico: number): number {
  if (!(pico > 0)) return 1
  const mag = Math.pow(10, Math.floor(Math.log10(pico)))
  for (const p of [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (p * mag >= pico) return p * mag
  }
  return 10 * mag
}

function miles(n: number) {
  return n.toLocaleString("es-CO")
}

// ── Tarjeta de indicador ──
function Tarjeta({
  icono: Icono,
  etiqueta,
  valor,
  detalle,
  acento,
}: {
  icono: React.ElementType
  etiqueta: string
  valor: string
  detalle?: string
  acento?: string
}) {
  return (
    <div className="flex-1 min-w-[170px] px-4 py-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-stone-400">
        <Icono className="h-3.5 w-3.5" />
        {etiqueta}
      </div>
      <p
        className="mt-1 text-2xl font-bold tabular-nums"
        style={{ color: acento ?? "#0D1821" }}
      >
        {valor}
      </p>
      {detalle && <p className="mt-0.5 text-xs text-stone-400">{detalle}</p>}
    </div>
  )
}

// ── Ventas por mes: linea + area, con crosshair ──
function GraficoMeses({ meses }: { meses: PuntoMes[] }) {
  const [activo, setActivo] = React.useState<number | null>(null)

  if (meses.length === 0) {
    return <p className="py-10 text-center text-sm text-stone-400">Sin datos en el periodo</p>
  }

  const W = 760
  const H = 240
  const M = { top: 14, right: 12, bottom: 28, left: 46 }
  const ancho = W - M.left - M.right
  const alto = H - M.top - M.bottom

  const pico = Math.max(...meses.map((m) => m.valor)) || 1
  const maximo = techoEje(pico)
  // El eje arranca en cero: truncarlo exagera las diferencias
  const x = (i: number) =>
    M.left + (meses.length === 1 ? ancho / 2 : (i * ancho) / (meses.length - 1))
  const y = (v: number) => M.top + alto - (v / maximo) * alto

  const linea = meses.map((m, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(m.valor)}`).join(" ")
  const area = `${linea} L ${x(meses.length - 1)} ${M.top + alto} L ${x(0)} ${M.top + alto} Z`

  // Cuatro marcas de referencia, suficientes para leer sin saturar
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maximo)

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ maxHeight: 260 }}
        role="img"
        aria-label="Ventas por mes"
        onMouseLeave={() => setActivo(null)}
      >
        <defs>
          <linearGradient id="areaVentas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a78d6" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#2a78d6" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Rejilla recesiva */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={M.left}
              x2={W - M.right}
              y1={y(t)}
              y2={y(t)}
              stroke="#e7e5e4"
              strokeWidth="1"
            />
            <text
              x={M.left - 8}
              y={y(t) + 4}
              textAnchor="end"
              className="fill-stone-400"
              style={{ fontSize: 10 }}
            >
              {corto(t)}
            </text>
          </g>
        ))}

        <path d={area} fill="url(#areaVentas)" />
        <path
          d={linea}
          fill="none"
          stroke="#2a78d6"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {meses.map((m, i) => (
          <g key={m.mes}>
            {activo === i && (
              <line
                x1={x(i)}
                x2={x(i)}
                y1={M.top}
                y2={M.top + alto}
                stroke="#a8a29e"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            )}
            {/* Anillo en el color de la superficie, no un borde */}
            <circle
              cx={x(i)}
              cy={y(m.valor)}
              r={activo === i ? 5.5 : 4}
              fill="#2a78d6"
              stroke="#ffffff"
              strokeWidth="2"
            />
            <text
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              className="fill-stone-500"
              style={{ fontSize: 10 }}
            >
              {m.etiqueta}
            </text>
            {/* Area de contacto mas grande que la marca */}
            <rect
              x={x(i) - ancho / (meses.length * 2 || 1) / 1}
              y={M.top}
              width={Math.max(24, ancho / meses.length)}
              height={alto}
              fill="transparent"
              onMouseEnter={() => setActivo(i)}
            />
          </g>
        ))}
      </svg>

      {activo !== null && meses[activo] && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs shadow-lg">
          <p className="font-semibold text-stone-800">{meses[activo].etiqueta}</p>
          <p className="text-stone-600">{pesos(meses[activo].valor)}</p>
          <p className="text-stone-400">
            {miles(meses[activo].unidades)} und · {meses[activo].facturas} facturas
          </p>
        </div>
      )}
    </div>
  )
}

// ── Barras horizontales: sirven para clientes y para referencias ──
function BarrasHorizontales({
  filas,
  onHover,
}: {
  filas: Array<{ clave: string; nombre: string; sub?: string | null; valor: number; detalle: string }>
  onHover?: (i: number | null) => void
}) {
  const [activo, setActivo] = React.useState<number | null>(null)
  if (filas.length === 0) {
    return <p className="py-8 text-center text-sm text-stone-400">Sin datos</p>
  }
  const maximo = Math.max(...filas.map((f) => f.valor)) || 1

  return (
    <div className="space-y-2.5">
      {filas.map((f, i) => {
        const pct = (f.valor / maximo) * 100
        // El color refuerza el orden; el valor ya esta etiquetado al lado
        const color = RAMPA[Math.min(i, RAMPA.length - 1)]
        return (
          <div
            key={f.clave}
            className="group"
            onMouseEnter={() => {
              setActivo(i)
              onHover?.(i)
            }}
            onMouseLeave={() => {
              setActivo(null)
              onHover?.(null)
            }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-xs font-medium text-stone-700" title={f.nombre}>
                {f.nombre}
                {f.sub && (
                  <span className="ml-1.5 text-[10px] font-normal text-stone-400">
                    &middot; {f.sub}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-stone-800">
                {pesos(f.valor)}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-2.5 flex-1 overflow-hidden rounded-sm bg-stone-100">
                <div
                  className="h-full rounded-r-[4px] transition-all"
                  style={{
                    width: `${Math.max(pct, 1)}%`,
                    backgroundColor: color,
                    opacity: activo === null || activo === i ? 1 : 0.55,
                  }}
                />
              </div>
              <span className="w-28 shrink-0 text-right text-[10px] text-stone-400">
                {f.detalle}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function VentasDashboard({ datos }: { datos: DashboardVentas }) {
  const { resumen, meses, clientes, referencias } = datos
  const [verTabla, setVerTabla] = React.useState(false)
  const [topClientes, setTopClientes] = React.useState(8)
  const [topRefs, setTopRefs] = React.useState(8)

  const mejorMes = meses.length
    ? meses.reduce((a, b) => (b.valor > a.valor ? b : a))
    : null

  const filasClientes = clientes.slice(0, topClientes).map((c: FilaCliente) => ({
    clave: c.cliente,
    nombre: c.cliente,
    sub: c.ciudad,
    valor: c.valor,
    detalle: `${miles(c.unidades)} und · ${c.facturas} fact.`,
  }))

  const filasRefs = referencias.slice(0, topRefs).map((r: FilaReferencia) => ({
    clave: r.referencia,
    nombre: r.referencia,
    sub: r.descripcion,
    valor: r.valor,
    detalle: `${miles(r.unidades)} und · ${r.facturas} fact.`,
  }))

  return (
    <div className="space-y-4">
      {/* ── Indicadores: un solo contenedor ── */}
      <Card className="p-0">
        <div className="flex flex-wrap divide-x divide-stone-100">
          <Tarjeta
            icono={TrendingUp}
            etiqueta="Total ventas"
            valor={pesos(resumen.total_valor)}
            detalle={
              datos.desde && datos.hasta ? `${datos.desde} a ${datos.hasta}` : undefined
            }
            acento="#2a78d6"
          />
          <Tarjeta
            icono={Package}
            etiqueta="Unidades"
            valor={miles(resumen.total_unidades)}
            detalle={`${miles(Math.round(resumen.total_unidades / (meses.length || 1)))} por mes`}
          />
          <Tarjeta
            icono={FileText}
            etiqueta="Facturas"
            valor={miles(resumen.total_facturas)}
            detalle={`Ticket ${pesos(resumen.ticket_promedio)}`}
          />
          <Tarjeta
            icono={Users}
            etiqueta="Clientes"
            valor={miles(resumen.clientes_activos)}
            detalle={mejorMes ? `Mejor mes: ${mejorMes.etiqueta}` : undefined}
          />
          <Tarjeta
            icono={Wallet}
            etiqueta="Por cobrar"
            valor={pesos(resumen.por_cobrar)}
            detalle={
              resumen.facturas_vencidas > 0
                ? `${resumen.facturas_vencidas} factura(s) vencidas`
                : "Sin vencidos"
            }
            acento={resumen.por_cobrar > 0 ? "#eb6834" : undefined}
          />
        </div>
      </Card>

      {/* ── Ventas por mes ── */}
      <Card className="p-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-stone-700">Ventas por mes</h2>
            <p className="text-xs text-stone-400">
              Valor facturado; pasa el cursor para ver unidades y facturas
            </p>
          </div>
          {resumen.facturas_vencidas > 0 && (
            <span className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5" />
              {resumen.facturas_vencidas} vencidas
            </span>
          )}
        </div>
        <GraficoMeses meses={meses} />
      </Card>

      {/* ── Clientes y referencias ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-stone-700">Ventas por cliente</h2>
              <p className="text-xs text-stone-400">
                {clientes.length} clientes · mayor a menor
              </p>
            </div>
            <select
              value={topClientes}
              onChange={(e) => setTopClientes(Number(e.target.value))}
              className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-[#344966]"
            >
              {[5, 8, 15, 30].map((n) => (
                <option key={n} value={n}>
                  Top {n}
                </option>
              ))}
            </select>
          </div>
          <BarrasHorizontales filas={filasClientes} />
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-stone-700">Ventas por referencia</h2>
              <p className="text-xs text-stone-400">
                {referencias.length} referencias · mayor a menor
              </p>
            </div>
            <select
              value={topRefs}
              onChange={(e) => setTopRefs(Number(e.target.value))}
              className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-[#344966]"
            >
              {[5, 8, 15, 30].map((n) => (
                <option key={n} value={n}>
                  Top {n}
                </option>
              ))}
            </select>
          </div>
          <BarrasHorizontales filas={filasRefs} />
        </Card>
      </div>

      {/* ── Vista de tabla: los mismos datos, legibles sin color ── */}
      <Card className="p-4">
        <button
          type="button"
          onClick={() => setVerTabla((v) => !v)}
          className="text-xs font-medium text-stone-500 hover:text-stone-700"
        >
          {verTabla ? "Ocultar" : "Ver"} los datos en tabla
        </button>

        {verTabla && (
          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {[
              {
                titulo: "Por mes",
                filas: meses.map((m) => [m.etiqueta, m.valor, m.unidades]),
              },
              {
                titulo: "Por cliente",
                filas: clientes.map((c) => [c.cliente, c.valor, c.unidades]),
              },
              {
                titulo: "Por referencia",
                filas: referencias.map((r) => [r.referencia, r.valor, r.unidades]),
              },
            ].map((t) => (
              <div key={t.titulo}>
                <p className="mb-1 text-xs font-semibold text-stone-600">{t.titulo}</p>
                <div className="max-h-64 overflow-auto rounded-lg border border-stone-100">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-stone-50">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium text-stone-500"></th>
                        <th className="px-2 py-1.5 text-right font-medium text-stone-500">
                          Valor
                        </th>
                        <th className="px-2 py-1.5 text-right font-medium text-stone-500">
                          Und
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.filas.map((f, i) => (
                        <tr key={i} className="border-t border-stone-100">
                          <td className="px-2 py-1 text-stone-700">{String(f[0])}</td>
                          <td className="px-2 py-1 text-right tabular-nums text-stone-800">
                            {pesos(Number(f[1]))}
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums text-stone-500">
                            {miles(Number(f[2]))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
