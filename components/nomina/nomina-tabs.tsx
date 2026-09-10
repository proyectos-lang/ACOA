"use client"

import * as React from "react"
import { CalendarDays, ListChecks, Package } from "lucide-react"
import type { PeriodoNominaRow } from "@/lib/db/periodo-nomina"
import type { PersonaRow } from "@/lib/db/persona"
import type { NominaPersona, ConfigNominaGeneral, LineaProduccion } from "@/lib/db/nomina-diaria"
import { PeriodosClient } from "@/components/nomina/periodos-client"
import { NominaDiariaClient } from "@/components/nomina/nomina-diaria-client"
import { NominaProduccionClient } from "@/components/nomina/nomina-produccion-client"

// Une la nómina diaria (con su configuración) y los períodos quincenales
export function NominaTabs({
  periodos,
  empleados,
  personasIniciales,
  configInicial,
  desdeInicial,
  hastaInicial,
  lineasProduccion,
  valorPrenda,
}: {
  periodos: PeriodoNominaRow[]
  empleados: PersonaRow[]
  personasIniciales: NominaPersona[]
  configInicial: ConfigNominaGeneral | null
  desdeInicial: string
  hastaInicial: string
  lineasProduccion: LineaProduccion[]
  valorPrenda: number
}) {
  const [vista, setVista] = React.useState<"diaria" | "produccion" | "periodos">("diaria")

  return (
    <div className="space-y-4">
      <div className="flex rounded-xl border border-stone-200 overflow-hidden w-fit">
        <button
          type="button"
          onClick={() => setVista("diaria")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold ${
            vista === "diaria" ? "bg-[#344966] text-white" : "bg-white text-stone-600"
          }`}
        >
          <CalendarDays className="h-4 w-4" /> Pago diario
        </button>
        <button
          type="button"
          onClick={() => setVista("produccion")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold ${
            vista === "produccion" ? "bg-[#344966] text-white" : "bg-white text-stone-600"
          }`}
        >
          <Package className="h-4 w-4" /> Por producción
        </button>
        <button
          type="button"
          onClick={() => setVista("periodos")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold ${
            vista === "periodos" ? "bg-[#344966] text-white" : "bg-white text-stone-600"
          }`}
        >
          <ListChecks className="h-4 w-4" /> Períodos quincenales
        </button>
      </div>

      {vista === "diaria" ? (
        <NominaDiariaClient
          personasIniciales={personasIniciales}
          configInicial={configInicial}
          empleados={empleados}
          desdeInicial={desdeInicial}
          hastaInicial={hastaInicial}
        />
      ) : vista === "produccion" ? (
        <NominaProduccionClient
          lineasIniciales={lineasProduccion}
          valorPrendaInicial={valorPrenda}
          empleados={empleados}
          desdeInicial={desdeInicial}
          hastaInicial={hastaInicial}
        />
      ) : (
        <PeriodosClient periodos={periodos} />
      )}
    </div>
  )
}
