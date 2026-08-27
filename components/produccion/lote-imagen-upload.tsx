"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { ImageIcon, Upload } from "lucide-react"
import type { LoteRow } from "@/lib/db/lote"
import { subirImagenLoteAction } from "@/app/(dashboard)/lote-imagen-actions"

// Panel de imagen de referencia del lote con opción de subir/reemplazar.
// Usado en las fichas de Estampación y Confección.
export function LoteImagenUpload({
  lote,
  onMsg,
}: {
  lote: Pick<LoteRow, "id" | "orden_id" | "numero_lote" | "url_imagen" | "notas_diseno">
  onMsg?: (tipo: "ok" | "error", msg: string) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [preview, setPreview] = React.useState<string | null>(lote.url_imagen)
  const [archivo, setArchivo] = React.useState<File | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!archivo) setPreview(lote.url_imagen)
  }, [lote.url_imagen, archivo])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setArchivo(f)
    if (f) setPreview(URL.createObjectURL(f))
  }

  function handleSubir() {
    if (!archivo) return
    const fd = new FormData()
    fd.set("imagen_lote", archivo)
    startTransition(async () => {
      const res = await subirImagenLoteAction(lote.id, lote.orden_id, fd)
      if (res.error) onMsg?.("error", res.error)
      else {
        onMsg?.("ok", "Imagen del lote guardada")
        setArchivo(null)
        if (inputRef.current) inputRef.current.value = ""
        router.refresh()
      }
    })
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
      <h2 className="text-sm font-semibold text-stone-700 border-b border-stone-100 pb-2">
        Imagen del lote
      </h2>

      {preview ? (
        <a href={preview} target="_blank" rel="noopener noreferrer" title="Ver imagen completa">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={`Imagen de referencia del lote ${lote.numero_lote}`}
            className="w-full max-h-96 object-contain rounded-xl border border-stone-200 bg-stone-50 p-2"
          />
        </a>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-200 bg-stone-50 p-10 text-center">
          <ImageIcon className="h-10 w-10 text-stone-300 mb-2" />
          <p className="text-sm text-stone-400">Este lote aún no tiene imagen de referencia.</p>
        </div>
      )}

      {lote.notas_diseno && (
        <p className="text-xs text-stone-500">
          <span className="font-semibold text-stone-600">Notas de diseño:</span> {lote.notas_diseno}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="flex-1 min-w-[200px] text-xs text-stone-500 file:mr-2 file:rounded-lg file:border-0 file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:bg-stone-100 file:text-stone-600 hover:file:bg-stone-200"
        />
        <button
          type="button"
          onClick={handleSubir}
          disabled={isPending || !archivo}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: "#344966" }}
        >
          <Upload className="h-3.5 w-3.5" />
          {isPending ? "Subiendo…" : lote.url_imagen ? "Reemplazar imagen" : "Subir imagen"}
        </button>
      </div>
    </div>
  )
}
