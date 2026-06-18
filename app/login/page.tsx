"use client"

import * as React from "react"
import { useActionState } from "react"
import { Lock, ArrowRight, Loader2, Eye, EyeOff, User } from "lucide-react"
import { loginAction } from "./actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Paleta de marca
// Ink Black:  #0D1821
// Yale Blue:  #344966
// Sky Blue:   #abcde0
// Dry Sage:   #BFCC94

const INITIAL: { error: string | null } = { error: null }

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, INITIAL)
  const [showPassword, setShowPassword] = React.useState(false)

  return (
    <main
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{
        backgroundImage: `url('https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_5385-1v02bKvtjuY9N5MFzK8Mc65DTNkmN4.png')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <style>{`
        @keyframes fadeSlideLeft {
          from { opacity: 0; transform: translateX(-32px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim-slide-left { animation: fadeSlideLeft 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .anim-slide-up-1 { animation: fadeSlideUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.2s both; }
        .anim-slide-up-2 { animation: fadeSlideUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.4s both; }
        .anim-card      { animation: fadeSlideUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.15s both; }
        .login-input:focus-visible {
          outline: none;
          border-color: #BFCC94 !important;
          box-shadow: 0 0 0 3px rgba(191, 204, 148, 0.35) !important;
        }
      `}</style>

      <div className="relative z-10 flex flex-1 items-center px-4 py-6 sm:py-10 lg:py-12 lg:px-12">
        <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-16 mx-auto">

          {/* Panel izquierdo */}
          <div className="hidden lg:flex flex-col gap-6 max-w-lg lg:pl-4">
            <h1
              className="anim-slide-left text-4xl xl:text-5xl font-bold leading-tight tracking-tight text-balance"
              style={{ color: "#344966" }}
            >
              Gestiona tu empresa de confección de forma simple e inteligente
            </h1>
            <p
              className="anim-slide-up-1 text-base leading-relaxed text-pretty"
              style={{ color: "#344966", opacity: 0.85 }}
            >
              Personal, producción y nómina desde un solo lugar. El sistema diseñado para crecer contigo.
            </p>
            <div className="anim-slide-up-2 h-1 w-16 rounded-full" style={{ backgroundColor: "#344966", opacity: 0.4 }} />
          </div>

          {/* Card formulario */}
          <div className="anim-card w-full max-w-sm">
            <div className="rounded-2xl bg-white p-6 sm:p-8 shadow-2xl">

              {/* Logo */}
              <div className="mb-5 space-y-2">
                <img
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_5365-c5fxbRQfBGwK1uj6MpIRuiHtoWnfdE.jpeg"
                  alt="Logo"
                  className="w-full h-auto object-contain mx-auto block"
                  style={{ maxHeight: "64px" }}
                />
                <div className="space-y-1">
                  <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#0D1821" }}>
                    Inicio de sesión
                  </h1>
                  <p className="text-sm leading-relaxed" style={{ color: "#344966" }}>
                    Ingresa tus credenciales para continuar
                  </p>
                </div>
              </div>

              <form action={action} className="space-y-4">

                {/* Error */}
                {state.error && (
                  <div className="rounded-xl px-4 py-3 text-sm font-medium text-red-700 bg-red-50 border border-red-200">
                    {state.error}
                  </div>
                )}

                {/* Usuario */}
                <div className="space-y-1.5">
                  <Label htmlFor="nombre_usuario" className="text-sm font-medium" style={{ color: "#0D1821" }}>
                    Usuario
                  </Label>
                  <div className="relative">
                    <User
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4"
                      style={{ color: "#344966", opacity: 0.5 }}
                    />
                    <Input
                      id="nombre_usuario"
                      name="nombre_usuario"
                      type="text"
                      autoComplete="username"
                      placeholder="nombre de usuario"
                      disabled={pending}
                      className="login-input h-11 pl-10 rounded-xl bg-white text-sm"
                      style={{ borderColor: "#abcde0", color: "#0D1821" }}
                    />
                  </div>
                </div>

                {/* Contraseña */}
                <div className="space-y-1.5">
                  <Label htmlFor="contrasena" className="text-sm font-medium" style={{ color: "#0D1821" }}>
                    Contraseña
                  </Label>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4"
                      style={{ color: "#344966", opacity: 0.5 }}
                    />
                    <Input
                      id="contrasena"
                      name="contrasena"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      disabled={pending}
                      className="login-input h-11 pl-10 pr-10 rounded-xl bg-white text-sm"
                      style={{ borderColor: "#abcde0", color: "#0D1821" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 focus:outline-none"
                      tabIndex={-1}
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showPassword
                        ? <Eye className="h-4 w-4" style={{ color: "#344966", opacity: 0.5 }} />
                        : <EyeOff className="h-4 w-4" style={{ color: "#344966", opacity: 0.5 }} />}
                    </button>
                  </div>
                </div>

                {/* Botón */}
                <button
                  type="submit"
                  disabled={pending}
                  className="w-full h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold text-white transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#344966" }}
                  onMouseEnter={(e) => {
                    if (!pending) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#0D1821"
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#344966"
                  }}
                >
                  {pending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Ingresando...</>
                  ) : (
                    <><span>Ingresar</span><ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
              </form>

              <div className="mt-4 pt-4 border-t" style={{ borderColor: "#abcde0" }}>
                <p className="text-xs text-center leading-relaxed" style={{ color: "#344966", opacity: 0.7 }}>
                  Si olvidaste tu contraseña, contacta al administrador.
                </p>
              </div>
            </div>

            <p className="mt-5 text-center text-xs font-medium" style={{ color: "#344966" }}>
              {new Date().getFullYear()} ACOA. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
