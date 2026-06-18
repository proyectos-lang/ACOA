import { requirePermiso } from "@/lib/auth/require-permiso"
import { listOPsEnCorte } from "@/lib/db/corte"
import Link from "next/link"
import { FileText, Ruler } from "lucide-react"

function padOP(n: number) {
  return `OP-${String(n).padStart(4, "0")}`
}

export default async function CortePage() {
  await requirePermiso("mod_corte")
  const ops = await listOPsEnCorte()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Corte</h1>
        <p className="text-sm text-stone-500">Órdenes en estado Corte</p>
      </div>

      {ops.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
          <FileText className="h-10 w-10 mx-auto mb-3 text-stone-300" />
          <p className="text-stone-400 text-sm">No hay órdenes en estado Corte.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  {["OP", "Referencia", "Gama / Color", "Fecha prog.", "Ficha de corte", ""].map(
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
                {ops.map((op) => (
                  <tr
                    key={op.id}
                    className="border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-stone-700">
                      {padOP(op.numero_op)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-stone-800">{op.referencia}</p>
                      {op.descripcion && (
                        <p className="text-xs text-stone-400 truncate max-w-xs">{op.descripcion}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-stone-500 text-xs">{op.gama_color ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-stone-600">
                      {op.fecha_programacion ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {op.corte ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium">
                          <Ruler className="h-3 w-3" /> Creada
                        </span>
                      ) : (
                        <span className="text-xs text-stone-400">Pendiente</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/corte/${op.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-stone-100 transition-colors text-stone-500"
                      >
                        Abrir ficha →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
