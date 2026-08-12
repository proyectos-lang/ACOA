"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Save, CheckCircle2, AlertTriangle } from "lucide-react"
import { VALORES_FIJOS } from "@/lib/db/hoja-costos"
import { guardarConfigCostosAction } from "@/app/(dashboard)/configuracion-costos/actions"

function cop(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)
}

export function ConfigCostosClient({ config }: { config: Record<string, number> }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)

  const [valores, setValores] = React.useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const f of VALORES_FIJOS) {
      init[f.key as string] = config[f.key as string] != null ? String(config[f.key as string]) : "0"
    }
    return init
  })

  function showToast(tipo: "ok" | "error", msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 3500)
  }

  function handleSave() {
    const fd = new FormData()
    for (const f of VALORES_FIJOS) {
      fd.set(f.key as string, valores[f.key as string] || "0")
    }
    startTransition(async () => {
      const res = await guardarConfigCostosAction(fd)
      if (res.error) showToast("error", res.error)
      else { showToast("ok", "Configuración de costos guardada"); router.refresh() }
    })
  }

  const num = (s: string | undefined) => parseFloat(s ?? "") || 0
  const total = VALORES_FIJOS.reduce((s, f) => s + num(valores[f.key as string]), 0)

  return (
    <div className="space-y-4 max-w-3xl">
      {toast && (
        <div
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
            toast.tipo === "ok"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {toast.tipo === "ok" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          {toast.msg}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wide">
                Item
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wide w-48">
                Costo estándar / prenda
              </th>
            </tr>
          </thead>
          <tbody>
            {VALORES_FIJOS.map((f) => (
              <tr key={f.key as string} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-2.5 font-medium text-stone-800">{f.label}</td>
                <td className="px-4 py-2.5">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={valores[f.key as string]}
                    onChange={(e) =>
                      setValores((p) => ({ ...p, [f.key as string]: e.target.value }))
                    }
                    className="w-40 rounded-xl border border-stone-200 px-3 py-1.5 text-sm text-right font-mono outline-none focus:ring-2 focus:ring-[#344966]"
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-stone-200 bg-stone-50">
              <td className="px-4 py-3 text-sm font-semibold text-stone-600">
                Total costos fijos estándar / prenda
              </td>
              <td className="px-4 py-3 text-right font-mono font-bold text-stone-900">
                {cop(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <button
        onClick={handleSave}
        disabled={isPending}
        className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        style={{ backgroundColor: "#344966" }}
      >
        <Save className="h-4 w-4" />
        {isPending ? "Guardando…" : "Guardar configuración"}
      </button>
    </div>
  )
}
