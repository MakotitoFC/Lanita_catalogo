import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { TAG_CATALOGO } from '@/lib/data';

/**
 * El APK llama aquí tras publicar cambios, enviando SU token de sesión de Supabase
 * (Authorization: Bearer <access_token>). No existe ningún secreto compartido embebido
 * en el APK: el servidor verifica el JWT con Supabase y exige perfil admin activo.
 */
export const dynamic = 'force-dynamic';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Límite simple por usuario (instancia). Para más robustez usar un store externo.
const ventana = new Map<string, number[]>();
function limitado(uid: string, max = 10, ms = 60_000) {
  const ahora = Date.now();
  const hits = (ventana.get(uid) ?? []).filter((t) => ahora - t < ms);
  hits.push(ahora);
  ventana.set(uid, hits);
  return hits.length > max;
}

const respuesta = (status: number, body: object) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.match(/^Bearer\s+([\w-]+\.[\w-]+\.[\w-]+)$/)?.[1];
  if (!token) return respuesta(401, { ok: false });

  const sb = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: u, error } = await sb.auth.getUser(token);
  if (error || !u.user) return respuesta(401, { ok: false });
  if (limitado(u.user.id)) return respuesta(429, { ok: false });

  // RLS: cada usuario solo puede leer su propio perfil.
  const { data: perfil } = await sb.from('perfiles').select('rol, activo').eq('id', u.user.id).maybeSingle();
  if (!perfil || !perfil.activo || perfil.rol !== 'admin') return respuesta(403, { ok: false });

  revalidateTag(TAG_CATALOGO);
  revalidatePath('/', 'layout');
  return respuesta(200, { ok: true });
}

export function GET() {
  return respuesta(405, { ok: false });
}
