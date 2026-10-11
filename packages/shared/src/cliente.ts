import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';

export type OpcionesCliente = {
  url: string;
  anonKey: string;
  /** Solo para la app móvil: almacenamiento cifrado de sesión. */
  storage?: SupportedStorage;
  persistirSesion?: boolean;
  /** fetch personalizado (la web lo usa para cache/ISR de Next). */
  fetch?: typeof fetch;
};

/**
 * Crea UN cliente (cada app lo guarda como singleton).
 * Solo admite la clave `anon`: la `service_role` nunca debe llegar a un cliente.
 */
export function crearClienteSupabase({ url, anonKey, storage, persistirSesion = false, fetch: fetchFn }: OpcionesCliente): SupabaseClient {
  if (!url || !anonKey) throw new Error('Faltan variables de entorno de Supabase');
  if (rolDeClave(anonKey) === 'service_role') {
    throw new Error('¡La service_role key no puede usarse en un cliente!');
  }
  return createClient(url, anonKey, {
    global: fetchFn ? { fetch: fetchFn } : undefined,
    auth: {
      persistSession: persistirSesion,
      autoRefreshToken: persistirSesion,
      detectSessionInUrl: false,
      storage,
    },
  });
}

function rolDeClave(jwt: string): string | null {
  try {
    const payload = jwt.split('.')[1];
    if (!payload) return null;
    const json = typeof atob === 'function' ? atob(payload.replace(/-/g, '+').replace(/_/g, '/')) : Buffer.from(payload, 'base64').toString();
    return JSON.parse(json).role ?? null;
  } catch {
    return null;
  }
}
