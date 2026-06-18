"use server"

import { redirect } from "next/navigation"
import { createSession, deleteSession } from "@/lib/auth/session"
import { getUsuarioPorNombre } from "@/lib/db/usuario"

export interface LoginState {
  error: string | null
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const nombreUsuario = (formData.get("nombre_usuario") as string | null)?.trim() ?? ""
  const contrasena = (formData.get("contrasena") as string | null) ?? ""

  if (!nombreUsuario || !contrasena) {
    return { error: "Completa todos los campos" }
  }

  const usuario = await getUsuarioPorNombre(nombreUsuario)

  if (!usuario) {
    return { error: "Usuario o contraseña incorrectos" }
  }

  if (!usuario.activo) {
    return { error: "Usuario inactivo. Contacta al administrador." }
  }

  if (contrasena !== usuario.contrasena_hash) {
    return { error: "Usuario o contraseña incorrectos" }
  }

  await createSession({
    userId: usuario.id,
    nombreUsuario: usuario.nombre_usuario,
    nombreCompleto: usuario.nombre_completo ?? usuario.nombre_usuario,
  })

  redirect("/")
}

export async function logoutAction(): Promise<void> {
  await deleteSession()
  redirect("/login")
}
