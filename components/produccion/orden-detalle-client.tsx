"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import {
  Send, AlertTriangle, CheckCircle2,
  Plus, Trash2, Save, ExternalLink, Pencil,
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
  addOpMaterialAction,
  updateOpMaterialAction,
  deleteOpMaterialAction,
  enviarADisenoAction,
} from "@/app/(dashboard)/produccion/[id]/actions"
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
}: {
  ordenId: number
  slot: 1 | 2 | 3
  iniciales: OpTelaRow[]
  inicialesLotes: OpTelaLoteRow[]
  tallasCount: number
  numLotesPreset: number
  onMsg: (m: string) => void
  onCapasChange: (slot: 1 | 2 | 3, total: number) => void
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

  React.useEffect(() => {
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
      <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Material {slot}</p>
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

const TALLAS_PREDEFINIDAS = ["4", "6", "8", "10", "12", "14", "16", "S", "M", "L", "XL", "XXL"]

function CurvaTallasSection({
  ordenId,
  inicial,
  opTelas,
  opTelaLotes,
  onSaved,
}: {
  ordenId: number
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
          {([1, 2, 3] as const).map((slot) => (
            <OpTelaSlotCard
              key={slot}
              ordenId={ordenId}
              slot={slot}
              iniciales={opTelas}
              inicialesLotes={opTelaLotes}
              tallasCount={tallas.length}
              numLotesPreset={presetAplicado}
              onMsg={onSaved}
              onCapasChange={handleCapasChange}
            />
          ))}
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
        <button
          onClick={guardarCurva}
          disabled={isPending}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 shrink-0"
          style={{ backgroundColor: "#344966" }}
        >
          <Save className="h-4 w-4" />
          {isPending ? "Guardando…" : "Guardar tallas"}
        </button>
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

type FormMaterial = {
  tipo: string
  nombre: string
  unidad_medida: string
  valor_unitario: string
  consumo_estimado: string
}

const emptyForm: FormMaterial = {
  tipo: "",
  nombre: "",
  unidad_medida: "",
  valor_unitario: "0",
  consumo_estimado: "",
}

function MaterialesOPSection({
  ordenId,
  inicial,
  maestro,
  tieneVerCostos,
  hojaCostos,
  onMsg,
}: {
  ordenId: number
  inicial: OpMaterialRow[]
  maestro: MaterialRow[]
  tieneVerCostos: boolean
  hojaCostos: HojaCostosRow | null
  onMsg: (m: string) => void
}) {
  const router = useRouter()
  const [addOpen, setAddOpen] = React.useState(false)
  const [editRow, setEditRow] = React.useState<OpMaterialRow | null>(null)
  const [deleteId, setDeleteId] = React.useState<number | null>(null)
  const [isPending, startTransition] = useTransition()
  const [selectedMaterial, setSelectedMaterial] = React.useState<MaterialRow | null>(null)
  const [form, setForm] = React.useState<FormMaterial>(emptyForm)

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

  function openAdd() {
    setSelectedMaterial(null)
    setForm(emptyForm)
    setAddOpen(true)
  }

  function openEdit(row: OpMaterialRow) {
    setForm({
      tipo: row.tipo,
      nombre: row.nombre,
      unidad_medida: row.unidad_medida,
      valor_unitario: String(row.valor_unitario),
      consumo_estimado: row.consumo_estimado != null ? String(row.consumo_estimado) : "",
    })
    setEditRow(row)
  }

  function pickMaterial(id: string) {
    const m = maestro.find((x) => String(x.id) === id) ?? null
    setSelectedMaterial(m)
    if (m) {
      setForm({
        tipo: m.tipo,
        nombre: m.nombre,
        unidad_medida: m.unidad_medida,
        valor_unitario: String(m.valor_unitario),
        consumo_estimado: "",
      })
    }
  }

  function handleAdd() {
    startTransition(async () => {
      const res = await addOpMaterialAction({
        orden_id: ordenId,
        material_id: selectedMaterial?.id ?? null,
        tipo: form.tipo,
        nombre: form.nombre,
        unidad_medida: form.unidad_medida,
        valor_unitario: parseFloat(form.valor_unitario) || 0,
        consumo_estimado: form.consumo_estimado ? parseFloat(form.consumo_estimado) : null,
      })
      if (res.error) onMsg(`Error: ${res.error}`)
      else { setAddOpen(false); onMsg("Material agregado"); router.refresh() }
    })
  }

  function handleEdit() {
    if (!editRow) return
    startTransition(async () => {
      const res = await updateOpMaterialAction(editRow.id, ordenId, {
        tipo: form.tipo,
        nombre: form.nombre,
        unidad_medida: form.unidad_medida,
        valor_unitario: parseFloat(form.valor_unitario) || 0,
        consumo_estimado: form.consumo_estimado ? parseFloat(form.consumo_estimado) : null,
      })
      if (res.error) onMsg(`Error: ${res.error}`)
      else { setEditRow(null); onMsg("Material actualizado"); router.refresh() }
    })
  }

  async function handleDelete() {
    if (!deleteId) return
    const res = await deleteOpMaterialAction(deleteId, ordenId)
    setDeleteId(null)
    if (res.error) onMsg(`Error: ${res.error}`)
    else { onMsg("Material eliminado"); router.refresh() }
  }

  const totalVPP = inicial.reduce((s, m) => s + Number(m.valor_por_prenda), 0)
  const vppPreview =
    (parseFloat(form.consumo_estimado) || 0) * (parseFloat(form.valor_unitario) || 0)

  function MaterialForm({ onConfirm, isEdit }: { onConfirm: () => void; isEdit: boolean }) {
    return (
      <div className="space-y-3">
        {!isEdit && maestro.length > 0 && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-stone-700">Desde maestro (opcional)</label>
            <select
              className={fieldCls}
              value={selectedMaterial?.id ?? ""}
              onChange={(e) => pickMaterial(e.target.value)}
            >
              <option value="">— Manual —</option>
              {maestro.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre} ({m.tipo})
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Tipo</label>
            <input
              className={fieldCls}
              value={form.tipo}
              onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}
              placeholder="tela"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Unidad de medida</label>
            <input
              className={fieldCls}
              value={form.unidad_medida}
              onChange={(e) => setForm((p) => ({ ...p, unidad_medida: e.target.value }))}
              placeholder="metro"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-stone-600">Nombre</label>
          <input
            className={fieldCls}
            value={form.nombre}
            onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
            placeholder="Nombre del material"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Valor unitario</label>
            <input
              type="number"
              min="0"
              step="0.0001"
              className={fieldCls}
              value={form.valor_unitario}
              onChange={(e) => setForm((p) => ({ ...p, valor_unitario: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Consumo estimado</label>
            <input
              type="number"
              min="0"
              step="0.0001"
              className={fieldCls}
              value={form.consumo_estimado}
              onChange={(e) => setForm((p) => ({ ...p, consumo_estimado: e.target.value }))}
              placeholder="0.0000"
            />
          </div>
        </div>
        {form.consumo_estimado && form.valor_unitario && vppPreview > 0 && (
          <div className="rounded-lg bg-stone-50 border border-stone-200 px-3 py-2 text-xs text-stone-600">
            Valor por prenda (preview):{" "}
            <strong className="text-stone-800">{cop(vppPreview)}</strong>
          </div>
        )}
        <button
          onClick={onConfirm}
          disabled={isPending || !form.tipo || !form.nombre || !form.unidad_medida}
          className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: "#344966" }}
        >
          {isPending ? "Guardando…" : isEdit ? "Guardar cambios" : "Agregar"}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-700">Materiales e insumos</h3>
        <button
          onClick={openAdd}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium border border-stone-200 hover:bg-stone-50 transition-colors text-stone-600"
        >
          <Plus className="h-3 w-3" />
          Agregar material
        </button>
      </div>

      {inicial.length === 0 ? (
        <p className="text-xs text-stone-400 py-6 text-center">Sin materiales asignados.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50">
                {["Tipo", "Nombre", "Unidad", "Consumo est.", "Valor unit.", "V/Prenda", ""].map(
                  (h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-stone-500">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {inicial.map((m) => (
                <tr key={m.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-3 py-2">
                    <span className="rounded-full px-2 py-0.5 bg-stone-100 text-stone-600 text-xs">
                      {m.tipo}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium text-stone-800">{m.nombre}</td>
                  <td className="px-3 py-2 text-stone-500">{m.unidad_medida}</td>
                  <td className="px-3 py-2 font-mono text-stone-600">
                    {m.consumo_estimado ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-stone-600">
                    {cop(Number(m.valor_unitario))}
                  </td>
                  <td className="px-3 py-2 font-mono font-semibold text-stone-800">
                    {cop(Number(m.valor_por_prenda))}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(m)}
                        className="p-1 rounded hover:bg-stone-100 text-stone-400 hover:text-stone-600"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteId(m.id)}
                        className="p-1 rounded hover:bg-red-50 text-stone-400 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-stone-200 bg-stone-50">
                <td colSpan={5} className="px-3 py-2 text-xs font-semibold text-stone-600">
                  Total costo materiales / prenda
                </td>
                <td className="px-3 py-2 font-mono font-bold text-stone-900">{cop(totalVPP)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

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

      {/* Dialog agregar */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Agregar material</DialogTitle>
          </DialogHeader>
          <MaterialForm onConfirm={handleAdd} isEdit={false} />
        </DialogContent>
      </Dialog>

      {/* Dialog editar */}
      <Dialog open={editRow !== null} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Editar material</DialogTitle>
          </DialogHeader>
          <MaterialForm onConfirm={handleEdit} isEdit={true} />
        </DialogContent>
      </Dialog>

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
  const margenCalc = precioVentaNum > 0 ? precioVentaNum - costoUnitario : null

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
    startTransition(async () => {
      const res = await guardarHojaCostosAction(ordenId, fd)
      if (res.error) onMsg(`Error: ${res.error}`)
      else { onMsg("Costos guardados"); router.refresh() }
    })
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-800">
        Esta sección solo es visible para usuarios con permiso <strong>ver_costos</strong>. Los datos no se envían al cliente en sesiones sin ese permiso.
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
            <span>Margen (precio − costo)</span>
            <span className="font-mono">{cop(margenCalc)}</span>
          </div>
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
