"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Plus, Trash2, Save, ArrowRight } from "lucide-react"
import {
  type LotePrendaRow,
  type PrendaEstado,
  PRENDA_ESTADO_LABEL,
  PRENDA_ESTADO_COLOR,
} from "@/lib/db/lote-prenda"
import {
  crearPrendaAction,
  actualizarPrendaAction,
  avanzarPrendaAction,
  eliminarPrendaAction,
} from "@/app/(dashboard)/lote-prendas-actions"

const SIGUIENTE: Record<PrendaEstado, PrendaEstado | null> = {
  estampacion: "confeccion",
  confeccion: "conteo",
  conteo: "completado",
  completado: null,
}

const SIGUIENTE_LABEL: Record<PrendaEstado, string> = {
  estampacion: "Enviar a confección",
  confeccion: "Enviar a conteo",
  conteo: "Marcar completada",
  completado: "",
}

const inputCls =
  "w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#344966]"
const lblCls = "text-[11px] font-medium text-stone-500"

// Fila editable de una prenda del conjunto: cada etapa edita sus campos
// (estampación: estampador + precio + fechas; confección: confeccionista +
// precio + fechas; conteo: cantidad contada)
function PrendaFila({
  prenda,
  loteId,
  etapa,
  estampadores,
  confeccionistas,
  precioDefault,
  onMsg,
}: {
  prenda: LotePrendaRow
  loteId: number
  etapa: PrendaEstado
  estampadores: string[]
  confeccionistas: string[]
  precioDefault: number | null
  onMsg: (tipo: "ok" | "error", msg: string) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [estampador, setEstampador] = React.useState(prenda.nombre_estampador ?? "")
  const [estPrecio, setEstPrecio] = React.useState(
    prenda.est_precio != null
      ? String(prenda.est_precio)
      : etapa === "estampacion" && precioDefault != null
        ? String(precioDefault)
        : ""
  )
  const [estEntrega, setEstEntrega] = React.useState(prenda.est_fecha_entrega ?? "")
  const [estEstimada, setEstEstimada] = React.useState(prenda.est_fecha_estimada ?? "")
  const [estRetorno, setEstRetorno] = React.useState(prenda.est_fecha_retorno ?? "")
  const [confeccionista, setConfeccionista] = React.useState(prenda.nombre_confeccionista ?? "")
  const [confPrecio, setConfPrecio] = React.useState(
    prenda.conf_precio != null
      ? String(prenda.conf_precio)
      : etapa === "confeccion" && precioDefault != null
        ? String(precioDefault)
        : ""
  )
  const [confEntrega, setConfEntrega] = React.useState(prenda.conf_fecha_entrega ?? "")
  const [confEstimada, setConfEstimada] = React.useState(prenda.conf_fecha_estimada ?? "")
  const [confRetorno, setConfRetorno] = React.useState(prenda.conf_fecha_retorno ?? "")
  const [cantidad, setCantidad] = React.useState(
    prenda.cantidad_contada != null ? String(prenda.cantidad_contada) : ""
  )

  function guardar() {
    startTransition(async () => {
      const campos =
        etapa === "estampacion"
          ? {
              nombre_estampador: estampador || null,
              est_precio: estPrecio ? Number(estPrecio) : null,
              est_fecha_entrega: estEntrega || null,
              est_fecha_estimada: estEstimada || null,
              est_fecha_retorno: estRetorno || null,
            }
          : etapa === "confeccion"
            ? {
                nombre_confeccionista: confeccionista || null,
                conf_precio: confPrecio ? Number(confPrecio) : null,
                conf_fecha_entrega: confEntrega || null,
                conf_fecha_estimada: confEstimada || null,
                conf_fecha_retorno: confRetorno || null,
              }
            : { cantidad_contada: cantidad ? parseInt(cantidad, 10) : null }
      const res = await actualizarPrendaAction(prenda.id, loteId, campos)
      if (res.error) onMsg("error", res.error)
      else {
        onMsg("ok", `Prenda "${prenda.nombre}" guardada`)
        router.refresh()
      }
    })
  }

  function avanzar() {
    const siguiente = SIGUIENTE[prenda.estado]
    if (!siguiente) return
    startTransition(async () => {
      const res = await avanzarPrendaAction(prenda.id, loteId, siguiente)
      if (res.error) onMsg("error", res.error)
      else {
        onMsg("ok", `"${prenda.nombre}" → ${PRENDA_ESTADO_LABEL[siguiente]}`)
        router.refresh()
      }
    })
  }

  function eliminar() {
    startTransition(async () => {
      const res = await eliminarPrendaAction(prenda.id, loteId)
      if (res.error) onMsg("error", res.error)
      else {
        onMsg("ok", `Prenda "${prenda.nombre}" eliminada`)
        router.refresh()
      }
    })
  }

  // Los campos de la etapa solo se editan cuando la prenda está en esa etapa
  const editable = prenda.estado === etapa

  const btnGuardar = (
    <button
      type="button"
      onClick={guardar}
      disabled={isPending}
      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
      style={{ backgroundColor: "#344966" }}
    >
      <Save className="h-3 w-3" /> Guardar
    </button>
  )

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-sm text-stone-800 truncate">{prenda.nombre}</span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
              PRENDA_ESTADO_COLOR[prenda.estado]
            }`}
          >
            {PRENDA_ESTADO_LABEL[prenda.estado]}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {editable && SIGUIENTE[prenda.estado] && (
            <button
              type="button"
              onClick={avanzar}
              disabled={isPending}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: "#0f766e" }}
            >
              <ArrowRight className="h-3 w-3" />
              {SIGUIENTE_LABEL[prenda.estado]}
            </button>
          )}
          <button
            type="button"
            onClick={eliminar}
            disabled={isPending}
            className="p-1 rounded hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors"
            title="Eliminar prenda"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Resumen de lo registrado en otras etapas */}
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-stone-500">
        {etapa !== "estampacion" && prenda.nombre_estampador && (
          <span>Estampador: <strong>{prenda.nombre_estampador}</strong></span>
        )}
        {etapa !== "estampacion" && prenda.est_precio != null && (
          <span>Precio est.: <strong>${Number(prenda.est_precio).toLocaleString("es-CO")}</strong></span>
        )}
        {etapa !== "confeccion" && prenda.nombre_confeccionista && (
          <span>Confeccionista: <strong>{prenda.nombre_confeccionista}</strong></span>
        )}
        {etapa !== "confeccion" && prenda.conf_precio != null && (
          <span>Precio conf.: <strong>${Number(prenda.conf_precio).toLocaleString("es-CO")}</strong></span>
        )}
        {etapa !== "conteo" && prenda.cantidad_contada != null && (
          <span>Contadas: <strong>{prenda.cantidad_contada.toLocaleString("es-CO")}</strong></span>
        )}
      </div>

      {editable && etapa === "estampacion" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div className="space-y-0.5">
            <label className={lblCls}>Estampador</label>
            <select value={estampador} onChange={(e) => setEstampador(e.target.value)} className={inputCls}>
              <option value="">— Estampador —</option>
              {estampador && !estampadores.includes(estampador) && (
                <option value={estampador}>{estampador} (no registrado)</option>
              )}
              {estampadores.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="space-y-0.5">
            <label className={lblCls}>Precio (COP)</label>
            <input type="number" min="0" step="0.01" value={estPrecio} onChange={(e) => setEstPrecio(e.target.value)} className={inputCls} placeholder="0.00" />
          </div>
          <div className="space-y-0.5">
            <label className={lblCls}>F. entrega</label>
            <input type="date" value={estEntrega} onChange={(e) => setEstEntrega(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-0.5">
            <label className={lblCls}>F. estimada de entrega</label>
            <input type="date" value={estEstimada} onChange={(e) => setEstEstimada(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-0.5">
            <label className={lblCls}>F. retorno</label>
            <input type="date" value={estRetorno} onChange={(e) => setEstRetorno(e.target.value)} className={inputCls} />
          </div>
          <div className="flex items-end">{btnGuardar}</div>
        </div>
      )}

      {editable && etapa === "confeccion" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div className="space-y-0.5">
            <label className={lblCls}>Confeccionista</label>
            <select value={confeccionista} onChange={(e) => setConfeccionista(e.target.value)} className={inputCls}>
              <option value="">— Confeccionista —</option>
              {confeccionista && !confeccionistas.includes(confeccionista) && (
                <option value={confeccionista}>{confeccionista} (no registrado)</option>
              )}
              {confeccionistas.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="space-y-0.5">
            <label className={lblCls}>Precio (COP)</label>
            <input type="number" min="0" step="0.01" value={confPrecio} onChange={(e) => setConfPrecio(e.target.value)} className={inputCls} placeholder="0.00" />
          </div>
          <div className="space-y-0.5">
            <label className={lblCls}>F. entrega</label>
            <input type="date" value={confEntrega} onChange={(e) => setConfEntrega(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-0.5">
            <label className={lblCls}>F. estimada de entrega</label>
            <input type="date" value={confEstimada} onChange={(e) => setConfEstimada(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-0.5">
            <label className={lblCls}>F. retorno</label>
            <input type="date" value={confRetorno} onChange={(e) => setConfRetorno(e.target.value)} className={inputCls} />
          </div>
          <div className="flex items-end">{btnGuardar}</div>
        </div>
      )}

      {editable && etapa === "conteo" && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-0.5">
            <label className={lblCls}>Cantidad contada</label>
            <input
              type="number"
              min="0"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className={`${inputCls} w-28`}
              placeholder="0"
            />
          </div>
          {btnGuardar}
        </div>
      )}
    </div>
  )
}

// Sección "Prendas del conjunto": en las fichas de estampación y confección
// se incrusta dentro de la tarjeta de datos (embedded), subdividiendo los
// campos de la etapa por cada prenda; en conteo va como sección propia.
export function PrendasConjuntoSection({
  loteId,
  prendas,
  etapa,
  estampadores = [],
  confeccionistas = [],
  precioDefault = null,
  embedded = false,
  onMsg,
}: {
  loteId: number
  prendas: LotePrendaRow[]
  etapa: PrendaEstado
  estampadores?: string[]
  confeccionistas?: string[]
  precioDefault?: number | null
  embedded?: boolean
  onMsg: (tipo: "ok" | "error", msg: string) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [nuevaPrenda, setNuevaPrenda] = React.useState("")

  function crear() {
    const nombre = nuevaPrenda.trim()
    if (!nombre) return
    startTransition(async () => {
      const res = await crearPrendaAction(loteId, nombre, etapa)
      if (res.error) onMsg("error", res.error)
      else {
        onMsg("ok", `Prenda "${nombre}" agregada`)
        setNuevaPrenda("")
        router.refresh()
      }
    })
  }

  const contenido = (
    <>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className={embedded ? "text-xs font-semibold text-stone-600" : "text-sm font-semibold text-stone-700"}>
          Prendas del conjunto ({prendas.length})
        </p>
        <span className="text-[11px] text-stone-400">
          Cada prenda con sus propios datos de la etapa
        </span>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={nuevaPrenda}
          onChange={(e) => setNuevaPrenda(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); crear() } }}
          placeholder="Nombre de la prenda (ej: Camiseta, Pantalón, Chaqueta)…"
          className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"
        />
        <button
          type="button"
          onClick={crear}
          disabled={isPending || !nuevaPrenda.trim()}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 shrink-0"
          style={{ backgroundColor: "#344966" }}
        >
          <Plus className="h-3.5 w-3.5" /> Agregar prenda
        </button>
      </div>

      {prendas.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-3">
          Sin prendas registradas. Agrega cada prenda del conjunto (ej: Camiseta, Pantalón).
        </p>
      ) : (
        <div className="space-y-2">
          {prendas.map((p) => (
            <PrendaFila
              key={p.id}
              prenda={p}
              loteId={loteId}
              etapa={etapa}
              estampadores={estampadores}
              confeccionistas={confeccionistas}
              precioDefault={precioDefault}
              onMsg={onMsg}
            />
          ))}
        </div>
      )}
    </>
  )

  if (embedded) return <div className="space-y-3">{contenido}</div>

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
      {contenido}
    </div>
  )
}
