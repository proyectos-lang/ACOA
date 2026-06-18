"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { LogIn, LogOut, Loader2, Monitor, CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
import { registrarEntradaAction, registrarSalidaAction, type KioscoResult } from "./actions"

type Pantalla =
  | { tipo: "inicio" }
  | { tipo: "cargando"; accion: "entrada" | "salida" }
  | { tipo: "confirmacion"; resultado: Extract<KioscoResult, { ok: true }> }
  | { tipo: "error"; mensaje: string }
  | { tipo: "sugerir_salida"; mensaje: string; horaEntrada: string; nombre: string; documento: string }

export default function KioscoPage() {
  const [pantalla, setPantalla] = useState<Pantalla>({ tipo: "inicio" })
  const [hora, setHora] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  // Reloj en tiempo real
  useEffect(() => {
    const tick = () =>
      setHora(
        new Date().toLocaleTimeString("es-CO", {
          timeZone: "America/Bogota",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      )
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Auto-reset
  useEffect(() => {
    if (pantalla.tipo === "confirmacion") {
      const id = setTimeout(reset, 5000)
      return () => clearTimeout(id)
    }
    if (pantalla.tipo === "error") {
      const id = setTimeout(reset, 3000)
      return () => clearTimeout(id)
    }
  }, [pantalla.tipo])

  const reset = useCallback(() => {
    setPantalla({ tipo: "inicio" })
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  async function ejecutarAccion(accion: "entrada" | "salida", documento: string) {
    if (!documento.trim()) {
      setPantalla({ tipo: "error", mensaje: "Ingresa un número de documento" })
      return
    }
    setPantalla({ tipo: "cargando", accion })
    const fd = new FormData()
    fd.set("documento", documento.trim())
    const res = accion === "entrada"
      ? await registrarEntradaAction(fd)
      : await registrarSalidaAction(fd)

    if (res.ok) {
      setPantalla({ tipo: "confirmacion", resultado: res })
    } else if (res.sugerirSalida) {
      setPantalla({
        tipo: "sugerir_salida",
        mensaje: res.error,
        horaEntrada: res.horaEntrada ?? "",
        nombre: res.nombre ?? "",
        documento: documento.trim(),
      })
    } else {
      setPantalla({ tipo: "error", mensaje: res.error })
    }
  }

  function handleBtnAccion(accion: "entrada" | "salida") {
    const doc = inputRef.current?.value ?? ""
    ejecutarAccion(accion, doc)
  }

  const fecha = new Date().toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const cargando = pantalla.tipo === "cargando"

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-stone-50">

      {/* Encabezado */}
      <div className="mb-10 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-3xl font-bold tracking-tight" style={{ color: "#0D1821" }}>
            ACOA
          </span>
        </div>
        <div className="flex items-center justify-center gap-2 mb-3">
          <Monitor className="h-4 w-4 text-stone-400" />
          <span className="text-xs font-semibold tracking-widest uppercase text-stone-400">
            Control de Asistencia
          </span>
        </div>
        <div
          className="text-6xl sm:text-7xl font-bold tracking-tight tabular-nums"
          style={{ color: "#344966" }}
        >
          {hora || "—:—:—"}
        </div>
        <p className="mt-2 text-sm capitalize text-stone-400 first-letter:uppercase">{fecha}</p>
      </div>

      {/* ── Pantalla inicio ── */}
      {pantalla.tipo === "inicio" && (
        <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 shadow-md space-y-5">
          <h2 className="text-lg font-semibold text-center text-stone-800">
            Ingresa tu número de documento
          </h2>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoFocus
            autoComplete="off"
            placeholder="Ej: 1234567890"
            className="w-full h-14 rounded-xl border-2 border-stone-200 bg-white px-4 text-center text-2xl font-mono font-bold tracking-widest text-stone-900 outline-none transition-all placeholder:text-stone-300 focus:border-[#344966] focus:ring-4 focus:ring-[#344966]/10"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleBtnAccion("entrada")
            }}
          />
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleBtnAccion("entrada")}
              disabled={cargando}
              className="flex items-center justify-center gap-2 h-14 rounded-xl font-semibold text-base text-white bg-green-600 hover:bg-green-700 active:bg-green-800 transition-colors disabled:opacity-50"
            >
              <LogIn className="h-5 w-5" />
              Entrada
            </button>
            <button
              onClick={() => handleBtnAccion("salida")}
              disabled={cargando}
              className="flex items-center justify-center gap-2 h-14 rounded-xl font-semibold text-base text-white bg-orange-500 hover:bg-orange-600 active:bg-orange-700 transition-colors disabled:opacity-50"
            >
              <LogOut className="h-5 w-5" />
              Salida
            </button>
          </div>
        </div>
      )}

      {/* ── Pantalla cargando ── */}
      {pantalla.tipo === "cargando" && (
        <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-12 shadow-md flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-[#344966]" />
          <p className="text-stone-600 font-medium">
            Registrando {pantalla.accion}…
          </p>
        </div>
      )}

      {/* ── Pantalla confirmación ── */}
      {pantalla.tipo === "confirmacion" && (
        <div
          className={`w-full max-w-md rounded-2xl border-2 bg-white p-10 shadow-md text-center animate-in fade-in zoom-in duration-300 ${
            pantalla.resultado.tipo === "entrada" ? "border-green-300" : "border-orange-300"
          }`}
        >
          <div
            className={`mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full ${
              pantalla.resultado.tipo === "entrada" ? "bg-green-100" : "bg-orange-100"
            }`}
          >
            {pantalla.resultado.tipo === "entrada" ? (
              <LogIn className="h-10 w-10 text-green-600" />
            ) : (
              <LogOut className="h-10 w-10 text-orange-500" />
            )}
          </div>
          <p
            className={`text-3xl font-bold uppercase tracking-wider mb-2 ${
              pantalla.resultado.tipo === "entrada" ? "text-green-700" : "text-orange-600"
            }`}
          >
            {pantalla.resultado.tipo === "entrada" ? "¡Bienvenido!" : "¡Hasta pronto!"}
          </p>
          <p className="text-2xl font-semibold text-stone-800 mt-3">
            {pantalla.resultado.nombre}
          </p>
          <p className="text-base text-stone-500 mt-2">
            {pantalla.resultado.tipo === "entrada" ? "Entrada" : "Salida"} registrada a las{" "}
            <strong className="text-stone-700">{pantalla.resultado.hora}</strong>
          </p>
          <p className="text-sm text-stone-400 mt-1">{pantalla.resultado.fecha}</p>
          <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-stone-400">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            Restableciendo en unos segundos…
          </div>
        </div>
      )}

      {/* ── Pantalla error ── */}
      {pantalla.tipo === "error" && (
        <div className="w-full max-w-md rounded-2xl border-2 border-red-200 bg-white p-8 shadow-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
          <p className="text-xl font-semibold text-stone-800">{pantalla.mensaje}</p>
          <p className="text-sm text-stone-400 mt-2">La pantalla se restablecerá en unos segundos…</p>
        </div>
      )}

      {/* ── Pantalla sugerir salida ── */}
      {pantalla.tipo === "sugerir_salida" && (
        <div className="w-full max-w-md rounded-2xl border-2 border-amber-300 bg-white p-8 shadow-md text-center space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
          </div>
          <div>
            <p className="text-lg font-semibold text-stone-800">{pantalla.nombre}</p>
            <p className="text-sm text-stone-600 mt-2">{pantalla.mensaje}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => ejecutarAccion("salida", pantalla.documento)}
              className="flex items-center justify-center gap-2 h-12 rounded-xl font-semibold text-sm text-white bg-orange-500 hover:bg-orange-600 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Registrar Salida
            </button>
            <button
              onClick={reset}
              className="flex items-center justify-center h-12 rounded-xl font-semibold text-sm border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <p className="mt-10 text-xs text-stone-300 tracking-wide">
        ACOA — Sistema de Control de Asistencia
      </p>
    </main>
  )
}
