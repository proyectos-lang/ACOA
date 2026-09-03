"use server"

import { redirect } from "next/navigation"
import bcrypt from "bcryptjs"
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
  // Se recortan espacios accidentales (autocompletado, copiar/pegar, teclado
  // móvil): la contraseña se guarda igualmente recortada al crear el usuario
  const contrasena = ((formData.get("contrasena") as string | null) ?? "").trim()

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

  // Comparación en texto plano (esquema actual). Fallback bcrypt para los
  // usuarios creados cuando el módulo guardaba hash, para no bloquearlos.
  const almacenada = usuario.contrasena_hash ?? ""
  const esHashBcrypt = /^\$2[aby]\$/.test(almacenada)
  const valida = esHashBcrypt
    ? await bcrypt.compare(contrasena, almacenada)
    : contrasena === almacenada.trim()
  if (!valida) {
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
