import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"

const COOKIE_NAME = "vanessa_session"
const EXPIRY_SECONDS = 8 * 60 * 60 // 8 horas

function getSecret(): Uint8Array {
  const s = process.env.SESSION_SECRET
  if (!s) throw new Error("SESSION_SECRET no está configurado en las variables de entorno")
  return new TextEncoder().encode(s)
}

export interface SessionPayload {
  userId: number
  nombreUsuario: string
  nombreCompleto: string
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRY_SECONDS}s`)
    .sign(getSecret())

  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: EXPIRY_SECONDS,
    path: "/",
  })
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getSecret())
    return {
      userId: payload.userId as number,
      nombreUsuario: payload.nombreUsuario as string,
      nombreCompleto: payload.nombreCompleto as string,
    }
  } catch {
    return null
  }
}

export async function deleteSession(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}
