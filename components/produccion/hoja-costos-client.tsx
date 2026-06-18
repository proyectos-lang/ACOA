"use client"

import * as React from "react"
import { useTransition } from "react"
import { Save, Printer, AlertTriangle, CheckCircle2 } from "lucide-react"
import type { OrdenProduccionRow } from "@/lib/db/orden-produccion"
import type { HojaCostosRow } from "@/lib/db/hoja-costos"
import { VALORES_FIJOS } from "@/lib/db/hoja-costos"
import type { OpMaterialRow } from "@/lib/db/op-material"
import { guardarHojaCostosAction } from "@/app/(dashboard)/produccion/[id]/costos/actions"

interface Props {
  orden: OrdenProduccionRow
  hojaCostos: HojaCostosRow
  opMateriales: OpMaterialRow[]
}

function cop(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function pct(n: number) {
  return `${Number(n).toFixed(2)}%`
}

function padOP(n: number) {
  return `OP-${String(n).padStart(4, "0")}`
}

export function HojaCostosClient({ orden, hojaCostos, opMateriales }: Props) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = React.useState<{
    costo_materiales: number
    costo_unitario: number
  } | null>(null)
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)
  const formRef = React.useRef<HTMLFormElement>(null)

  const costoMateriales = result?.costo_materiales ?? Number(hojaCostos.costo_materiales)
  const costoUnitario = result?.costo_unitario ?? Number(hojaCostos.costo_unitario)

  function showToast(tipo: "ok" | "error", msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 3500)
  }

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await guardarHojaCostosAction(orden.id, fd)
      if (res.error) {
        showToast("error", res.error)
      } else {
        setResult({
          costo_materiales: res.costo_materiales ?? costoMateriales,
          costo_unitario: res.costo_unitario ?? costoUnitario,
        })
        showToast("ok", "Hoja de costos guardada")
      }
    })
  }

  const fieldCls =
    "w-full rounded-xl border border-stone-200 px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-[#344966] text-right"

  return (
    <div className="space-y-6">
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

      <form ref={formRef} onSubmit={handleSave}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Columna izquierda: 15 valores fijos */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-stone-700 border-b border-stone-100 pb-2">
              Valores fijos por prenda
            </h2>
            <div className="space-y-2">
              {VALORES_FIJOS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="text-sm text-stone-600 flex-1 text-right">{label}</label>
                  <input
                    type="number"
                    name={key}
                    min="0"
                    step="0.01"
                    defaultValue={Number(hojaCostos[key])}
                    className="w-40 rounded-xl border border-stone-200 px-3 py-1.5 text-sm font-mono outline-none focus:ring-2 focus:ring-[#344966] text-right"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Columna derecha: resumen + precio + guardar */}
          <div className="space-y-4">
            {/* Resumen de costos */}
            <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
              <h2 className="text-sm font-semibold text-stone-700 border-b border-stone-100 pb-2">
                Resumen de costos
              </h2>

              {/* Materiales por prenda */}
              <div className="rounded-xl bg-stone-50 border border-stone-200 p-3 space-y-1">
                <p className="text-xs text-stone-500 font-medium">Materiales e insumos (calculado)</p>
                <p className="text-lg font-bold font-mono text-stone-900">{cop(costoMateriales)}</p>
              </div>

              {/* Costo unitario */}
              <div className="rounded-xl bg-[#344966] p-3 space-y-1">
                <p className="text-xs text-blue-200 font-medium">Costo unitario total</p>
                <p className="text-xl font-bold font-mono text-white">{cop(costoUnitario)}</p>
              </div>

              {/* Total unidades + costo total */}
              {hojaCostos.total_unidades > 0 && (
                <div className="rounded-xl bg-stone-50 border border-stone-200 p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-stone-500">Total unidades</p>
                    <p className="text-sm font-bold font-mono text-stone-800">{hojaCostos.total_unidades.toLocaleString("es-CO")}</p>
                  </div>
                  <div className="flex items-center justify-between border-t border-stone-200 pt-1 mt-1">
                    <p className="text-xs text-stone-500">Costo total orden</p>
                    <p className="text-sm font-bold font-mono text-stone-900">{cop(Number(hojaCostos.costo_total))}</p>
                  </div>
                </div>
              )}

              {/* Precio venta */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-stone-700">Precio de venta</label>
                <input
                  type="number"
                  name="precio_venta"
                  min="0"
                  step="0.01"
                  defaultValue={hojaCostos.precio_venta ?? ""}
                  placeholder="0.00"
                  className={fieldCls}
                />
              </div>

              {/* Margen */}
              <div className="rounded-xl bg-stone-50 border border-stone-200 p-3 flex items-center justify-between">
                <p className="text-sm text-stone-600">Margen</p>
                <p
                  className={`text-lg font-bold font-mono ${
                    Number(hojaCostos.margen) > 0 ? "text-green-700" : "text-stone-400"
                  }`}
                >
                  {pct(Number(hojaCostos.margen))}
                </p>
              </div>
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
                style={{ backgroundColor: "#344966" }}
              >
                <Save className="h-4 w-4" />
                {isPending ? "Guardando…" : "Recalcular y guardar"}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium border border-stone-200 hover:bg-stone-50 transition-colors text-stone-600"
              >
                <Printer className="h-4 w-4" />
                PDF
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* ── Sección de impresión (oculta en pantalla) ── */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #print-hoja-costos { display: block !important; }
          #print-hoja-costos { position: fixed; top: 0; left: 0; width: 100%; }
        }
        #print-hoja-costos { display: none; }
      `}</style>

      <div id="print-hoja-costos" style={{ fontFamily: "Arial, sans-serif", fontSize: 11, color: "#111" }}>
        {/* Encabezado */}
        <div style={{ borderBottom: "2px solid #344966", paddingBottom: 8, marginBottom: 16 }}>
          <h1 style={{ fontSize: 18, fontWeight: "bold", color: "#344966", margin: 0 }}>
            Hoja de Costos — {padOP(orden.numero_op)}
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 12 }}>
            Referencia: <strong>{orden.referencia}</strong>
            {orden.gama_color && ` | Gama: ${orden.gama_color}`}
            {orden.fecha_programacion && ` | Fecha: ${orden.fecha_programacion}`}
          </p>
        </div>

        {/* Tabla de materiales */}
        <h2 style={{ fontSize: 12, fontWeight: "bold", marginBottom: 6 }}>Materiales e insumos</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16, fontSize: 10 }}>
          <thead>
            <tr style={{ backgroundColor: "#f3f4f6" }}>
              {["Material", "Tipo", "Unidad", "Consumo est.", "Valor unit.", "V/Prenda"].map((h) => (
                <th key={h} style={{ border: "1px solid #d1d5db", padding: "4px 8px", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {opMateriales.map((m) => (
              <tr key={m.id}>
                <td style={{ border: "1px solid #d1d5db", padding: "4px 8px" }}>{m.nombre}</td>
                <td style={{ border: "1px solid #d1d5db", padding: "4px 8px" }}>{m.tipo}</td>
                <td style={{ border: "1px solid #d1d5db", padding: "4px 8px" }}>{m.unidad_medida}</td>
                <td style={{ border: "1px solid #d1d5db", padding: "4px 8px", textAlign: "right" }}>{m.consumo_estimado ?? "—"}</td>
                <td style={{ border: "1px solid #d1d5db", padding: "4px 8px", textAlign: "right" }}>{cop(Number(m.valor_unitario))}</td>
                <td style={{ border: "1px solid #d1d5db", padding: "4px 8px", textAlign: "right", fontWeight: "bold" }}>{cop(Number(m.valor_por_prenda))}</td>
              </tr>
            ))}
            <tr style={{ backgroundColor: "#f9fafb" }}>
              <td colSpan={5} style={{ border: "1px solid #d1d5db", padding: "4px 8px", fontWeight: "bold" }}>Total materiales</td>
              <td style={{ border: "1px solid #d1d5db", padding: "4px 8px", textAlign: "right", fontWeight: "bold" }}>{cop(costoMateriales)}</td>
            </tr>
          </tbody>
        </table>

        {/* Tabla de valores fijos */}
        <h2 style={{ fontSize: 12, fontWeight: "bold", marginBottom: 6 }}>Valores fijos por prenda</h2>
        <table style={{ width: "50%", borderCollapse: "collapse", marginBottom: 16, fontSize: 10 }}>
          <tbody>
            {VALORES_FIJOS.map(({ key, label }) => (
              <tr key={key}>
                <td style={{ border: "1px solid #d1d5db", padding: "4px 8px" }}>{label}</td>
                <td style={{ border: "1px solid #d1d5db", padding: "4px 8px", textAlign: "right" }}>{cop(Number(hojaCostos[key]))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Resumen final */}
        <table style={{ width: "50%", borderCollapse: "collapse", fontSize: 11 }}>
          <tbody>
            <tr>
              <td style={{ padding: "6px 8px", fontWeight: "bold" }}>Costo materiales</td>
              <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "monospace" }}>{cop(costoMateriales)}</td>
            </tr>
            <tr style={{ backgroundColor: "#344966", color: "white" }}>
              <td style={{ padding: "6px 8px", fontWeight: "bold" }}>Costo unitario</td>
              <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "monospace", fontWeight: "bold" }}>{cop(costoUnitario)}</td>
            </tr>
            {hojaCostos.precio_venta && (
              <>
                <tr>
                  <td style={{ padding: "6px 8px" }}>Precio de venta</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "monospace" }}>{cop(Number(hojaCostos.precio_venta))}</td>
                </tr>
                <tr>
                  <td style={{ padding: "6px 8px" }}>Margen</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "monospace", fontWeight: "bold", color: "#15803d" }}>{pct(Number(hojaCostos.margen))}</td>
                </tr>
              </>
            )}
            {hojaCostos.total_unidades > 0 && (
              <>
                <tr>
                  <td style={{ padding: "6px 8px" }}>Total unidades</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "monospace" }}>{hojaCostos.total_unidades.toLocaleString("es-CO")}</td>
                </tr>
                <tr style={{ backgroundColor: "#f0fdf4" }}>
                  <td style={{ padding: "6px 8px", fontWeight: "bold" }}>Costo total orden</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "monospace", fontWeight: "bold", color: "#15803d" }}>{cop(Number(hojaCostos.costo_total))}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>

        <p style={{ marginTop: 24, fontSize: 9, color: "#9ca3af", borderTop: "1px solid #e5e7eb", paddingTop: 8 }}>
          Documento confidencial — ACOA · {new Date().toLocaleDateString("es-CO")}
        </p>
      </div>
    </div>
  )
}
