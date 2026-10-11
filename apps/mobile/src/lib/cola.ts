/**
 * Cola offline de pedidos en borrador.
 * - Se guardan en el almacén CIFRADO (SecureStore) porque contienen datos personales.
 * - Cada borrador lleva su uuid; la RPC crear_pedido es idempotente => reintentar nunca duplica.
 */
import { almacenSeguro, supabase } from './supabase';

const KEY = 'lanita_cola_pedidos';

async function leer(): Promise<any[]> {
  try { return JSON.parse((await almacenSeguro.getItem(KEY)) ?? '[]'); } catch { return []; }
}
async function escribir(l: any[]) {
  if (l.length) await almacenSeguro.setItem(KEY, JSON.stringify(l)); else await almacenSeguro.removeItem(KEY);
}

export async function encolarPedido(p: any) { await escribir([...(await leer()), p]); }
export async function pendientes() { return (await leer()).length; }

export async function sincronizarCola(): Promise<{ enviados: number; fallidos: number }> {
  const lista = await leer();
  const quedan: any[] = [];
  let enviados = 0;
  for (const p of lista) {
    const { error } = await supabase.rpc('crear_pedido', { p });
    if (error) {
      // Error de red => reintentar luego. Error de validación => se conserva igualmente para corregir.
      quedan.push(p);
    } else enviados++;
  }
  await escribir(quedan);
  return { enviados, fallidos: quedan.length };
}

export const esErrorDeRed = (e: unknown) => /Network request failed|fetch|network/i.test((e as any)?.message ?? '');
