"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import {
  Send, AlertTriangle, CheckCircle2,
  Plus, Trash2, Save, ExternalLink, Printer, RefreshCw,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { OrdenProduccionRow } from "@/lib/db/orden-produccion"
import { ESTADO_OP_LABEL, ESTADO_OP_COLOR } from "@/lib/db/orden-produccion"
import type { OpMaterialRow } from "@/lib/db/op-material"
import type { CurvaTallaRow } from "@/lib/db/curva-talla"
import type { MaterialRow } from "@/lib/db/material"
import type { HojaCostosRow } from "@/lib/db/hoja-costos"
import { VALORES_FIJOS } from "@/lib/db/hoja-costos"
import type { OpTelaRow } from "@/lib/db/op-tela"
import type { OpTelaLoteRow } from "@/lib/db/op-tela-lote"
import type { LoteRow } from "@/lib/db/lote"
import { LOTE_ESTADO_LABEL, LOTE_ESTADO_COLOR } from "@/lib/db/lote"
import {
  guardarInfoGeneralAction,
  guardarInstruccionesAction,
  guardarCurvaAction,
  guardarSlotAction,
  crearLoteAction,
  eliminarLoteAction,
  deleteOpMaterialAction,
  guardarMaterialesOPAction,
  enviarADisenoAction,
} from "@/app/(dashboard)/produccion/[id]/actions"
import type { OpMaterialBatchFila } from "@/lib/db/op-material"
import { guardarHojaCostosAction } from "@/app/(dashboard)/produccion/[id]/costos/actions"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Props {
  orden: OrdenProduccionRow
  opMateriales: OpMaterialRow[]
  curvaTallas: CurvaTallaRow[]
  maestroMateriales: MaterialRow[]
  tieneVerCostos: boolean
  hojaCostos: HojaCostosRow | null
  opTelas: OpTelaRow[]
  opTelaLotes: OpTelaLoteRow[]
  lotes: LoteRow[]
}

function padOP(n: number) {
  return `OP-${String(n).padStart(4, "0")}`
}

function cop(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n)
}

const fieldCls =
  "w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"

// Campos que se muestran en la pestaña Materiales (no en Costos)
const INSUMOS_KEYS = new Set([
  "valor_cordon",
  "valor_bandera",
  "valor_bolsas_flechas_stickers",
  "valor_etiqueta",
  "valor_instruccion",
])

// ─── Tab 1: Info General ─────────────────────────────────────────────────────

function InfoGeneralSection({
  orden,
  onMsg,
}: {
  orden: OrdenProduccionRow
  onMsg: (m: string) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = React.useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await guardarInfoGeneralAction(orden.id, fd)
      if (res.error) { setError(res.error); onMsg(`Error: ${res.error}`) }
      else { setError(null); onMsg("Información guardada"); router.refresh() }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      {/* Número OP - readonly */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-stone-500">Número OP</label>
        <div className="rounded-xl border border-stone-100 bg-stone-50 px-3 py-2 text-sm font-mono font-semibold text-stone-700">
          {padOP(orden.numero_op)}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-stone-700">Referencia *</label>
        <input
          type="text"
          name="referencia"
          defaultValue={orden.referencia}
          required
          className={fieldCls}
          placeholder="Ej: REF-001"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-stone-700">Descripción</label>
        <textarea
          name="descripcion"
          defaultValue={orden.descripcion ?? ""}
          rows={2}
          className={`${fieldCls} resize-none`}
          placeholder="Descripción del producto..."
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-stone-700">Fecha programación</label>
        <input
          type="date"
          name="fecha_programacion"
          defaultValue={orden.fecha_programacion ?? ""}
          className={fieldCls}
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-stone-700">Molde (archivo)</label>
        {orden.url_molde && (
          <a
            href={orden.url_molde}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-2 flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Ver molde actual
          </a>
        )}
        <input
          type="file"
          name="molde"
          accept=".pdf,.dxf,.ai,.png,.jpg,.jpeg"
          className="w-full text-sm text-stone-500 file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-1.5 file:text-xs file:font-medium file:bg-stone-100 file:text-stone-600 hover:file:bg-stone-200"
        />
        <p className="text-xs text-stone-400">PDF, DXF, AI, PNG o JPG. Reemplaza el molde actual.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        style={{ backgroundColor: "#344966" }}
      >
        <Save className="h-4 w-4" />
        {isPending ? "Guardando…" : "Guardar información"}
      </button>
    </form>
  )
}

// ─── Tab 2: Curva (Op Telas + Tallas) ───────────────────────────────────────

type EntradaColor = { key: string; nombre: string }
type EntradaLote  = { key: string; nombre: string }
type CapasGrid    = Record<string, Record<string, number | null>>  // capas[colorKey][loteKey]
type SlotGrid     = { colores: EntradaColor[]; lotes: EntradaLote[]; capas: CapasGrid }

function buildGridFromServer(
  opTelas: OpTelaRow[],
  opTelaLotes: OpTelaLoteRow[],
  slot: 1 | 2 | 3
): { tipoTela: string; colores: EntradaColor[]; lotes: EntradaLote[]; capas: CapasGrid } {
  const telasSlot = opTelas.filter((t) => t.slot === slot)
  const lotesSlot = opTelaLotes.filter((r) => r.slot === slot)

  const coloresUnicos = [...new Set(telasSlot.map((t) => t.color ?? "").filter(Boolean))]
  const lotesUnicos   = [...new Set(lotesSlot.map((r) => r.lote_nombre))]

  const colores: EntradaColor[] = coloresUnicos.map((n) => ({ key: n, nombre: n }))
  const lotes:   EntradaLote[]  = lotesUnicos.map((n)   => ({ key: n, nombre: n }))

  const capas: CapasGrid = {}
  for (const c of colores) {
    capas[c.key] = {}
    for (const l of lotes) {
      const fila = lotesSlot.find((r) => r.color === c.nombre && r.lote_nombre === l.nombre)
      capas[c.key][l.key] = fila?.capas ?? null
    }
  }

  return { tipoTela: telasSlot[0]?.tipo_tela ?? "", colores, lotes, capas }
}

function OpTelaSlotCard({
  ordenId,
  slot,
  iniciales,
  inicialesLotes,
  tallasCount,
  numLotesPreset,
  onMsg,
  onCapasChange,
  onGridChange,
  plantilla,
  plantillaKey,
  celda00Ref,
}: {
  ordenId: number
  slot: 1 | 2 | 3
  iniciales: OpTelaRow[]
  inicialesLotes: OpTelaLoteRow[]
  tallasCount: number
  numLotesPreset: number
  onMsg: (m: string) => void
  onCapasChange: (slot: 1 | 2 | 3, total: number) => void
  onGridChange?: (grid: SlotGrid) => void
  plantilla?: SlotGrid | null
  plantillaKey?: number
  celda00Ref?: number | null
}) {
  const router = useRouter()
  const [isPending, startSave] = useTransition()

  const inicial = React.useMemo(
    () => buildGridFromServer(iniciales, inicialesLotes, slot),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const [tipoTela, setTipoTela] = React.useState(inicial.tipoTela)
  const [colores,  setColores]  = React.useState<EntradaColor[]>(inicial.colores)
  const [lotes,    setLotes]    = React.useState<EntradaLote[]>(inicial.lotes)
  const [capas,    setCapas]    = React.useState<CapasGrid>(inicial.capas)

  // Pre-carga N lotes cuando el usuario hace clic en Calcular
  const lotesRef = React.useRef(lotes)
  React.useEffect(() => { lotesRef.current = lotes }, [lotes])

  React.useEffect(() => {
    if (!numLotesPreset || numLotesPreset <= 0) return
    const currentLotes = lotesRef.current
    if (currentLotes.length >= numLotesPreset) return

    const lote1Key = currentLotes[0]?.key ?? null
    const toAdd: EntradaLote[] = []
    for (let i = currentLotes.length; i < numLotesPreset; i++) {
      toAdd.push({ key: crypto.randomUUID(), nombre: `Lote ${i + 1}` })
    }
    setLotes((prev) => [...prev, ...toAdd])
    setCapas((prev) => {
      const next = { ...prev }
      for (const ck of Object.keys(next)) {
        next[ck] = { ...next[ck] }
        const lote1Val = lote1Key != null ? (next[ck][lote1Key] ?? null) : null
        for (const l of toAdd) next[ck][l.key] = lote1Val
      }
      return next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numLotesPreset])

  // Reporta el grid completo al padre (para que M1 pueda ser plantilla de M2/M3)
  const onGridChangeRef = React.useRef(onGridChange)
  React.useEffect(() => { onGridChangeRef.current = onGridChange })
  React.useEffect(() => {
    onGridChangeRef.current?.({ colores, lotes, capas })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colores, lotes, capas])

  // Aplica plantilla cuando plantillaKey cambia (el usuario habilita M2/M3)
  // prevPK arranca en -1; plantillaKey=0 significa "ya había datos de servidor → no aplicar"
  const prevPK = React.useRef(-1)
  React.useEffect(() => {
    if (!plantillaKey || !plantilla) return   // 0 o undefined → slot ya tenía datos, no tocar
    if (plantillaKey === prevPK.current) return
    prevPK.current = plantillaKey
    const newColores = plantilla.colores.map((c) => ({ key: crypto.randomUUID(), nombre: c.nombre }))
    const ckMap = new Map(plantilla.colores.map((c, i) => [c.key, newColores[i].key]))
    const newLotes = plantilla.lotes.map((l) => ({ key: crypto.randomUUID(), nombre: l.nombre }))
    const lkMap = new Map(plantilla.lotes.map((l, i) => [l.key, newLotes[i].key]))
    const newCapas: CapasGrid = {}
    for (const [oldCk, lCaps] of Object.entries(plantilla.capas)) {
      const newCk = ckMap.get(oldCk)
      if (!newCk) continue
      newCapas[newCk] = {}
      for (const [oldLk, val] of Object.entries(lCaps)) {
        const newLk = lkMap.get(oldLk)
        if (newLk !== undefined) newCapas[newCk][newLk] = val
      }
    }
    setColores(newColores)
    setLotes(newLotes)
    setCapas(newCapas)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantillaKey])

  // Resincroniza desde servidor tras router.refresh() — se salta el montaje inicial
  // porque en el mount ya se usó `inicial` (useMemo) o la plantilla de M1, y este
  // efecto correría después de esa, pisando los datos recién copiados con el grid
  // vacío del servidor (M2/M3 sin guardar aún no tienen filas en iniciales/inicialesLotes)
  const isFirstSync = React.useRef(true)
  React.useEffect(() => {
    if (isFirstSync.current) { isFirstSync.current = false; return }
    const s = buildGridFromServer(iniciales, inicialesLotes, slot)
    setTipoTela(s.tipoTela)
    setColores(s.colores)
    setLotes(s.lotes)
    setCapas(s.capas)
  }, [iniciales, inicialesLotes, slot])

  // Reporta el total local de capas al padre cada vez que cambia la grilla
  React.useEffect(() => {
    const total = colores.reduce(
      (s, c) => s + lotes.reduce((ls, l) => ls + (capas[c.key]?.[l.key] ?? 0), 0), 0
    )
    onCapasChange(slot, total)
  }, [colores, lotes, capas, slot, onCapasChange])

  function addColor() {
    const key = crypto.randomUUID()
    setColores((p) => [...p, { key, nombre: "" }])
    setCapas((p) => {
      const celda: Record<string, number | null> = {}
      for (const l of lotes) celda[l.key] = null
      return { ...p, [key]: celda }
    })
  }

  function removeColor(ck: string) {
    setColores((p) => p.filter((c) => c.key !== ck))
    setCapas((p) => { const next = { ...p }; delete next[ck]; return next })
  }

  function setColorNombre(ck: string, nombre: string) {
    setColores((p) => p.map((c) => c.key === ck ? { ...c, nombre } : c))
  }

  function addLote() {
    const key = crypto.randomUUID()
    const num = lotes.length + 1
    setLotes((p) => [...p, { key, nombre: `Lote ${num}` }])
    setCapas((p) => {
      const next = { ...p }
      for (const c of colores) next[c.key] = { ...next[c.key], [key]: null }
      return next
    })
  }

  function removeLote(lk: string) {
    setLotes((p) => p.filter((l) => l.key !== lk))
    setCapas((p) => {
      const next = { ...p }
      for (const ck of Object.keys(next)) { delete next[ck][lk] }
      return next
    })
  }

  function setLoteNombre(lk: string, nombre: string) {
    setLotes((p) => p.map((l) => l.key === lk ? { ...l, nombre } : l))
  }

  // Re-sincroniza las columnas de lotes desde Material 1 (solo M2/M3).
  // Conserva los colores propios; las capas se mantienen si el lote (por nombre)
  // ya existía, y los lotes nuevos heredan el valor del primer lote de cada fila.
  function recalcularLotesDesdePlantilla() {
    if (!plantilla || plantilla.lotes.length === 0) return
    const newLotes = plantilla.lotes.map((l) => ({ key: crypto.randomUUID(), nombre: l.nombre }))
    const oldLotes = lotes
    setCapas((prev) => {
      const next: CapasGrid = {}
      const firstOldKey = oldLotes[0]?.key
      for (const c of colores) {
        next[c.key] = {}
        for (const nl of newLotes) {
          const match = oldLotes.find((ol) => ol.nombre.trim() === nl.nombre.trim())
          next[c.key][nl.key] = match
            ? (prev[c.key]?.[match.key] ?? null)
            : (firstOldKey ? prev[c.key]?.[firstOldKey] ?? null : null)
        }
      }
      return next
    })
    setLotes(newLotes)
    onMsg(`Lotes de Material ${slot} recalculados desde Material 1 (${newLotes.length} lotes)`)
  }

  function setCelda(ck: string, lk: string, val: number | null) {
    const isFirstLote = lotes.length > 0 && lk === lotes[0].key
    setCapas((p) => {
      const colorRow = { ...p[ck], [lk]: val }
      if (isFirstLote) {
        for (let i = 1; i < lotes.length; i++) colorRow[lotes[i].key] = val
      }
      return { ...p, [ck]: colorRow }
    })
  }

  function guardar() {
    const coloresFiltrados = colores.filter((c) => c.nombre.trim())
    const lotesFiltrados   = lotes.filter((l) => l.nombre.trim())

    // Filtro de seguridad: [Color 1 × Lote 1] debe coincidir con Material 1
    if (celda00Ref !== undefined && celda00Ref !== null &&
        coloresFiltrados.length > 0 && lotesFiltrados.length > 0) {
      const miCelda00 = capas[coloresFiltrados[0].key]?.[lotesFiltrados[0].key] ?? 0
      if (miCelda00 !== celda00Ref) {
        onMsg(
          `Error: [${coloresFiltrados[0].nombre} × ${lotesFiltrados[0].nombre}] ` +
          `debe tener ${celda00Ref} capas (igual a Material 1)`
        )
        return
      }
    }

    const grid = lotesFiltrados.map((l) => ({
      lote_nombre: l.nombre,
      capas_por_color: coloresFiltrados.map((c) => capas[c.key]?.[l.key] ?? 0),
    }))

    startSave(async () => {
      const res = await guardarSlotAction(
        ordenId, slot,
        tipoTela || null,
        coloresFiltrados.map((c) => c.nombre),
        grid,
        tallasCount
      )
      if (res.error) onMsg(`Error: ${res.error}`)
      else { onMsg(`Material ${slot} guardado`); router.refresh() }
    })
  }

  const inputCls = "rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#344966]"

  const totalCapasSlot = colores.reduce((s, c) =>
    s + lotes.reduce((ls, l) => ls + (capas[c.key]?.[l.key] ?? 0), 0), 0
  )

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Material {slot}</p>
        {plantilla && plantilla.lotes.length > 0 && (
          <button
            type="button"
            onClick={recalcularLotesDesdePlantilla}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium border border-stone-300 text-stone-500 hover:bg-stone-100 transition-colors"
            title="Vuelve a tomar los lotes de Material 1 (agregados o eliminados), conservando colores y capas de los lotes existentes"
          >
            <RefreshCw className="h-3 w-3" />
            Recalcular lotes
          </button>
        )}
      </div>
      <input
        type="text"
        value={tipoTela}
        onChange={(e) => setTipoTela(e.target.value)}
        placeholder="Tipo de tela (ej: Algodón)"
        className={`w-full ${inputCls}`}
      />

      {/* Grilla colores × lotes */}
      {(colores.length > 0 || lotes.length > 0) && (
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr>
                <th className="text-left px-1 py-1 text-stone-400 font-normal w-28">Color</th>
                {lotes.map((l) => (
                  <th key={l.key} className="px-1 py-1 min-w-[90px]">
                    <div className="flex items-center justify-center gap-0.5">
                      <input
                        type="text"
                        value={l.nombre}
                        onChange={(e) => setLoteNombre(l.key, e.target.value)}
                        className={`w-16 text-center font-semibold text-stone-700 ${inputCls}`}
                        placeholder="Lote"
                      />
                      <button
                        type="button"
                        onClick={() => removeLote(l.key)}
                        className="p-0.5 rounded hover:bg-red-50 text-stone-300 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </th>
                ))}
                <th className="px-1 py-1">
                  <button
                    type="button"
                    onClick={addLote}
                    className="flex items-center gap-0.5 rounded-lg px-2 py-1 text-xs font-medium border border-dashed border-stone-300 text-stone-500 hover:bg-stone-100 transition-colors whitespace-nowrap"
                  >
                    <Plus className="h-3 w-3" />
                    Lote
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {colores.map((c) => (
                <tr key={c.key} className="border-t border-stone-100">
                  <td className="px-1 py-1">
                    <div className="flex items-center gap-0.5">
                      <input
                        type="text"
                        value={c.nombre}
                        onChange={(e) => setColorNombre(c.key, e.target.value)}
                        placeholder="Color"
                        className={`w-24 ${inputCls}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeColor(c.key)}
                        className="p-0.5 rounded hover:bg-red-50 text-stone-300 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                  {lotes.map((l) => (
                    <td key={l.key} className="px-1 py-1 text-center">
                      <input
                        type="number"
                        min="0"
                        value={capas[c.key]?.[l.key] ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value
                          setCelda(c.key, l.key, raw === "" ? null : parseInt(raw, 10) || 0)
                        }}
                        className={`w-16 text-center ${inputCls}`}
                      />
                    </td>
                  ))}
                  <td />
                </tr>
              ))}
            </tbody>
            {lotes.length > 0 && colores.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-stone-300 bg-stone-50">
                  <td className="px-1 py-1.5 text-xs font-semibold text-stone-500 whitespace-nowrap">
                    Total ud.
                  </td>
                  {lotes.map((l) => {
                    const capasLote = colores.reduce(
                      (s, c) => s + (capas[c.key]?.[l.key] ?? 0), 0
                    )
                    const unidades = capasLote * tallasCount
                    return (
                      <td key={l.key} className="px-1 py-1.5 text-center">
                        {capasLote > 0 ? (
                          <>
                            <div className="text-xs font-bold" style={{ color: "#344966" }}>
                              {tallasCount > 0
                                ? unidades.toLocaleString("es-CO")
                                : `${capasLote} cap.`}
                            </div>
                            <div className="text-[10px] text-stone-400 leading-none mt-0.5">
                              {tallasCount > 0
                                ? `${capasLote}c × ${tallasCount}t`
                                : "sin tallas"}
                            </div>
                          </>
                        ) : (
                          <span className="text-stone-300 text-xs">—</span>
                        )}
                      </td>
                    )
                  })}
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={addColor}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium border border-dashed border-stone-300 text-stone-500 hover:bg-stone-100 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Color
        </button>
        <div className="flex items-center gap-2">
          {totalCapasSlot > 0 && (
            <span className="text-xs text-stone-400">{totalCapasSlot} capas</span>
          )}
          <button
            onClick={guardar}
            disabled={isPending}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "#344966" }}
          >
            <Save className="h-3 w-3" />
            {isPending ? "Guardando…" : `Guardar M${slot}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Impresión de la OP (formato de corte) ──────────────────────────────────

function generarImpresionOP(
  orden: OrdenProduccionRow,
  tallas: string[],
  opTelas: OpTelaRow[],
  opTelaLotes: OpTelaLoteRow[]
) {
  const esc = (s: string | null | undefined) =>
    (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  const slots = ([1, 2, 3] as const).filter((s) =>
    opTelaLotes.some((r) => r.slot === s)
  )

  let totalCapasOP = 0
  let totalUnidadesOP = 0

  const secciones = slots.map((slot) => {
    const telas = opTelas.filter((t) => t.slot === slot)
    const filas = opTelaLotes.filter((r) => r.slot === slot)
    const colores = [...new Set(telas.map((t) => t.color ?? "").filter(Boolean))]
    // Colores que solo existen en op_tela_lote (por si acaso)
    for (const f of filas) if (!colores.includes(f.color)) colores.push(f.color)
    const lotes = [...new Set(filas.map((r) => r.lote_nombre))].sort((a, b) =>
      a.localeCompare(b, "es", { numeric: true })
    )
    const capa = (color: string, lote: string) =>
      filas.find((r) => r.color === color && r.lote_nombre === lote)?.capas ?? 0

    const capasPorLote = lotes.map((l) => colores.reduce((s, c) => s + capa(c, l), 0))
    const capasMaterial = capasPorLote.reduce((s, v) => s + v, 0)
    const unidadesMaterial = capasMaterial * tallas.length
    totalCapasOP += capasMaterial
    totalUnidadesOP += unidadesMaterial

    const tipoTela = telas[0]?.tipo_tela ?? ""

    const filasHtml = colores
      .map((c) => {
        const totalColor = lotes.reduce((s, l) => s + capa(c, l), 0)
        const celdas = lotes
          .map((l) => `<td class="num">${capa(c, l) || ""}</td>`)
          .join("")
        return `<tr><td class="color">${esc(c)}</td>${celdas}<td class="num total-col">${totalColor}</td></tr>`
      })
      .join("")

    const capasHtml = capasPorLote.map((v) => `<td class="num">${v}</td>`).join("")
    const unidadesHtml = capasPorLote
      .map((v) => `<td class="num">${(v * tallas.length).toLocaleString("es-CO")}</td>`)
      .join("")

    return `
      <h2>Material ${slot}${tipoTela ? ` — ${esc(tipoTela)}` : ""}</h2>
      <table>
        <thead>
          <tr>
            <th class="color">Color</th>
            ${lotes.map((l) => `<th>${esc(l)}</th>`).join("")}
            <th class="total-col">Total capas</th>
          </tr>
        </thead>
        <tbody>${filasHtml}</tbody>
        <tfoot>
          <tr class="capas">
            <td class="color">Capas</td>${capasHtml}<td class="num total-col">${capasMaterial}</td>
          </tr>
          <tr class="unidades">
            <td class="color">Unidades (× ${tallas.length} tallas)</td>${unidadesHtml}<td class="num total-col">${unidadesMaterial.toLocaleString("es-CO")}</td>
          </tr>
        </tfoot>
      </table>`
  })

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${padOP(orden.numero_op)} — ${esc(orden.referencia)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; padding: 24px; }
  .encabezado { border: 2px solid #111; margin-bottom: 14px; }
  .encabezado .titulo { background: #f2e14c; font-weight: bold; font-size: 14px; padding: 6px 10px; display: flex; justify-content: space-between; border-bottom: 2px solid #111; }
  .encabezado table { width: 100%; border-collapse: collapse; }
  .encabezado td { border: 1px solid #111; padding: 5px 8px; }
  .encabezado td.label { font-weight: bold; background: #eee; width: 160px; text-transform: uppercase; }
  .tallas-box { border: 2px solid #111; padding: 6px 10px; margin-bottom: 14px; display: flex; gap: 16px; align-items: center; }
  .tallas-box .label { font-weight: bold; text-transform: uppercase; }
  h2 { font-size: 12px; margin: 14px 0 5px; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th, td { border: 1px solid #111; padding: 4px 6px; }
  th { background: #eee; text-transform: uppercase; font-size: 10px; }
  td.color, th.color { text-align: left; font-weight: bold; width: 140px; }
  td.num { text-align: center; }
  .total-col { background: #dcefe4; font-weight: bold; }
  tr.capas td { background: #dcefe4; font-weight: bold; }
  tr.unidades td { font-weight: bold; }
  .gran-total { border: 2px solid #111; margin-top: 14px; padding: 8px 10px; display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; background: #dcefe4; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="encabezado">
    <div class="titulo"><span>ORDEN DE PRODUCCIÓN</span><span>${padOP(orden.numero_op)}</span></div>
    <table>
      <tr><td class="label">Referencia</td><td>${esc(orden.referencia)}</td></tr>
      <tr><td class="label">Fecha programación</td><td>${esc(orden.fecha_programacion) || "—"}</td></tr>
      <tr><td class="label">Descripción</td><td>${esc(orden.descripcion) || "—"}</td></tr>
    </table>
  </div>

  <div class="tallas-box">
    <span class="label">Tallas</span>
    <span>${tallas.map(esc).join(" / ") || "—"}</span>
    <span class="label" style="margin-left:auto">Total: ${tallas.length}</span>
  </div>

  ${secciones.join("")}

  <div class="gran-total">
    <span>TOTAL CAPAS: ${totalCapasOP.toLocaleString("es-CO")}</span>
    <span>TOTAL UNIDADES: ${totalUnidadesOP.toLocaleString("es-CO")}</span>
  </div>
</body>
</html>`

  const w = window.open("", "_blank")
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 300)
}

const TALLAS_PREDEFINIDAS = ["4", "6", "8", "10", "12", "14", "16", "S", "M", "L", "XL", "XXL"]

function CurvaTallasSection({
  ordenId,
  orden,
  inicial,
  opTelas,
  opTelaLotes,
  onSaved,
}: {
  ordenId: number
  orden: OrdenProduccionRow
  inicial: CurvaTallaRow[]
  opTelas: OpTelaRow[]
  opTelaLotes: OpTelaLoteRow[]
  onSaved: (msg: string) => void
}) {
  const router = useRouter()
  const [tallas, setTallas] = React.useState<string[]>(() => inicial.map((r) => r.talla))
  const [nuevaTalla, setNuevaTalla] = React.useState("")
  const [isPending, startSave] = useTransition()
  const [cantidadLotesInput, setCantidadLotesInput] = React.useState("")
  const [presetAplicado, setPresetAplicado] = React.useState(0)

  // Grid de M1 en tiempo real (para replicar a M2/M3)
  const [slot1Grid, setSlot1Grid] = React.useState<SlotGrid>(() => {
    const g = buildGridFromServer(opTelas, opTelaLotes, 1)
    return { colores: g.colores, lotes: g.lotes, capas: g.capas }
  })
  const handleSlot1GridChange = React.useCallback((grid: SlotGrid) => {
    setSlot1Grid(grid)
  }, [])
  const slot1Celda00 = slot1Grid.capas[slot1Grid.colores[0]?.key ?? ""]?.[slot1Grid.lotes[0]?.key ?? ""] ?? null

  // Habilitación de M2/M3
  const [habilitado2, setHabilitado2] = React.useState(
    () => opTelas.some((t) => t.slot === 2) || opTelaLotes.some((r) => r.slot === 2)
  )
  const [habilitado3, setHabilitado3] = React.useState(
    () => opTelas.some((t) => t.slot === 3) || opTelaLotes.some((r) => r.slot === 3)
  )
  const [plantillaKey2, setPlantillaKey2] = React.useState(0)
  const [plantillaKey3, setPlantillaKey3] = React.useState(0)

  const [slotCapas, setSlotCapas] = React.useState<Record<number, number>>(() => ({
    1: opTelaLotes.filter((r) => r.slot === 1).reduce((s, r) => s + r.capas, 0),
    2: opTelaLotes.filter((r) => r.slot === 2).reduce((s, r) => s + r.capas, 0),
    3: opTelaLotes.filter((r) => r.slot === 3).reduce((s, r) => s + r.capas, 0),
  }))

  React.useEffect(() => {
    setTallas(inicial.map((r) => r.talla))
  }, [inicial])

  const handleCapasChange = React.useCallback((slot: 1 | 2 | 3, total: number) => {
    setSlotCapas((p) => ({ ...p, [slot]: total }))
  }, [])

  function addTalla(talla: string) {
    const t = talla.trim().toUpperCase()
    if (!t) return
    setTallas((p) => [...p, t])
    setNuevaTalla("")
  }

  function removeTallaAt(idx: number) {
    setTallas((p) => p.filter((_, i) => i !== idx))
  }

  function guardarCurva() {
    startSave(async () => {
      const res = await guardarCurvaAction(ordenId, tallas)
      if (res.error) { onSaved(`Error al guardar tallas: ${res.error}`); return }
      onSaved("Tallas guardadas")
      router.refresh()
    })
  }

  const totalCapas = Object.values(slotCapas).reduce((s, v) => s + v, 0)
  const totalUnidades = totalCapas * tallas.length

  return (
    <div className="space-y-5">
      {/* Sección: Materiales de tela */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <hr className="flex-1 border-stone-200" />
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide shrink-0">Materiales de tela</span>
          <hr className="flex-1 border-stone-200" />
        </div>

        {/* Cantidad de lotes */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-stone-600 whitespace-nowrap">Cantidad de lotes:</label>
          <input
            type="number"
            min="1"
            max="50"
            value={cantidadLotesInput}
            onChange={(e) => setCantidadLotesInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const v = parseInt(cantidadLotesInput, 10)
                if (v > 0) setPresetAplicado(v)
              }
            }}
            className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#344966] w-16 text-center"
            placeholder="N"
          />
          <button
            type="button"
            onClick={() => {
              const v = parseInt(cantidadLotesInput, 10)
              if (v > 0) setPresetAplicado(v)
            }}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold border border-[#344966] text-[#344966] hover:bg-[#344966] hover:text-white transition-colors"
          >
            Calcular
          </button>
          <span className="text-xs text-stone-400">Pre-carga N lotes en cada material replicando Lote 1</span>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {/* Material 1 — siempre activo, reporta su grid al padre */}
          <OpTelaSlotCard
            key={1}
            ordenId={ordenId}
            slot={1}
            iniciales={opTelas}
            inicialesLotes={opTelaLotes}
            tallasCount={tallas.length}
            numLotesPreset={presetAplicado}
            onMsg={onSaved}
            onCapasChange={handleCapasChange}
            onGridChange={handleSlot1GridChange}
          />

          {/* Material 2 */}
          {habilitado2 ? (
            <OpTelaSlotCard
              key={2}
              ordenId={ordenId}
              slot={2}
              iniciales={opTelas}
              inicialesLotes={opTelaLotes}
              tallasCount={tallas.length}
              numLotesPreset={presetAplicado}
              plantilla={slot1Grid}
              plantillaKey={plantillaKey2}
              celda00Ref={slot1Celda00}
              onMsg={onSaved}
              onCapasChange={handleCapasChange}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-3 flex items-center justify-between">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Material 2</p>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={(e) => {
                    if (!e.target.checked) return
                    setHabilitado2(true)
                    if (slot1Grid.lotes.length > 0) setPlantillaKey2((k) => k + 1)
                  }}
                  className="h-3.5 w-3.5 rounded border-stone-300 accent-[#344966]"
                />
                <span className="text-xs text-stone-500">
                  {slot1Grid.lotes.length > 0 ? "Habilitar y replicar Material 1" : "Habilitar"}
                </span>
              </label>
            </div>
          )}

          {/* Material 3 */}
          {habilitado3 ? (
            <OpTelaSlotCard
              key={3}
              ordenId={ordenId}
              slot={3}
              iniciales={opTelas}
              inicialesLotes={opTelaLotes}
              tallasCount={tallas.length}
              numLotesPreset={presetAplicado}
              plantilla={slot1Grid}
              plantillaKey={plantillaKey3}
              celda00Ref={slot1Celda00}
              onMsg={onSaved}
              onCapasChange={handleCapasChange}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-3 flex items-center justify-between">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Material 3</p>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={(e) => {
                    if (!e.target.checked) return
                    setHabilitado3(true)
                    if (slot1Grid.lotes.length > 0) setPlantillaKey3((k) => k + 1)
                  }}
                  className="h-3.5 w-3.5 rounded border-stone-300 accent-[#344966]"
                />
                <span className="text-xs text-stone-500">
                  {slot1Grid.lotes.length > 0 ? "Habilitar y replicar Material 1" : "Habilitar"}
                </span>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Sección: Tallas */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <hr className="flex-1 border-stone-200" />
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide shrink-0">Tallas</span>
          <hr className="flex-1 border-stone-200" />
        </div>

        {/* Botones rápidos */}
        <div className="flex flex-wrap gap-1.5">
          {TALLAS_PREDEFINIDAS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => addTalla(t)}
              className="rounded-lg border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-600 hover:bg-[#344966] hover:text-white hover:border-[#344966] transition-colors"
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tallas seleccionadas */}
        {tallas.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tallas.map((t, idx) => (
              <span key={idx} className="inline-flex items-center gap-1 rounded-full bg-[#344966] px-3 py-1 text-xs font-semibold text-white">
                {t}
                <button
                  type="button"
                  onClick={() => removeTallaAt(idx)}
                  className="ml-0.5 rounded-full hover:bg-white/20 p-0.5 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Input personalizado */}
        <div className="flex gap-2">
          <input
            type="text"
            value={nuevaTalla}
            onChange={(e) => setNuevaTalla(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTalla(nuevaTalla) } }}
            className="rounded-xl border border-stone-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#344966] w-36"
            placeholder="Talla personalizada…"
          />
          <button
            type="button"
            onClick={() => addTalla(nuevaTalla)}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium border border-stone-200 hover:bg-stone-50 transition-colors text-stone-600"
          >
            <Plus className="h-3 w-3" /> Agregar
          </button>
        </div>
      </div>

      {/* Resumen total */}
      <div className="rounded-xl bg-stone-50 border border-stone-200 px-4 py-3 flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-xs text-stone-500">
            Número de lotes totales:{" "}
            <span className="font-semibold text-stone-800">{slot1Grid.lotes.length}</span>
          </p>
          <span className="text-sm text-stone-600">
            <span className="font-semibold text-stone-800">{tallas.length}</span> tallas
            {" × "}
            <span className="font-semibold text-stone-800">{totalCapas}</span> capas
            {" = "}
            <span className="text-lg font-bold" style={{ color: "#344966" }}>
              {totalUnidades.toLocaleString("es-CO")} unidades
            </span>
          </span>
          {totalCapas === 0 && (
            <p className="text-xs text-amber-600">Agrega materiales de tela con sus capas para calcular el total.</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => generarImpresionOP(orden, tallas, opTelas, opTelaLotes)}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border border-[#344966] text-[#344966] hover:bg-[#344966] hover:text-white transition-colors"
            title="Genera la impresión con los datos guardados. Guarda los materiales antes de imprimir."
          >
            <Printer className="h-4 w-4" />
            Generar PDF
          </button>
          <button
            onClick={guardarCurva}
            disabled={isPending}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "#344966" }}
          >
            <Save className="h-4 w-4" />
            {isPending ? "Guardando…" : "Guardar tallas"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Lotes ───────────────────────────────────────────────────────────────

const LOTE_LINKS: Record<string, (id: number) => string> = {
  estampacion: (id) => `/estampacion/${id}`,
  confeccion: (id) => `/confeccion/${id}`,
  conteo: (id) => `/conteo/${id}`,
  empaque: (id) => `/empaque/${id}`,
}

function LotesSection({
  ordenId,
  orden,
  inicial,
  tallas,
  opTelaLotes,
  onMsg,
}: {
  ordenId: number
  orden: OrdenProduccionRow
  inicial: LoteRow[]
  tallas: number
  opTelaLotes: OpTelaLoteRow[]
  onMsg: (m: string) => void
}) {
  const router = useRouter()
  const [lotes, setLotes] = React.useState<LoteRow[]>(inicial)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [deleteId, setDeleteId] = React.useState<number | null>(null)
  const [cantidad, setCantidad] = React.useState("")
  const [descripcion, setDescripcion] = React.useState("")
  const [isPending, startTransition] = useTransition()

  const totalCapas = opTelaLotes.reduce((s, r) => s + r.capas, 0) || orden.capas
  const totalUnidades = totalCapas * tallas
  const totalLotificado = lotes.reduce((s, l) => s + l.cantidad_programada, 0)
  const pct = totalUnidades > 0 ? Math.min(100, Math.round((totalLotificado / totalUnidades) * 100)) : 0

  function handleCreate() {
    const n = parseInt(cantidad, 10)
    if (!n || n <= 0) return
    startTransition(async () => {
      const res = await crearLoteAction({
        orden_id: ordenId,
        cantidad_programada: n,
        descripcion: descripcion.trim() || undefined,
      })
      if (res.error) onMsg(`Error: ${res.error}`)
      else {
        setCreateOpen(false)
        setCantidad("")
        setDescripcion("")
        onMsg("Lote creado")
        router.refresh()
      }
    })
  }

  function handleDelete() {
    if (!deleteId) return
    startTransition(async () => {
      const res = await eliminarLoteAction(deleteId, ordenId)
      setDeleteId(null)
      if (res.error) onMsg(`Error: ${res.error}`)
      else { onMsg("Lote eliminado"); router.refresh() }
    })
  }

  React.useEffect(() => { setLotes(inicial) }, [inicial])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-700">Lotes de producción</h3>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium border border-stone-200 hover:bg-stone-50 transition-colors text-stone-600"
        >
          <Plus className="h-3 w-3" /> Nuevo lote
        </button>
      </div>

      {/* Progreso vs total */}
      <div className="rounded-xl bg-stone-50 border border-stone-200 p-3 space-y-2">
        <div className="flex items-center justify-between text-xs text-stone-600">
          <span>Unidades lotificadas vs total ({totalUnidades.toLocaleString("es-CO")} ud.)</span>
          <span className="font-semibold">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-stone-200 overflow-hidden">
          <div className="h-full rounded-full bg-[#344966] transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-stone-400">
          {totalLotificado.toLocaleString("es-CO")} / {totalUnidades.toLocaleString("es-CO")} asignadas en {lotes.length} lote{lotes.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Lista de lotes */}
      {lotes.length === 0 ? (
        <p className="text-xs text-stone-400 py-6 text-center">Sin lotes creados.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50">
                {["Lote", "Descripción", "Cantidad", "Estado", ""].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-semibold text-stone-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lotes.map((lote) => {
                const link = LOTE_LINKS[lote.estado]?.(lote.id)
                return (
                  <tr key={lote.id} className="border-b border-stone-100 last:border-0">
                    <td className="px-3 py-2 font-mono font-semibold text-stone-700">
                      LOTE-{String(lote.numero_lote).padStart(4, "0")}
                    </td>
                    <td className="px-3 py-2 text-stone-500 max-w-[180px] truncate">
                      {lote.descripcion ?? <span className="text-stone-300">—</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-stone-700">
                      {lote.cantidad_programada.toLocaleString("es-CO")} ud.
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${LOTE_ESTADO_COLOR[lote.estado] ?? "bg-stone-100 text-stone-600"}`}>
                        {LOTE_ESTADO_LABEL[lote.estado] ?? lote.estado}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {link && (
                          <a
                            href={link}
                            className="p-1 rounded hover:bg-stone-100 text-stone-400 hover:text-stone-600"
                            title="Ver ficha"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {lote.estado === "cortado" && (
                          <button
                            onClick={() => setDeleteId(lote.id)}
                            className="p-1 rounded hover:bg-red-50 text-stone-400 hover:text-red-500"
                            title="Eliminar lote"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog crear lote */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo lote</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">Cantidad programada *</label>
              <input
                type="number"
                min="1"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className={fieldCls}
                placeholder="Ej: 50"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">Descripción (opcional)</label>
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className={fieldCls}
                placeholder="Ej: Talla S, Color azul..."
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={isPending || !cantidad || parseInt(cantidad) <= 0}
              className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "#344966" }}
            >
              {isPending ? "Creando…" : "Crear lote"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar lote?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Tab 3: Materiales ────────────────────────────────────────────────────────

type FilaMaterialState = { consumo: string; valor: string }

const esUnidad = (u: string) => u.trim().toLowerCase() === "unidad"

function MaterialesOPSection({
  ordenId,
  inicial,
  maestro,
  totalUnidades,
  tieneVerCostos,
  hojaCostos,
  onMsg,
}: {
  ordenId: number
  inicial: OpMaterialRow[]
  maestro: MaterialRow[]
  totalUnidades: number
  tieneVerCostos: boolean
  hojaCostos: HojaCostosRow | null
  onMsg: (m: string) => void
}) {
  const router = useRouter()
  const [deleteId, setDeleteId] = React.useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  // Filas manuales heredadas (sin vínculo al maestro)
  const manualRows = React.useMemo(
    () => inicial.filter((r) => r.material_id == null),
    [inicial]
  )

  // Estado editable por fila: clave `m{material_id}` (maestro) o `op{id}` (manual)
  const buildFilas = React.useCallback(() => {
    const init: Record<string, FilaMaterialState> = {}
    for (const m of maestro) {
      const saved = inicial.find((r) => r.material_id === m.id)
      init[`m${m.id}`] = {
        consumo:
          saved?.consumo_estimado != null
            ? String(saved.consumo_estimado)
            : esUnidad(m.unidad_medida) ? "1" : "",
        valor: saved != null ? String(saved.valor_unitario) : String(m.valor_unitario ?? 0),
      }
    }
    for (const r of inicial.filter((r) => r.material_id == null)) {
      init[`op${r.id}`] = {
        consumo: r.consumo_estimado != null ? String(r.consumo_estimado) : "",
        valor: String(r.valor_unitario),
      }
    }
    return init
  }, [maestro, inicial])

  const [filas, setFilas] = React.useState<Record<string, FilaMaterialState>>(buildFilas)
  React.useEffect(() => { setFilas(buildFilas()) }, [buildFilas])

  function setFila(key: string, campo: keyof FilaMaterialState, val: string) {
    setFilas((p) => ({ ...p, [key]: { ...p[key], [campo]: val } }))
  }

  // ── Otros insumos de valor fijo (solo visible con ver_costos) ──────────────
  const [insumosValores, setInsumosValores] = React.useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const f of VALORES_FIJOS.filter((f) => INSUMOS_KEYS.has(f.key as string))) {
      const rawVal = hojaCostos?.[f.key]
      init[f.key as string] = rawVal != null ? String(rawVal) : "0"
    }
    return init
  })
  const [isPendingInsumos, startInsumos] = useTransition()

  function handleSaveInsumos() {
    const fd = new FormData()
    // Envía los 15 campos: 5 insumos desde estado local + 10 operacionales desde el último guardado
    for (const f of VALORES_FIJOS) {
      const k = f.key as string
      if (INSUMOS_KEYS.has(k)) {
        fd.set(k, insumosValores[k] || "0")
      } else {
        const savedVal = hojaCostos?.[f.key]
        fd.set(k, savedVal != null ? String(savedVal) : "0")
      }
    }
    startInsumos(async () => {
      const res = await guardarHojaCostosAction(ordenId, fd)
      if (res.error) onMsg(`Error: ${res.error}`)
      else { onMsg("Insumos guardados"); router.refresh() }
    })
  }

  async function handleDelete() {
    if (!deleteId) return
    const res = await deleteOpMaterialAction(deleteId, ordenId)
    setDeleteId(null)
    if (res.error) onMsg(`Error: ${res.error}`)
    else { onMsg("Material eliminado"); router.refresh() }
  }

  const num = (s: string | undefined) => parseFloat(s ?? "") || 0

  // Totales en tiempo real
  const costoPorPrenda =
    maestro.reduce((s, m) => {
      const f = filas[`m${m.id}`]
      return s + num(f?.consumo) * num(f?.valor)
    }, 0) +
    manualRows.reduce((s, r) => {
      const f = filas[`op${r.id}`]
      return s + num(f?.consumo) * num(f?.valor)
    }, 0)
  const valorTotalMateriales = costoPorPrenda * totalUnidades

  function handleGuardarTodos() {
    const payload: OpMaterialBatchFila[] = []
    for (const m of maestro) {
      const f = filas[`m${m.id}`]
      if (!f) continue
      const consumo = num(f.consumo)
      if (consumo <= 0) continue
      payload.push({
        material_id: m.id,
        tipo: m.tipo,
        nombre: m.nombre,
        unidad_medida: m.unidad_medida,
        valor_unitario: num(f.valor),
        consumo_estimado: consumo,
      })
    }
    for (const r of manualRows) {
      const f = filas[`op${r.id}`]
      if (!f) continue
      payload.push({
        op_id: r.id,
        material_id: null,
        tipo: r.tipo,
        nombre: r.nombre,
        unidad_medida: r.unidad_medida,
        valor_unitario: num(f.valor),
        consumo_estimado: f.consumo ? num(f.consumo) : null,
      })
    }
    startTransition(async () => {
      const res = await guardarMaterialesOPAction(ordenId, payload)
      if (res.error) onMsg(`Error: ${res.error}`)
      else { onMsg("Materiales guardados"); router.refresh() }
    })
  }

  const inputMatCls =
    "rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-[#344966] text-right font-mono"

  function renderFilaMaterial(
    key: string,
    tipo: string,
    nombre: string,
    unidad: string,
    esManual: boolean,
    opId?: number
  ) {
    const f = filas[key] ?? { consumo: "", valor: "" }
    const consumoN = num(f.consumo)
    const valorN = num(f.valor)
    const totalMaterial = consumoN * totalUnidades
    const valorTotal = totalMaterial * valorN
    return (
      <tr key={key} className="border-b border-stone-100 last:border-0">
        <td className="px-3 py-1.5">
          <span className="rounded-full px-2 py-0.5 bg-stone-100 text-stone-600 text-xs">
            {tipo}{esManual ? " ✎" : ""}
          </span>
        </td>
        <td className="px-3 py-1.5 font-medium text-stone-800">{nombre}</td>
        <td className="px-3 py-1.5 text-stone-500">{unidad}</td>
        <td className="px-3 py-1.5">
          <input
            type="number"
            min="0"
            step="0.0001"
            value={f.consumo}
            onChange={(e) => setFila(key, "consumo", e.target.value)}
            className={`w-20 ${inputMatCls}`}
            placeholder="—"
          />
        </td>
        <td className="px-3 py-1.5 text-right font-mono text-stone-700">
          {consumoN > 0 && totalUnidades > 0
            ? `${totalMaterial.toLocaleString("es-CO", { maximumFractionDigits: 2 })} ${unidad}`
            : "—"}
        </td>
        <td className="px-3 py-1.5">
          <input
            type="number"
            min="0"
            step="0.01"
            value={f.valor}
            onChange={(e) => setFila(key, "valor", e.target.value)}
            className={`w-24 ${inputMatCls}`}
            placeholder="0"
          />
        </td>
        <td className="px-3 py-1.5 text-right font-mono font-semibold text-stone-800">
          {valorTotal > 0 ? cop(valorTotal) : "—"}
        </td>
        <td className="px-3 py-1.5">
          {esManual && opId != null && (
            <button
              onClick={() => setDeleteId(opId)}
              className="p-1 rounded hover:bg-red-50 text-stone-400 hover:text-red-500"
              title="Eliminar material manual"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-700">Materiales e insumos</h3>
        <span className="text-xs text-stone-500">
          Total prendas (curva):{" "}
          <strong className="text-stone-800">{totalUnidades.toLocaleString("es-CO")}</strong>
        </span>
      </div>

      {totalUnidades === 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          La curva no tiene capas/tallas guardadas: el total de material no se puede calcular aún.
        </div>
      )}

      {maestro.length === 0 && manualRows.length === 0 ? (
        <p className="text-xs text-stone-400 py-6 text-center">
          No hay materiales registrados en el módulo de Materiales.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50">
                {["Tipo", "Material", "Unidad", "Consumo / prenda", "Total material", "Valor unitario", "Valor total", ""].map(
                  (h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-stone-500 whitespace-nowrap">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {maestro.map((m) =>
                renderFilaMaterial(`m${m.id}`, m.tipo, m.nombre, m.unidad_medida, false)
              )}
              {manualRows.map((r) =>
                renderFilaMaterial(`op${r.id}`, r.tipo, r.nombre, r.unidad_medida, true, r.id)
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-stone-200 bg-stone-50">
                <td colSpan={4} className="px-3 py-2 text-xs font-semibold text-stone-600">
                  Costo materiales / prenda
                </td>
                <td className="px-3 py-2 text-right font-mono font-semibold text-stone-800">
                  {cop(costoPorPrenda)}
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-stone-600 text-right">
                  Valor total materiales
                </td>
                <td className="px-3 py-2 text-right font-mono font-bold text-stone-900">
                  {cop(valorTotalMateriales)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <button
        onClick={handleGuardarTodos}
        disabled={isPending}
        className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        style={{ backgroundColor: "#344966" }}
      >
        <Save className="h-3.5 w-3.5" />
        {isPending ? "Guardando…" : "Guardar materiales"}
      </button>

      {/* Subsección: Otros insumos de valor fijo */}
      {tieneVerCostos && (
        <div className="pt-1 space-y-3">
          <div className="flex items-center gap-3">
            <hr className="flex-1 border-stone-200" />
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide shrink-0">
              Otros insumos (valor fijo por prenda)
            </span>
            <hr className="flex-1 border-stone-200" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {VALORES_FIJOS.filter((f) => INSUMOS_KEYS.has(f.key as string)).map((f) => (
              <div key={f.key as string} className="space-y-1">
                <label className="text-xs font-medium text-stone-600">{f.label}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={insumosValores[f.key as string]}
                  onChange={(e) =>
                    setInsumosValores((p) => ({ ...p, [f.key as string]: e.target.value }))
                  }
                  className={fieldCls}
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleSaveInsumos}
            disabled={isPendingInsumos}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "#344966" }}
          >
            <Save className="h-3.5 w-3.5" />
            {isPendingInsumos ? "Guardando…" : "Guardar insumos"}
          </button>
        </div>
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar material?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Tab 4: Hoja de Costos ────────────────────────────────────────────────────

function HojaCostosSection({
  ordenId,
  hojaCostos,
  onMsg,
}: {
  ordenId: number
  hojaCostos: HojaCostosRow | null
  onMsg: (m: string) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Solo los 10 campos operacionales/logísticos (los 5 de insumos están en la pestaña Materiales)
  const operacionalesFijos = VALORES_FIJOS.filter((f) => !INSUMOS_KEYS.has(f.key as string))

  const [valores, setValores] = React.useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const f of operacionalesFijos) {
      const rawVal = hojaCostos?.[f.key]
      init[f.key as string] = rawVal != null ? String(rawVal) : "0"
    }
    return init
  })
  const [precioVenta, setPrecioVenta] = React.useState(
    hojaCostos?.precio_venta != null ? String(hojaCostos.precio_venta) : ""
  )
  const [porcIva, setPorcIva] = React.useState(
    hojaCostos?.porc_iva != null ? String(hojaCostos.porc_iva) : "19"
  )
  const [porcRetencion, setPorcRetencion] = React.useState(
    hojaCostos?.porc_retencion != null ? String(hojaCostos.porc_retencion) : "2.5"
  )

  const costoMateriales = hojaCostos?.costo_materiales ?? 0
  // Suma operacionales (local) + insumos (último guardado desde Materiales)
  const sumaOperacionales = operacionalesFijos.reduce(
    (s, f) => s + (parseFloat(valores[f.key as string]) || 0), 0
  )
  const sumaInsumos = VALORES_FIJOS
    .filter((f) => INSUMOS_KEYS.has(f.key as string))
    .reduce((s, f) => s + (Number(hojaCostos?.[f.key]) || 0), 0)
  const sumaFijos = sumaOperacionales + sumaInsumos
  const costoUnitario = costoMateriales + sumaFijos
  const precioVentaNum = parseFloat(precioVenta) || 0

  function handleSave() {
    const fd = new FormData()
    // 10 operacionales desde estado local
    for (const f of operacionalesFijos) {
      fd.set(f.key as string, valores[f.key as string] || "0")
    }
    // 5 insumos desde el último guardado en hojaCostos (editados en pestaña Materiales)
    for (const f of VALORES_FIJOS.filter((f) => INSUMOS_KEYS.has(f.key as string))) {
      const savedVal = hojaCostos?.[f.key]
      fd.set(f.key as string, savedVal != null ? String(savedVal) : "0")
    }
    if (precioVenta) fd.set("precio_venta", precioVenta)
    fd.set("porc_iva", porcIva || "0")
    fd.set("porc_retencion", porcRetencion || "0")
    startTransition(async () => {
      const res = await guardarHojaCostosAction(ordenId, fd)
      if (res.error) onMsg(`Error: ${res.error}`)
      else { onMsg("Costos guardados"); router.refresh() }
    })
  }

  const totalUnidadesHoja = hojaCostos?.total_unidades ?? 0
  const costoTotalMateriales = costoMateriales * totalUnidadesHoja

  // IVA y retención (Colombia): neto = precio + IVA − retención, ambos sobre la base
  const porcIvaNum = parseFloat(porcIva) || 0
  const porcRetNum = parseFloat(porcRetencion) || 0
  const valorIva = precioVentaNum * (porcIvaNum / 100)
  const valorRetencion = precioVentaNum * (porcRetNum / 100)
  // El IVA cobrado se le debe a la DIAN: no es utilidad, por eso resta al margen
  const margenCalc = precioVentaNum > 0 ? precioVentaNum - costoUnitario - valorIva : null
  const netoPorPrenda = precioVentaNum > 0 ? precioVentaNum + valorIva - valorRetencion : 0
  const netoTotalOrden = netoPorPrenda * totalUnidadesHoja

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-800">
        Esta sección solo es visible para usuarios con permiso <strong>ver_costos</strong>. Los datos no se envían al cliente en sesiones sin ese permiso.
      </div>

      {/* Sección: Costos de materiales */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <hr className="flex-1 border-stone-200" />
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide shrink-0">
            Costos de materiales
          </span>
          <hr className="flex-1 border-stone-200" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
            <p className="text-xs text-stone-500">Costo materiales / prenda</p>
            <p className="text-lg font-bold font-mono text-stone-800">{cop(costoMateriales)}</p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
            <p className="text-xs text-stone-500">Total prendas</p>
            <p className="text-lg font-bold font-mono text-stone-800">
              {totalUnidadesHoja.toLocaleString("es-CO")}
            </p>
          </div>
          <div className="rounded-xl border px-4 py-3" style={{ borderColor: "#344966", backgroundColor: "#F0F4F8" }}>
            <p className="text-xs text-stone-500">Costo total de materiales</p>
            <p className="text-lg font-bold font-mono" style={{ color: "#344966" }}>
              {cop(costoTotalMateriales)}
            </p>
          </div>
        </div>
        <p className="text-xs text-stone-400">
          Se calcula desde la pestaña Materiales (consumo × valor unitario × total prendas). Guarda los materiales para actualizarlo.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {operacionalesFijos.map((f) => (
          <div key={f.key as string} className="space-y-1">
            <label className="text-xs font-medium text-stone-600">{f.label}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={valores[f.key as string]}
              onChange={(e) =>
                setValores((p) => ({ ...p, [f.key as string]: e.target.value }))
              }
              className={fieldCls}
            />
          </div>
        ))}
        <div className="space-y-1">
          <label className="text-xs font-medium text-stone-600">Precio de venta</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={precioVenta}
            onChange={(e) => setPrecioVenta(e.target.value)}
            className={fieldCls}
            placeholder="0"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-stone-600">IVA (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={porcIva}
            onChange={(e) => setPorcIva(e.target.value)}
            className={fieldCls}
            placeholder="19"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-stone-600">Retención (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={porcRetencion}
            onChange={(e) => setPorcRetencion(e.target.value)}
            className={fieldCls}
            placeholder="2.5"
          />
        </div>
      </div>

      {/* Resumen de costos */}
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-2 text-sm max-w-sm">
        <div className="flex justify-between text-stone-600">
          <span>Costo materiales / prenda</span>
          <span className="font-mono">{cop(costoMateriales)}</span>
        </div>
        <div className="flex justify-between text-stone-600">
          <span>Suma valores fijos</span>
          <span className="font-mono">{cop(sumaFijos)}</span>
        </div>
        <div className="flex justify-between border-t border-stone-300 pt-2 font-semibold text-stone-800">
          <span>Costo unitario</span>
          <span className="font-mono">{cop(costoUnitario)}</span>
        </div>
        {precioVentaNum > 0 && (
          <div className="flex justify-between text-stone-600">
            <span>Precio de venta</span>
            <span className="font-mono">{cop(precioVentaNum)}</span>
          </div>
        )}
        {margenCalc !== null && (
          <div
            className={`flex justify-between border-t border-stone-200 pt-2 font-semibold ${
              margenCalc >= 0 ? "text-green-700" : "text-red-700"
            }`}
          >
            <span>Margen (precio − costo − IVA)</span>
            <span className="font-mono">{cop(margenCalc)}</span>
          </div>
        )}
        {precioVentaNum > 0 && (
          <>
            <div className="flex justify-between text-stone-600 border-t border-stone-200 pt-2">
              <span>IVA ({porcIvaNum}%)</span>
              <span className="font-mono text-green-700">+{cop(valorIva)}</span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>Retención ({porcRetNum}%)</span>
              <span className="font-mono text-red-700">−{cop(valorRetencion)}</span>
            </div>
            <div className="flex justify-between border-t border-stone-300 pt-2 font-semibold text-stone-800">
              <span>Neto por prenda</span>
              <span className="font-mono">{cop(netoPorPrenda)}</span>
            </div>
            <div className="flex justify-between font-bold" style={{ color: "#344966" }}>
              <span>Neto total orden (× {totalUnidadesHoja.toLocaleString("es-CO")})</span>
              <span className="font-mono">{cop(netoTotalOrden)}</span>
            </div>
          </>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={isPending}
        className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        style={{ backgroundColor: "#344966" }}
      >
        <Save className="h-4 w-4" />
        {isPending ? "Guardando…" : "Guardar costos"}
      </button>
    </div>
  )
}

// ─── Tab 5: Instrucciones ─────────────────────────────────────────────────────

function InstruccionesSection({
  ordenId,
  inicial,
  onMsg,
}: {
  ordenId: number
  inicial: string | null
  onMsg: (m: string) => void
}) {
  const router = useRouter()
  const [texto, setTexto] = React.useState(inicial ?? "")
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      const res = await guardarInstruccionesAction(ordenId, texto)
      if (res.error) onMsg(`Error: ${res.error}`)
      else { onMsg("Instrucciones guardadas"); router.refresh() }
    })
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-stone-700">
          Instrucciones para costura (cuellos, pretinas, combinaciones, medidas, puntadas,
          distancias, ubicación de insumos y combinaciones)
        </label>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={10}
          className={`${fieldCls} resize-y`}
          placeholder="Describe aquí todas las instrucciones de costura para esta OP..."
        />
      </div>
      <button
        onClick={handleSave}
        disabled={isPending}
        className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        style={{ backgroundColor: "#344966" }}
      >
        <Save className="h-4 w-4" />
        {isPending ? "Guardando…" : "Guardar instrucciones"}
      </button>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function OrdenDetalleClient({
  orden,
  opMateriales,
  curvaTallas,
  maestroMateriales,
  tieneVerCostos,
  hojaCostos,
  opTelas,
  opTelaLotes,
  lotes,
}: Props) {
  const router = useRouter()
  const [confirmEnvio, setConfirmEnvio] = React.useState(false)
  const [isPendingEnvio, startEnvio] = useTransition()
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)
  const [activeTab, setActiveTab] = React.useState("info")

  function showToast(tipo: "ok" | "error", msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 3500)
  }

  function handleMsg(msg: string) {
    showToast(msg.startsWith("Error") ? "error" : "ok", msg)
  }

  function handleEnviarDiseno() {
    startEnvio(async () => {
      const res = await enviarADisenoAction(orden.id)
      setConfirmEnvio(false)
      if (res.error) showToast("error", res.error)
      else { showToast("ok", "Orden enviada a Diseño"); router.refresh() }
    })
  }

  const puedeEnviar = orden.estado === "programada" && curvaTallas.length >= 1

  return (
    <div className="space-y-4">
      {/* Toast */}
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

      {/* Estado + acción principal */}
      <div className="rounded-2xl border border-stone-200 bg-white px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-base text-stone-800">
            {padOP(orden.numero_op)}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              ESTADO_OP_COLOR[orden.estado]
            }`}
          >
            {ESTADO_OP_LABEL[orden.estado]}
          </span>
          {orden.referencia && (
            <span className="text-sm text-stone-600">{orden.referencia}</span>
          )}
        </div>
        {puedeEnviar && (
          <button
            onClick={() => setConfirmEnvio(true)}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: "#344966" }}
          >
            <Send className="h-4 w-4" />
            Enviar a Diseño
          </button>
        )}
      </div>

      {/* Tabs controlado: el tab activo no se resetea al hacer router.refresh() */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={`grid w-full ${tieneVerCostos ? "grid-cols-6" : "grid-cols-5"}`}>
          <TabsTrigger value="info">General</TabsTrigger>
          <TabsTrigger value="curva">Curva</TabsTrigger>
          <TabsTrigger value="lotes">Lotes</TabsTrigger>
          <TabsTrigger value="materiales">Materiales</TabsTrigger>
          {tieneVerCostos && <TabsTrigger value="costos">Costos</TabsTrigger>}
          <TabsTrigger value="instrucciones">Instrucciones</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="rounded-2xl border border-stone-200 bg-white p-5 mt-4">
          <InfoGeneralSection orden={orden} onMsg={handleMsg} />
        </TabsContent>

        <TabsContent value="curva" className="rounded-2xl border border-stone-200 bg-white p-5 mt-4">
          <CurvaTallasSection
            ordenId={orden.id}
            orden={orden}
            inicial={curvaTallas}
            opTelas={opTelas}
            opTelaLotes={opTelaLotes}
            onSaved={handleMsg}
          />
        </TabsContent>

        <TabsContent value="lotes" className="rounded-2xl border border-stone-200 bg-white p-5 mt-4">
          <LotesSection
            ordenId={orden.id}
            orden={orden}
            inicial={lotes}
            tallas={curvaTallas.length}
            opTelaLotes={opTelaLotes}
            onMsg={handleMsg}
          />
        </TabsContent>

        <TabsContent value="materiales" className="rounded-2xl border border-stone-200 bg-white p-5 mt-4">
          <MaterialesOPSection
            ordenId={orden.id}
            inicial={opMateriales}
            maestro={maestroMateriales}
            totalUnidades={opTelaLotes.reduce((s, r) => s + r.capas, 0) * curvaTallas.length}
            tieneVerCostos={tieneVerCostos}
            hojaCostos={hojaCostos}
            onMsg={handleMsg}
          />
        </TabsContent>

        {tieneVerCostos && (
          <TabsContent value="costos" className="rounded-2xl border border-stone-200 bg-white p-5 mt-4">
            <HojaCostosSection ordenId={orden.id} hojaCostos={hojaCostos} onMsg={handleMsg} />
          </TabsContent>
        )}

        <TabsContent value="instrucciones" className="rounded-2xl border border-stone-200 bg-white p-5 mt-4">
          <InstruccionesSection
            ordenId={orden.id}
            inicial={orden.observaciones}
            onMsg={handleMsg}
          />
        </TabsContent>
      </Tabs>

      {/* Confirm enviar a diseño */}
      <AlertDialog open={confirmEnvio} onOpenChange={setConfirmEnvio}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Enviar a Diseño?</AlertDialogTitle>
            <AlertDialogDescription>
              La orden {padOP(orden.numero_op)} pasará al estado "Diseño". Asegúrate de que la
              curva de tallas esté completa antes de continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEnviarDiseno}
              disabled={isPendingEnvio}
              className="rounded-xl text-white"
              style={{ backgroundColor: "#344966" }}
            >
              {isPendingEnvio ? "Enviando…" : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
