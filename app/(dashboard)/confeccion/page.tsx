import { requirePermiso } from "@/lib/auth/require-permiso"
import { LOTE_ESTADO_COLOR, LOTE_ESTADO_LABEL } from "@/lib/db/lote"
import { getLotesEnConfeccion } from "@/lib/db/confeccion"
import Link from "next/link"
import { FileText } from "lucide-react"

function padLote(n: number) {
  return `LOTE-${String(n).padStart(4, "0")}`
}
function padOP(n: number) {
  return `OP-${String(n).padStart(4, "0")}`
}

export default async function ConfeccionPage() {
  await requirePermiso("mod_confeccion")
  const lotes = await getLotesEnConfeccion()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Confección</h1>
        <p className="text-sm text-stone-500">Lotes en proceso de confección</p>
      </div>

      {lotes.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
          <FileText className="h-10 w-10 mx-auto mb-3 text-stone-300" />
          <p className="text-stone-400 text-sm">No hay lotes en proceso de confección.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  {["Lote", "OP / Referencia", "Color", "Programado", "Reconfirmado", "Confeccionista", "Estado", ""].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide text-left"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {lotes.map((lote) => {
                  const diff =
                    lote.confeccion?.cantidad_reconfirmada != null &&
                    lote.confeccion.cantidad_reconfirmada !== lote.cantidad_programada
                  return (
                    <tr
                      key={lote.id}
                      className="border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-stone-700">
                        {padLote(lote.numero_lote)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-stone-800">{lote.orden.referencia}</p>
                        <p className="text-xs text-stone-400 font-mono">{padOP(lote.orden.numero_op)}</p>
                      </td>
                      <td className="px-4 py-3 text-stone-600">{lote.color}</td>
                      <td className="px-4 py-3 font-mono text-stone-700">
                        {lote.cantidad_programada.toLocaleString("es-CO")}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {lote.confeccion?.cantidad_reconfirmada != null ? (
                          <span className={diff ? "text-amber-600 font-semibold" : "text-stone-700"}>
                            {lote.confeccion.cantidad_reconfirmada.toLocaleString("es-CO")}
                            {diff && " ⚠"}
                          </span>
                        ) : (
                          <span className="text-stone-400 italic text-xs">Sin confirmar</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-stone-600 text-xs">
                        {lote.confeccion?.nombre_confeccionista ?? (
                          <span className="text-stone-400 italic">Sin asignar</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            LOTE_ESTADO_COLOR[lote.estado] ?? "bg-stone-100 text-stone-700"
                          }`}
                        >
                          {LOTE_ESTADO_LABEL[lote.estado] ?? lote.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/confeccion/${lote.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-stone-100 transition-colors text-stone-500"
                        >
                          Abrir ficha →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
