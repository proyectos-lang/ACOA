import { requirePermiso } from "@/lib/auth/require-permiso"
import { getLiquidacionEmpaque } from "@/lib/db/liquidacion-empaque"
import { listPersonas } from "@/lib/db/persona"
import { LiquidacionEmpaqueClient } from "@/components/liquidacion-empaque/liquidacion-empaque-client"

export default async function LiquidacionEmpaquePage() {
  await requirePermiso("mod_empaque")

  // Por defecto, la última semana
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
  const hace7 = new Date(Date.now() - 7 * 86400000).toLocaleDateString("en-CA", {
    timeZone: "America/Bogota",
  })

  const [dias, empacadoras] = await Promise.all([
    getLiquidacionEmpaque({ desde: hace7, hasta: hoy }),
    listPersonas({ tipo_pago: "produccion", estado: "activo" }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Liquidación de empaque</h1>
        <p className="text-sm text-stone-500">
          Lo que empacó cada persona por día, con su detalle por talla y lote, para hacer el
          cierre del día.
        </p>
      </div>

      <LiquidacionEmpaqueClient
        diasIniciales={dias}
        empacadoras={empacadoras}
        desdeInicial={hace7}
        hastaInicial={hoy}
      />
    </div>
  )
}
