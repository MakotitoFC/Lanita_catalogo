// Edge Function: envía la notificación push cuando se inserta una fila en `notificaciones`.
// Se conecta con un Database Webhook (INSERT en public.notificaciones) que incluye el header
//   x-webhook-secret: <PUSH_WEBHOOK_SECRET>
// Secrets (solo en el servidor, nunca en el APK):
//   supabase secrets set PUSH_WEBHOOK_SECRET=...
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase automáticamente en las Edge Functions.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

function igualesConstante(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  const secreto = Deno.env.get('PUSH_WEBHOOK_SECRET') ?? '';
  if (!secreto || !igualesConstante(req.headers.get('x-webhook-secret') ?? '', secreto)) {
    return new Response('forbidden', { status: 403 });
  }
  const { record } = await req.json();
  if (!record?.usuario_id || record.push_enviado) return new Response('ok');

  const { data: dispositivos } = await admin
    .from('dispositivos_push').select('expo_token').eq('usuario_id', record.usuario_id).eq('activo', true);
  if (!dispositivos?.length) return new Response('sin dispositivos');

  const mensajes = dispositivos.map((d) => ({
    to: d.expo_token, title: record.titulo, body: record.cuerpo ?? undefined, sound: 'default', data: { tipo: record.tipo, ref_tabla: record.ref_tabla, ref_id: record.ref_id },
  }));
  const r = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(mensajes),
  });
  if (r.ok) {
    await admin.from('notificaciones').update({ push_enviado: true, push_enviado_en: new Date().toISOString() }).eq('id', record.id);
  }
  return new Response(r.ok ? 'enviado' : 'error', { status: r.ok ? 200 : 502 });
});
