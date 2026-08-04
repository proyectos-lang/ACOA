"use client"

import type { LoteRow } from "@/lib/db/lote"

// Imagen de referencia del lote (subida desde el módulo de Diseño).
// Se muestra en las fichas de toda la cadena de producción.
export function LoteImagenRef({
  lote,
  size = "h-28 w-28",
}: {
  lote: Pick<LoteRow, "url_imagen" | "numero_lote" | "notas_diseno">
  size?: string
}) {
  if (!lote.url_imagen) return null
  return (
    <a
      href={lote.url_imagen}
      target="_blank"
      rel="noopener noreferrer"
      title={lote.notas_diseno ?? "Imagen de referencia del lote"}
      className="shrink-0 group"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={lote.url_imagen}
        alt={`Referencia lote ${lote.numero_lote}`}
        className={`${size} rounded-xl object-cover border border-stone-200 bg-white group-hover:ring-2 group-hover:ring-[#344966] transition-shadow`}
      />
      <p className="text-[10px] text-stone-400 text-center mt-1">Ref. diseño</p>
    </a>
  )
}
