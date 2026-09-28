"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, AlertTriangle } from "lucide-react"
import type { ReferenciaVentaRow } from "@/lib/db/venta"
import { MaestroProductos } from "@/components/ventas/productos-y-registros"

// Envuelve el maestro con su propio aviso: en Ventas ese aviso lo ponia
// el cliente de ventas, aqui el modulo es independiente.
export function ProductosClient({ referencias }: { referencias: ReferenciaVentaRow[] }) {
  const router = useRouter()
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)

  const aviso = (tipo: "ok" | "error", msg: string) => {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 5000)
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
            toast.tipo === "ok"
              ? "border border-green-200 bg-green-50 text-green-800"
              : "border border-red-200 bg-red-50 text-red-800"
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

      <MaestroProductos
        referencias={referencias}
        onMsg={aviso}
        onRefrescar={() => router.refresh()}
      />
    </div>
  )
}
