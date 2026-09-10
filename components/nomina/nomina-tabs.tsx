"use client"

import * as React from "react"
import { CalendarDays, ListChecks } from "lucide-react"
import type { PeriodoNominaRow } from "@/lib/db/periodo-nomina"
import type { PersonaRow } from "@/lib/db/persona"
import type { NominaPersona, ConfigNominaGeneral } from "@/lib/db/nomina-diaria"
import { PeriodosClient } from "@/components/nomina/periodos-client"
import { NominaDiariaClient } from "@/components/nomina/nomina-diaria-client"

// Une la nómina diaria (con su configuración) y los períodos quincenales
export function NominaTabs({
  periodos,
  empleados,
  personasIniciales,
  configInicial,
  desdeInicial,
  hastaInicial,
}: {
  periodos: PeriodoNominaRow[]
  empleados: PersonaRow[]
  personasIniciales: NominaPersona[]
  configInicial: ConfigNominaGeneral | null
  desdeInicial: string
  hastaInicial: string
}) {
  const [vista, setVista] = React.useState<"diaria" | "periodos">("diaria")

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
      ) : (
        <PeriodosClient periodos={periodos} />
      )}
    </div>
  )
}
