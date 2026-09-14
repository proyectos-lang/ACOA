"use client"

import * as React from "react"
import { Search, Check, ChevronDown, X } from "lucide-react"

// Opcion de referencia: se identifica por el codigo de referencia, que es
// lo que se guarda en la venta, y se puede buscar por codigo o descripcion.
export interface ReferenciaOpcion {
  referencia: string
  descripcion?: string | null
  // Disponible en inventario, para verlo al elegir
  disponible?: number
}

// Combobox de referencias con busqueda por codigo o descripcion. El valor
// que maneja es el codigo de referencia, igual que el select que reemplaza.
export function ReferenciaCombobox({
  opciones,
  value,
  onChange,
  placeholder = "Buscar por referencia o descripcion...",
  vacioLabel = "Selecciona la referencia",
  className = "",
  disabled = false,
}: {
  opciones: ReferenciaOpcion[]
  value: string
  onChange: (referencia: string) => void
  placeholder?: string
  vacioLabel?: string
  className?: string
  disabled?: boolean
}) {
  const [abierto, setAbierto] = React.useState(false)
  const [busqueda, setBusqueda] = React.useState("")
  const contenedorRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!abierto) return
    function alClic(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false)
        setBusqueda("")
      }
    }
    document.addEventListener("mousedown", alClic)
    return () => document.removeEventListener("mousedown", alClic)
  }, [abierto])

  React.useEffect(() => {
    if (abierto) inputRef.current?.focus()
  }, [abierto])

  const q = busqueda.trim().toLowerCase()
  const filtradas = q
    ? opciones.filter(
        (o) =>
          o.referencia.toLowerCase().includes(q) ||
          (o.descripcion ?? "").toLowerCase().includes(q)
      )
    : opciones

  const seleccionada = opciones.find(
    (o) => o.referencia.trim().toUpperCase() === value.trim().toUpperCase()
  )

  function elegir(referencia: string) {
    onChange(referencia)
    setAbierto(false)
    setBusqueda("")
  }

  return (
    <div ref={contenedorRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAbierto((a) => !a)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-left text-sm outline-none focus:ring-2 focus:ring-[#344966] disabled:bg-stone-100 disabled:text-stone-400"
      >
        <span className={`truncate ${value ? "text-stone-800" : "text-stone-400"}`}>
          {value ? (
            <>
              <span className="font-semibold">{value}</span>
              {seleccionada?.descripcion && (
                <span className="ml-1.5 text-[11px] text-stone-400">
                  {seleccionada.descripcion}
                </span>
              )}
            </>
          ) : (
            vacioLabel
          )}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-stone-400" />
      </button>

      {abierto && (
        <div className="absolute z-50 mt-1 w-full min-w-[260px] rounded-xl border border-stone-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-stone-100 px-2.5 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-stone-400" />
            <input
              ref={inputRef}
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setAbierto(false)
                  setBusqueda("")
                }
                if (e.key === "Enter" && filtradas.length === 1) {
                  e.preventDefault()
                  elegir(filtradas[0].referencia)
                }
              }}
              placeholder={placeholder}
              className="w-full text-xs outline-none placeholder:text-stone-400"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                className="text-stone-400 hover:text-stone-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {filtradas.length === 0 ? (
              <p className="px-3 py-3 text-center text-xs text-stone-400">
                Sin resultados para &quot;{busqueda}&quot;
              </p>
            ) : (
              filtradas.map((o) => (
                <button
                  key={o.referencia}
                  type="button"
                  onClick={() => elegir(o.referencia)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-stone-50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-xs font-semibold text-stone-800">
                      {o.referencia}
                    </span>
                    {o.descripcion && (
                      <span className="truncate text-[11px] text-stone-400">{o.descripcion}</span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {typeof o.disponible === "number" && (
                      <span
                        className={`text-[10px] ${
                          o.disponible > 0 ? "text-stone-400" : "text-red-400"
                        }`}
                      >
                        {o.disponible} disp.
                      </span>
                    )}
                    {seleccionada?.referencia === o.referencia && (
                      <Check className="h-3.5 w-3.5 text-[#344966]" />
                    )}
                  </span>
                </button>
              ))
            )}
          </div>

          {opciones.length > 0 && (
            <div className="border-t border-stone-100 px-3 py-1.5 text-[11px] text-stone-400">
              {filtradas.length} de {opciones.length} &middot; busca por referencia o descripcion
            </div>
          )}
        </div>
      )}
    </div>
  )
}
