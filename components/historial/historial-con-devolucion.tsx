"use client"

import * as React from "react"
import { FileText, Undo2 } from "lucide-react"
import type { ModuloDef } from "@/lib/db/historial"
import type { RegistroHistorial } from "@/lib/db/historial"
import { HistorialClient } from "@/components/historial/historial-client"
import { DevolverProcesoClient } from "@/components/historial/devolver-proceso-client"

// Envuelve el historial y la devolucion de procesos en dos pestañas: son
// dos formas de corregir lo registrado, y conviene tenerlas juntas.
export function HistorialConDevolucion({
  modulos,
  moduloInicial,
  registrosIniciales,
}: {
  modulos: ModuloDef[]
  moduloInicial: string
  registrosIniciales: RegistroHistorial[]
}) {
  const [vista, setVista] = React.useState<"registros" | "devolver">("registros")

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            { k: "registros" as const, label: "Registros por módulo", icon: FileText },
            { k: "devolver" as const, label: "Devolver proceso", icon: Undo2 },
          ]
        ).map((t) => (
          <button
            key={t.k}
            onClick={() => setVista(t.k)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              vista === t.k
                ? "bg-[#344966] text-white"
                : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
            }`}
          >
            <t.icon className="mr-2 inline h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {vista === "registros" ? (
        <HistorialClient
          modulos={modulos}
          moduloInicial={moduloInicial}
          registrosIniciales={registrosIniciales}
        />
      ) : (
        <DevolverProcesoClient />
      )}
    </div>
  )
}
