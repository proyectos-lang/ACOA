import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { jwtVerify } from "jose"

const COOKIE_NAME = "vanessa_session"
const PUBLIC_PREFIXES = ["/login", "/kiosco", "/_next", "/favicon", "/public"]

function getSecret(): Uint8Array {
  const s = process.env.SESSION_SECRET ?? "vanessa-erp-confeccion-2024-jwt-secret-key-minimum-32-chars-secure!"
  return new TextEncoder().encode(s)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = request.cookies.get(COOKIE_NAME)?.value

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  try {
    await jwtVerify(token, getSecret())
    return NextResponse.next()
  } catch {
    const res = NextResponse.redirect(new URL("/login", request.url))
    res.cookies.delete(COOKIE_NAME)
    return res
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)"],
}
