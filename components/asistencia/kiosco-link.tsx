"use client"

import { useState, useEffect } from "react"
import { Monitor, Copy, Check, ExternalLink } from "lucide-react"

export function KioscoLink() {
  const [url, setUrl] = useState("")
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    setUrl(window.location.origin + "/kiosco")
  }, [])

  function copiar() {
    if (!url) return
    navigator.clipboard.writeText(url).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm">
      <Monitor className="h-4 w-4 text-[#344966] shrink-0" />
      <span className="text-xs text-stone-400 hidden sm:inline">Kiosco:</span>
      <span className="font-mono text-xs text-stone-600 truncate max-w-[200px]">{url || "cargando..."}</span>
      <div className="flex items-center gap-1 ml-1 shrink-0">
        <button
          onClick={copiar}
          title="Copiar enlace"
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-stone-500 hover:bg-stone-100 transition-colors"
        >
          {copiado ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-500" />
              <span className="text-green-600">Copiado</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copiar</span>
            </>
          )}
        </button>
        <a
          href="/kiosco"
          target="_blank"
          rel="noopener noreferrer"
          title="Abrir kiosco en nueva pestaña"
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#344966] hover:bg-stone-100 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span>Abrir</span>
        </a>
      </div>
    </div>
  )
}
