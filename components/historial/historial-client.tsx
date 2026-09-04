"use client"

import * as React from "react"
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Save,
  X,
  Trash2,
  FileSpreadsheet,
} from "lucide-react"
import type { ModuloDef, RegistroHistorial, CampoDef } from "@/lib/db/historial"
import {
  cargarHistorialAction,
  editarRegistroHistorialAction,
  eliminarRegistroHistorialAction,
} from "@/app/(dashboard)/historial/actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

function padOP(n: number | null) {
  return n != null ? `OP-${String(n).padStart(4, "0")}` : "—"
}
function hoyBogota() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
}

const inputCls =
  "w-full rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-[#344966]"
const filtroCls =
  "rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#344966]"

function Toast({ tipo, msg }: { tipo: "ok" | "error"; msg: string }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
        tipo === "ok"
          ? "bg-green-50 text-green-800 border border-green-200"
          : "bg-red-50 text-red-800 border border-red-200"
      }`}
    >
      {tipo === "ok" ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="h-4 w-4 shrink-0" />
      )}
      {msg}
    </div>
  )
}

// Muestra un valor en modo lectura según su tipo
function mostrarValor(campo: CampoDef, valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—"
  if (campo.tipo === "booleano") return valor ? "Sí" : "No"
  if (campo.tipo === "numero") return Number(valor).toLocaleString("es-CO")
  return String(valor)
}

// Una línea del historial: lectura, edición inline y eliminación
function FilaHistorial({
  modulo,
  registro,
  onMsg,
  onRecargar,
}: {
  modulo: ModuloDef
  registro: RegistroHistorial
  onMsg: (tipo: "ok" | "error", msg: string) => void
  onRecargar: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [editando, setEditando] = React.useState(false)
  const [valores, setValores] = React.useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const c of modulo.campos) {
      const v = registro.valores[c.key]
      init[c.key] = c.tipo === "booleano" ? String(v === true) : v == null ? "" : String(v)
    }
    return init
  })

  function guardar() {
    startTransition(async () => {
      const campos: Record<string, unknown> = {}
      for (const c of modulo.campos) {
        if (!c.editable) continue
        campos[c.key] = c.tipo === "booleano" ? valores[c.key] === "true" : valores[c.key]
      }
      const res = await editarRegistroHistorialAction(modulo.key, registro.id, campos)
      if (res.error) onMsg("error", res.error)
      else {
        onMsg("ok", "Registro actualizado")
        setEditando(false)
        onRecargar()
      }
    })
  }

  function eliminar() {
    startTransition(async () => {
      const res = await eliminarRegistroHistorialAction(modulo.key, registro.id)
      if (res.error) onMsg("error", res.error)
      else {
        onMsg("ok", "Registro eliminado")
        onRecargar()
      }
    })
  }

  return (
    <tr className={`border-b border-stone-100 last:border-0 ${editando ? "bg-blue-50/40" : "hover:bg-stone-50"}`}>
      <td className="px-3 py-2 font-mono text-xs text-stone-400">#{registro.id}</td>
      <td className="px-3 py-2 font-mono text-xs text-stone-600">{padOP(registro.numero_op)}</td>
      <td className="px-3 py-2 text-xs text-stone-700">
        {registro.lote_nombre ?? "—"}
        {registro.referencia && (
          <span className="block text-[11px] text-stone-400">{registro.referencia}</span>
        )}
      </td>
      {modulo.campos.map((c) => (
        <td key={c.key} className="px-3 py-2 text-xs">
          {editando && c.editable ? (
            c.tipo === "booleano" ? (
              <select
                value={valores[c.key]}
                onChange={(e) => setValores((v) => ({ ...v, [c.key]: e.target.value }))}
                className={inputCls}
              >
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            ) : c.tipo === "textarea" ? (
              <textarea
                rows={2}
                value={valores[c.key]}
                onChange={(e) => setValores((v) => ({ ...v, [c.key]: e.target.value }))}
                className={`${inputCls} resize-none min-w-40`}
              />
            ) : (
              <input
                type={c.tipo === "fecha" ? "date" : c.tipo === "numero" ? "number" : "text"}
                step={c.tipo === "numero" ? "0.01" : undefined}
                value={valores[c.key]}
                onChange={(e) => setValores((v) => ({ ...v, [c.key]: e.target.value }))}
                className={`${inputCls} ${c.tipo === "fecha" ? "min-w-32" : "min-w-24"}`}
              />
            )
          ) : (
            <span className={c.tipo === "numero" ? "font-mono text-stone-700" : "text-stone-700"}>
              {mostrarValor(c, registro.valores[c.key])}
            </span>
          )}
        </td>
      ))}
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          {editando ? (
            <>
              <button
                type="button"
                onClick={guardar}
                disabled={isPending}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: "#344966" }}
              >
                <Save className="h-3 w-3" /> Guardar
              </button>
              <button
                type="button"
                onClick={() => setEditando(false)}
                className="p-1 rounded hover:bg-stone-100 text-stone-400"
                title="Cancelar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="p-1 rounded hover:bg-stone-100 text-stone-400 hover:text-stone-700"
                title="Editar registro"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-red-50 text-stone-400 hover:text-red-500"
                    title="Eliminar registro"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-md rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar el registro #{registro.id}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se eliminará esta línea de <strong>{modulo.label}</strong>
                      {registro.lote_nombre ? ` (${registro.lote_nombre})` : ""}. Esta acción no se
                      puede revertir.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={eliminar}
                      className="rounded-xl bg-red-600 hover:bg-red-700"
                    >
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

export function HistorialClient({
  modulos,
  moduloInicial,
  registrosIniciales,
}: {
  modulos: ModuloDef[]
  moduloInicial: string
  registrosIniciales: RegistroHistorial[]
}) {
  const router = useRouter()
  const [toast, setToast] = React.useState<{ tipo: "ok" | "error"; msg: string } | null>(null)
  const [moduloKey, setModuloKey] = React.useState(moduloInicial)
  const [registros, setRegistros] = React.useState(registrosIniciales)
  const [cargando, startCarga] = useTransition()

  const [fOP, setFOP] = React.useState("")
  const [fLote, setFLote] = React.useState("")
  const [fTexto, setFTexto] = React.useState("")

  const modulo = modulos.find((m) => m.key === moduloKey) ?? modulos[0]

  function showToast(tipo: "ok" | "error", msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const recargar = React.useCallback(
    (key: string) => {
      startCarga(async () => {
        const res = await cargarHistorialAction(key)
        if (res.error) showToast("error", res.error)
        else setRegistros(res.registros ?? [])
        router.refresh()
      })
    },
    [router]
  )

  function cambiarModulo(key: string) {
    setModuloKey(key)
    recargar(key)
  }

  const filtrados = registros.filter((r) => {
    if (fOP && !padOP(r.numero_op).toLowerCase().includes(fOP.toLowerCase())) {
      if (!(r.referencia ?? "").toLowerCase().includes(fOP.toLowerCase())) return false
    }
    if (fLote && !(r.lote_nombre ?? "").toLowerCase().includes(fLote.toLowerCase())) return false
    if (fTexto) {
      const q = fTexto.toLowerCase()
      const enValores = Object.values(r.valores).some((v) =>
        String(v ?? "").toLowerCase().includes(q)
      )
      if (!enValores) return false
    }
    return true
  })

  // Exporta a Excel lo que se está viendo
  function exportarExcel() {
    const esc = (s: unknown) =>
      String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    const encabezados = ["ID", "OP", "Referencia", "Lote", ...modulo.campos.map((c) => c.label)]
    const filas = filtrados
      .map(
        (r) =>
          `<tr><td>${r.id}</td><td>${padOP(r.numero_op)}</td><td>${esc(r.referencia)}</td><td>${esc(
            r.lote_nombre
          )}</td>${modulo.campos
            .map((c) => `<td>${esc(mostrarValor(c, r.valores[c.key]))}</td>`)
            .join("")}</tr>`
      )
      .join("")
    const tabla = `<html><head><meta charset="utf-8"></head><body><table border="1"><tr>${encabezados
      .map((h) => `<th>${esc(h)}</th>`)
      .join("")}</tr>${filas}</table></body></html>`
    const blob = new Blob(["﻿" + tabla], { type: "application/vnd.ms-excel" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `historial-${modulo.key}-${hoyBogota()}.xls`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="space-y-4">
      {toast && <Toast tipo={toast.tipo} msg={toast.msg} />}

      {/* ── Selector de módulo ──────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {modulos.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => cambiarModulo(m.key)}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
              m.key === moduloKey
                ? "bg-[#344966] text-white"
                : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* ── Filtros ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 flex flex-wrap items-end gap-3">
        <div className="space-y-0.5">
          <label className="text-[11px] font-medium text-stone-500">OP / Referencia</label>
          <input
            type="text"
            value={fOP}
            onChange={(e) => setFOP(e.target.value)}
            className={`${filtroCls} w-40`}
            placeholder="OP-0001"
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-[11px] font-medium text-stone-500">Lote</label>
          <input
            type="text"
            value={fLote}
            onChange={(e) => setFLote(e.target.value)}
            className={`${filtroCls} w-36`}
            placeholder="Lote 1"
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-[11px] font-medium text-stone-500">Buscar en los datos</label>
          <input
            type="text"
            value={fTexto}
            onChange={(e) => setFTexto(e.target.value)}
            className={`${filtroCls} w-48`}
            placeholder="Estampador, fecha, valor…"
          />
        </div>
        {(fOP || fLote || fTexto) && (
          <button
            type="button"
            onClick={() => {
              setFOP("")
              setFLote("")
              setFTexto("")
            }}
            className="rounded-xl px-3 py-2 text-xs font-medium border border-stone-200 text-stone-500 hover:bg-stone-50"
          >
            Limpiar filtros
          </button>
        )}
        <button
          type="button"
          onClick={exportarExcel}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white"
          style={{ backgroundColor: "#0f766e" }}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
        </button>
        <span className="ml-auto text-xs text-stone-400">
          {cargando ? "Cargando…" : `${filtrados.length} de ${registros.length} registros`}
        </span>
      </div>

      {/* ── Tabla ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-100">
                <th className="px-3 py-2 text-left text-xs text-stone-500 font-medium">ID</th>
                <th className="px-3 py-2 text-left text-xs text-stone-500 font-medium">OP</th>
                <th className="px-3 py-2 text-left text-xs text-stone-500 font-medium">Lote</th>
                {modulo.campos.map((c) => (
                  <th
                    key={c.key}
                    className="px-3 py-2 text-left text-xs text-stone-500 font-medium whitespace-nowrap"
                  >
                    {c.label}
                  </th>
                ))}
                <th className="px-3 py-2 text-left text-xs text-stone-500 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td
                    colSpan={modulo.campos.length + 4}
                    className="px-4 py-8 text-center text-sm text-stone-400"
                  >
                    {cargando ? "Cargando registros…" : "No hay registros con los filtros actuales."}
                  </td>
                </tr>
              ) : (
                filtrados.map((r) => (
                  <FilaHistorial
                    key={`${modulo.key}_${r.id}`}
                    modulo={modulo}
                    registro={r}
                    onMsg={showToast}
                    onRecargar={() => recargar(modulo.key)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
