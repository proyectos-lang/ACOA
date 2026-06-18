import { createClient } from "@supabase/supabase-js"

/**
 * Cliente Supabase con service role key apuntando al esquema 'vanessa'.
 * SOLO usar en Server Actions / Route Handlers — nunca en Client Components.
 * Se crea por-llamada (no singleton) para evitar compartir estado entre requests.
 */
export function createVanessaClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error("[Vanessa] Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY")
  }

  return createClient(url, serviceKey, {
    db: { schema: "vanessa" },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
