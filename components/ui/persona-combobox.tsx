"use client"

import * as React from "react"
import { Search, Check, ChevronDown, X } from "lucide-react"

// Opción de un estampador o confeccionista: se identifica por su nombre
// (que es lo que se guarda en los procesos) y se puede buscar por su código
export interface PersonaOpcion {
  id: number
  nombre_completo: string
}

// Combobox con búsqueda por texto y por código, para elegir estampadores y
// confeccionistas. El valor que maneja es el nombre completo, igual que los
// selects que reemplaza, así no cambia lo que se guarda.
export function PersonaCombobox({
  opciones,
  value,
  onChange,
  placeholder = "Buscar por nombre o código…",
  vacioLabel = "— Sin asignar —",
  className = "",
  disabled = false,
  compacto = false,
}: {
  opciones: PersonaOpcion[]
  value: string
  onChange: (nombre: string) => void
  placeholder?: string
  vacioLabel?: string
  className?: string
  disabled?: boolean
  compacto?: boolean
}) {
  const [abierto, setAbierto] = React.useState(false)
  const [busqueda, setBusqueda] = React.useState("")
  const contenedorRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Cerrar al hacer clic fuera
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
          o.nombre_completo.toLowerCase().includes(q) ||
          String(o.id).includes(q) ||
          `#${o.id}`.includes(q)
      )
    : opciones

  // El valor guardado puede no estar en la lista (persona inactiva o borrada)
  const seleccionada = opciones.find((o) => o.nombre_completo === value)
  const noRegistrado = value && !seleccionada

  const alto = compacto ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"

  function elegir(nombre: string) {
    onChange(nombre)
    setAbierto(false)
    setBusqueda("")
  }

  return (
    <div ref={contenedorRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAbierto((a) => !a)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white ${alto} text-left outline-none focus:ring-2 focus:ring-[#344966] disabled:bg-stone-100 disabled:text-stone-400`}
      >
        <span className={`truncate ${value ? "text-stone-800" : "text-stone-400"}`}>
          {value ? (
            <>
              {seleccionada && (
                <span className="font-mono text-[11px] text-stone-400 mr-1.5">
                  #{seleccionada.id}
                </span>
              )}
              {value}
              {noRegistrado && (
                <span className="text-[11px] text-amber-600 ml-1">(no registrado)</span>
              )}
            </>
          ) : (
            vacioLabel
          )}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-stone-400" />
      </button>

      {abierto && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-stone-200 bg-white shadow-lg">
          {/* Buscador por nombre o código */}
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
                  elegir(filtradas[0].nombre_completo)
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
            {/* Opción para dejar sin asignar */}
            <button
              type="button"
              onClick={() => elegir("")}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-stone-500 hover:bg-stone-50"
            >
              {vacioLabel}
              {!value && <Check className="h-3.5 w-3.5 text-[#344966]" />}
            </button>

            {filtradas.length === 0 ? (
              <p className="px-3 py-3 text-center text-xs text-stone-400">
                Sin resultados para &quot;{busqueda}&quot;
              </p>
            ) : (
              filtradas.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => elegir(o.nombre_completo)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-stone-50"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[11px] text-stone-400 shrink-0">
                      #{o.id}
                    </span>
                    <span className="truncate text-xs text-stone-800">{o.nombre_completo}</span>
                  </span>
                  {value === o.nombre_completo && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-[#344966]" />
                  )}
                </button>
              ))
            )}
          </div>

          {opciones.length > 0 && (
            <div className="border-t border-stone-100 px-3 py-1.5 text-[11px] text-stone-400">
              {filtradas.length} de {opciones.length} · busca por nombre o código
            </div>
          )}
        </div>
      )}
    </div>
  )
}
