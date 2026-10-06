"use client"

import * as React from "react"
import { Filter, X } from "lucide-react"

// Envoltura que le da filtros por columna a cualquier tabla del ERP sin
// tocar su codigo: lee las cabeceras y las celdas del DOM, arma un filtro
// por columna (lista desplegable cuando la columna tiene pocos valores
// distintos, texto libre en el resto) y oculta las filas que no coinciden.
//
// Las tablas de este sistema las dibuja React con sus propios datos; esta
// envoltura solo observa el DOM resultante y le aplica display:none a las
// filas, asi que sobrevive a cualquier re-render (se vuelve a aplicar cada
// vez que cambian las filas).

interface Columna {
  indice: number
  label: string
  // Valores distintos que trae la columna; si son pocos, el filtro es una lista
  opciones: string[] | null
}

const MAX_OPCIONES = 12

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
}

// Filas que no son datos: totales, vacios y filas de detalle (menos celdas
// que la cabecera, se anclan a la fila anterior)
function esFilaTotal(tr: HTMLTableRowElement): boolean {
  const primera = tr.cells[0]?.textContent ?? ""
  return /^\s*(total|totales|subtotal)\b/i.test(primera)
}

export function TablaInteractiva({
  children,
  className,
  // Con menos filas que esto los filtros no aportan y no se muestran
  minFilas = 8,
}: {
  children: React.ReactNode
  className?: string
  minFilas?: number
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [columnas, setColumnas] = React.useState<Columna[]>([])
  const [totalFilas, setTotalFilas] = React.useState(0)
  const [visibles, setVisibles] = React.useState(0)
  const [filtros, setFiltros] = React.useState<Record<number, string>>({})
  const filtrosRef = React.useRef(filtros)
  filtrosRef.current = filtros

  // Lee la estructura de la tabla y aplica los filtros vigentes
  const aplicar = React.useCallback(() => {
    const tabla = ref.current?.querySelector("table")
    if (!tabla) return
    const ths = [...(tabla.tHead?.rows[0]?.cells ?? [])]
    const filas = [...tabla.tBodies].flatMap((tb) => [...tb.rows])
    const filasDatos = filas.filter((tr) => tr.cells.length >= ths.length && !esFilaTotal(tr))

    // Valores distintos por columna, para decidir lista o texto
    const cols: Columna[] = ths.map((th, i) => {
      const label = (th.textContent ?? "").trim()
      const distintos = new Set<string>()
      let demasiados = false
      for (const tr of filasDatos) {
        const v = (tr.cells[i]?.textContent ?? "").trim()
        if (!v) continue
        distintos.add(v)
        if (distintos.size > MAX_OPCIONES) {
          demasiados = true
          break
        }
      }
      return {
        indice: i,
        label,
        opciones: demasiados || distintos.size <= 1 ? null : [...distintos].sort((a, b) => a.localeCompare(b, "es", { numeric: true })),
      }
    })

    const activos = Object.entries(filtrosRef.current).filter(([, v]) => v.trim() !== "")
    let mostradas = 0
    let visibleAnterior = true
    for (const tr of filas) {
      // Fila de detalle o de total: sigue a la fila de datos anterior
      if (tr.cells.length < ths.length || esFilaTotal(tr)) {
        tr.style.display = esFilaTotal(tr) || visibleAnterior ? "" : "none"
        continue
      }
      let visible = true
      for (const [k, valor] of activos) {
        const i = Number(k)
        const texto = normalizar(tr.cells[i]?.textContent ?? "")
        const col = cols[i]
        visible = col?.opciones ? texto === normalizar(valor) : texto.includes(normalizar(valor))
        if (!visible) break
      }
      tr.style.display = visible ? "" : "none"
      visibleAnterior = visible
      if (visible) mostradas++
    }

    setColumnas(cols)
    setTotalFilas(filasDatos.length)
    setVisibles(mostradas)
  }, [])

  // Re-aplicar cuando React vuelva a dibujar las filas
  React.useEffect(() => {
    aplicar()
    const nodo = ref.current
    if (!nodo) return
    let pendiente = 0
    const obs = new MutationObserver(() => {
      cancelAnimationFrame(pendiente)
      pendiente = requestAnimationFrame(aplicar)
    })
    obs.observe(nodo, { childList: true, subtree: true, characterData: true })
    return () => {
      obs.disconnect()
      cancelAnimationFrame(pendiente)
    }
  }, [aplicar])

  React.useEffect(() => {
    aplicar()
  }, [filtros, aplicar])

  const hayFiltros = Object.values(filtros).some((v) => v.trim() !== "")
  const mostrarBarra = totalFilas >= minFilas || hayFiltros
  const filtrables = columnas.filter((c) => c.label !== "")

  return (
    <div ref={ref} className={className}>
      {mostrarBarra && filtrables.length > 0 && (
        <div className="mb-2 flex flex-wrap items-end gap-2 rounded-xl border border-stone-200 bg-stone-50/70 px-3 py-2">
          <span className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
            <Filter className="h-3 w-3" /> Filtrar
          </span>
          {filtrables.map((c) => {
            const valor = filtros[c.indice] ?? ""
            const cls = `h-7 rounded-lg border bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-[#344966]/40 ${
              valor ? "border-[#344966] text-stone-900" : "border-stone-200 text-stone-700"
            }`
            return (
              <label key={c.indice} className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[10px] font-medium text-stone-500">{c.label}</span>
                {c.opciones ? (
                  <select
                    value={valor}
                    onChange={(e) => setFiltros((p) => ({ ...p, [c.indice]: e.target.value }))}
                    className={`${cls} max-w-44`}
                  >
                    <option value="">Todos</option>
                    {c.opciones.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={valor}
                    onChange={(e) => setFiltros((p) => ({ ...p, [c.indice]: e.target.value }))}
                    placeholder="Buscar…"
                    className={`${cls} w-28`}
                  />
                )}
              </label>
            )
          })}
          <div className="ml-auto flex items-center gap-2 self-center pt-3">
            <span className="text-[11px] tabular-nums text-stone-500">
              {hayFiltros ? `${visibles} de ${totalFilas}` : totalFilas} filas
            </span>
            {hayFiltros && (
              <button
                type="button"
                onClick={() => setFiltros({})}
                className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-50"
              >
                <X className="h-3 w-3" /> Limpiar
              </button>
            )}
          </div>
        </div>
      )}
      {children}
    </div>
  )
}
