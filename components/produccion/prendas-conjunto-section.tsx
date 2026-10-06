"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Save, ArrowRight, Info } from "lucide-react"
import {
  type LotePrendaRow,
  type PrendaEstado,
  PRENDA_ESTADO_LABEL,
  PRENDA_ESTADO_COLOR,
} from "@/lib/db/lote-prenda"
import { sumarDiasSinDomingo, hoyBogota } from "@/lib/fechas-habiles"
import { PersonaCombobox, type PersonaOpcion } from "@/components/ui/persona-combobox"
import {
  actualizarPrendaAction,
  avanzarPrendaAction,
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

// Fila editable de una pieza del conjunto: cada etapa edita sus campos
// (estampación: estampador + precio + fechas + unidades recibidas;
// confección: confeccionista + precio + fechas + unidades recibidas;
// conteo: cantidad contada)
function PrendaFila({
  prenda,
  loteId,
  etapa,
  cantidadProgramada,
  estampadores,
  confeccionistas,
  precioDefault,
  onMsg,
}: {
  prenda: LotePrendaRow
  loteId: number
  etapa: PrendaEstado
  cantidadProgramada: number
  estampadores: PersonaOpcion[]
  confeccionistas: PersonaOpcion[]
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
  const [estDias, setEstDias] = React.useState(
    prenda.est_dias_entrega != null ? String(prenda.est_dias_entrega) : ""
  )
  const [estEstimada, setEstEstimada] = React.useState(prenda.est_fecha_estimada ?? "")
  const [estRetorno, setEstRetorno] = React.useState(prenda.est_fecha_retorno ?? "")
  const [estRecibida, setEstRecibida] = React.useState(
    prenda.est_cantidad_recibida != null ? String(prenda.est_cantidad_recibida) : ""
  )
  const [confeccionista, setConfeccionista] = React.useState(prenda.nombre_confeccionista ?? "")
  const [confPrecio, setConfPrecio] = React.useState(
    prenda.conf_precio != null
      ? String(prenda.conf_precio)
      : etapa === "confeccion" && precioDefault != null
        ? String(precioDefault)
        : ""
  )
  const [confEntrega, setConfEntrega] = React.useState(prenda.conf_fecha_entrega ?? "")
  const [confDias, setConfDias] = React.useState(
    prenda.conf_dias_entrega != null ? String(prenda.conf_dias_entrega) : ""
  )
  const [confEstimada, setConfEstimada] = React.useState(prenda.conf_fecha_estimada ?? "")
  const [confRetorno, setConfRetorno] = React.useState(prenda.conf_fecha_retorno ?? "")
  const [confRecibida, setConfRecibida] = React.useState(
    prenda.conf_cantidad_recibida != null ? String(prenda.conf_cantidad_recibida) : ""
  )
  const [cantidad, setCantidad] = React.useState(
    prenda.cantidad_contada != null ? String(prenda.cantidad_contada) : ""
  )

  // La fecha estimada de cada prenda se calcula con sus días (sin domingos)
  const estDiasNum = parseInt(estDias, 10)
  const estEstimadaCalc =
    estDiasNum > 0 ? sumarDiasSinDomingo(estEntrega || hoyBogota(), estDiasNum) : ""
  const confDiasNum = parseInt(confDias, 10)
  const confEstimadaCalc =
    confDiasNum > 0 ? sumarDiasSinDomingo(confEntrega || hoyBogota(), confDiasNum) : ""

  // Lo que entro a la etapa: lo que volvio de la anterior, o lo programado
  const enviadasAEstampacion = cantidadProgramada
  const enviadasAConfeccion = prenda.est_cantidad_recibida ?? cantidadProgramada
  const estRecibidaNum = estRecibida === "" ? null : parseInt(estRecibida, 10)
  const confRecibidaNum = confRecibida === "" ? null : parseInt(confRecibida, 10)

  function guardar() {
    startTransition(async () => {
      const campos =
        etapa === "estampacion"
          ? {
              nombre_estampador: estampador || null,
              est_precio: estPrecio ? Number(estPrecio) : null,
              est_fecha_entrega: estEntrega || null,
              est_dias_entrega: estDiasNum > 0 ? estDiasNum : null,
              est_fecha_estimada: estEstimadaCalc || estEstimada || null,
              est_fecha_retorno: estRetorno || null,
              est_cantidad_recibida: estRecibidaNum,
            }
          : etapa === "confeccion"
            ? {
                nombre_confeccionista: confeccionista || null,
                conf_precio: confPrecio ? Number(confPrecio) : null,
                conf_fecha_entrega: confEntrega || null,
                conf_dias_entrega: confDiasNum > 0 ? confDiasNum : null,
                conf_fecha_estimada: confEstimadaCalc || confEstimada || null,
                conf_fecha_retorno: confRetorno || null,
                conf_cantidad_recibida: confRecibidaNum,
              }
            : { cantidad_contada: cantidad ? parseInt(cantidad, 10) : null }
      const res = await actualizarPrendaAction(prenda.id, loteId, campos)
      if (res.error) onMsg("error", res.error)
      else {
        onMsg("ok", `Pieza "${prenda.nombre}" guardada`)
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
        onMsg("ok", res.aviso ?? `"${prenda.nombre}" → ${PRENDA_ESTADO_LABEL[siguiente]}`)
        router.refresh()
      }
    })
  }

  // Los campos de la etapa solo se editan cuando la pieza está en esa etapa
  const editable = prenda.estado === etapa

  // Para salir de estampación o confección hay que haber registrado el
  // retorno; el botón se deshabilita y el título explica por qué
  const faltaParaAvanzar =
    prenda.estado === "estampacion"
      ? !prenda.est_fecha_retorno
        ? "Registra y guarda la fecha de retorno primero"
        : prenda.est_cantidad_recibida == null
          ? "Registra y guarda las unidades recibidas primero"
          : null
      : prenda.estado === "confeccion"
        ? !prenda.conf_fecha_retorno
          ? "Registra y guarda la fecha de retorno primero"
          : prenda.conf_cantidad_recibida == null
            ? "Registra y guarda las unidades recibidas primero"
            : null
        : null

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

  // Diferencia entre lo enviado y lo recibido, para resaltarla
  function Diferencia({ enviadas, recibidas }: { enviadas: number; recibidas: number | null }) {
    if (recibidas == null || Number.isNaN(recibidas)) return null
    const d = recibidas - enviadas
    if (d === 0) return <span className="text-[10px] text-emerald-600">completo</span>
    return (
      <span className={`text-[10px] font-semibold ${d < 0 ? "text-red-600" : "text-amber-600"}`}>
        {d > 0 ? "+" : ""}
        {d.toLocaleString("es-CO")} frente a {enviadas.toLocaleString("es-CO")} enviadas
      </span>
    )
  }

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
        {editable && SIGUIENTE[prenda.estado] && (
          <button
            type="button"
            onClick={avanzar}
            disabled={isPending || !!faltaParaAvanzar}
            title={faltaParaAvanzar ?? SIGUIENTE_LABEL[prenda.estado]}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: "#0f766e" }}
          >
            <ArrowRight className="h-3 w-3" />
            {SIGUIENTE_LABEL[prenda.estado]}
          </button>
        )}
      </div>

      {/* Resumen de lo registrado en otras etapas */}
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-stone-500">
        {etapa !== "estampacion" && prenda.nombre_estampador && (
          <span>Estampador: <strong>{prenda.nombre_estampador}</strong></span>
        )}
        {etapa !== "estampacion" && prenda.est_cantidad_recibida != null && (
          <span>Volvieron de estampación: <strong>{prenda.est_cantidad_recibida.toLocaleString("es-CO")}</strong></span>
        )}
        {etapa !== "confeccion" && prenda.nombre_confeccionista && (
          <span>Confeccionista: <strong>{prenda.nombre_confeccionista}</strong></span>
        )}
        {etapa !== "confeccion" && prenda.conf_cantidad_recibida != null && (
          <span>Volvieron de confección: <strong>{prenda.conf_cantidad_recibida.toLocaleString("es-CO")}</strong></span>
        )}
        {etapa !== "conteo" && prenda.cantidad_contada != null && (
          <span>Contadas: <strong>{prenda.cantidad_contada.toLocaleString("es-CO")}</strong></span>
        )}
      </div>

      {editable && etapa === "estampacion" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="space-y-0.5">
            <label className={lblCls}>Estampador</label>
            <PersonaCombobox
              opciones={estampadores}
              value={estampador}
              onChange={setEstampador}
              vacioLabel="— Estampador —"
              compacto
            />
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
            <label className={lblCls}>Días de entrega</label>
            <input type="number" min="1" value={estDias} onChange={(e) => setEstDias(e.target.value)} className={inputCls} placeholder="Ej: 3" />
          </div>
          <div className="space-y-0.5">
            <label className={lblCls}>F. estimada (sin domingos)</label>
            <input
              type="date"
              value={estEstimadaCalc || estEstimada}
              readOnly={estDiasNum > 0}
              onChange={(e) => setEstEstimada(e.target.value)}
              className={`${inputCls} ${estDiasNum > 0 ? "bg-stone-100 text-stone-600" : ""}`}
            />
          </div>
          <div className="space-y-0.5">
            <label className={lblCls}>F. retorno *</label>
            <input type="date" value={estRetorno} onChange={(e) => setEstRetorno(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-0.5">
            <label className={lblCls}>Unidades recibidas *</label>
            <input
              type="number"
              min="0"
              value={estRecibida}
              onChange={(e) => setEstRecibida(e.target.value)}
              className={`${inputCls} ${estRecibidaNum != null && estRecibidaNum !== enviadasAEstampacion ? "border-amber-400 bg-amber-50" : ""}`}
              placeholder={String(enviadasAEstampacion)}
            />
            <Diferencia enviadas={enviadasAEstampacion} recibidas={estRecibidaNum} />
          </div>
          <div className="flex items-end">{btnGuardar}</div>
        </div>
      )}

      {editable && etapa === "confeccion" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="space-y-0.5">
            <label className={lblCls}>Confeccionista</label>
            <PersonaCombobox
              opciones={confeccionistas}
              value={confeccionista}
              onChange={setConfeccionista}
              vacioLabel="— Confeccionista —"
              compacto
            />
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
            <label className={lblCls}>Días de entrega</label>
            <input type="number" min="1" value={confDias} onChange={(e) => setConfDias(e.target.value)} className={inputCls} placeholder="Ej: 3" />
          </div>
          <div className="space-y-0.5">
            <label className={lblCls}>F. estimada (sin domingos)</label>
            <input
              type="date"
              value={confEstimadaCalc || confEstimada}
              readOnly={confDiasNum > 0}
              onChange={(e) => setConfEstimada(e.target.value)}
              className={`${inputCls} ${confDiasNum > 0 ? "bg-stone-100 text-stone-600" : ""}`}
            />
          </div>
          <div className="space-y-0.5">
            <label className={lblCls}>F. retorno *</label>
            <input type="date" value={confRetorno} onChange={(e) => setConfRetorno(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-0.5">
            <label className={lblCls}>Unidades recibidas *</label>
            <input
              type="number"
              min="0"
              value={confRecibida}
              onChange={(e) => setConfRecibida(e.target.value)}
              className={`${inputCls} ${confRecibidaNum != null && confRecibidaNum !== enviadasAConfeccion ? "border-amber-400 bg-amber-50" : ""}`}
              placeholder={String(enviadasAConfeccion)}
            />
            <Diferencia enviadas={enviadasAConfeccion} recibidas={confRecibidaNum} />
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

// Sección "Piezas del conjunto": en las fichas de estampación y confección
// se incrusta dentro de la tarjeta de datos (embedded), subdividiendo los
// campos de la etapa por cada pieza; en conteo va como sección propia.
// Las piezas vienen definidas desde la ficha de la OP: aquí no se crean
// ni se retiran.
export function PrendasConjuntoSection({
  loteId,
  prendas,
  etapa,
  cantidadProgramada = 0,
  estampadores = [],
  confeccionistas = [],
  precioDefault = null,
  embedded = false,
  onMsg,
}: {
  loteId: number
  prendas: LotePrendaRow[]
  etapa: PrendaEstado
  // Unidades programadas del lote: es lo que entra a estampación
  cantidadProgramada?: number
  estampadores?: PersonaOpcion[]
  confeccionistas?: PersonaOpcion[]
  precioDefault?: number | null
  embedded?: boolean
  onMsg: (tipo: "ok" | "error", msg: string) => void
}) {
  const contenido = (
    <>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className={embedded ? "text-xs font-semibold text-stone-600" : "text-sm font-semibold text-stone-700"}>
          Piezas del conjunto ({prendas.length})
        </p>
        <span className="text-[11px] text-stone-400">
          Cada pieza con sus propios datos de la etapa
        </span>
      </div>

      {prendas.length === 0 ? (
        <p className="flex items-start gap-1.5 text-xs text-stone-400 py-3">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          Este lote aún no tiene piezas. Se crean solas al entrar a estampación con las piezas
          que define la ficha de la OP (pestaña General).
        </p>
      ) : (
        <div className="space-y-2">
          {prendas.map((p) => (
            <PrendaFila
              key={p.id}
              prenda={p}
              loteId={loteId}
              etapa={etapa}
              cantidadProgramada={cantidadProgramada}
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
