import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { crearClienteSupabase } from '@lanita/shared';

// La sesión (JWT + refresh token) se guarda en el almacén cifrado del sistema (Keystore/Keychain),
// troceada porque SecureStore limita cada valor a ~2 KB.
const TROZO = 1800;
const almacenSeguro = {
  async getItem(key: string) {
    const n = Number(await SecureStore.getItemAsync(`${key}.n`));
    if (!n) return null;
    const partes: string[] = [];
    for (let i = 0; i < n; i++) partes.push((await SecureStore.getItemAsync(`${key}.${i}`)) ?? '');
    return partes.join('');
  },
  async setItem(key: string, value: string) {
    const n = Math.ceil(value.length / TROZO);
    for (let i = 0; i < n; i++) await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * TROZO, (i + 1) * TROZO));
    await SecureStore.setItemAsync(`${key}.n`, String(n));
  },
  async removeItem(key: string) {
    const n = Number(await SecureStore.getItemAsync(`${key}.n`));
    for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
    await SecureStore.deleteItemAsync(`${key}.n`);
  },
};

export { almacenSeguro };

// Única instancia de la app. Solo clave anon: los permisos los decide RLS según el usuario.
export const supabase = crearClienteSupabase({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  storage: almacenSeguro,
  persistirSesion: true,
});

export type Fila = Record<string, any>;

/** Traduce errores de Postgres/Supabase a mensajes comprensibles y sin detalles internos. */
export function mensajeError(e: unknown): string {
  const m = (e as { message?: string })?.message ?? '';
  if (/Network request failed|fetch/i.test(m)) return 'Sin conexión. Intenta de nuevo.';
  if (/row-level security|permission denied|No autorizado/i.test(m)) return 'No tienes permiso para esta acción.';
  if (/Stock insuficiente/.test(m)) return m;
  if (/duplicate key/i.test(m)) return 'Ya existe un registro con esos datos.';
  // Mensajes de reglas de negocio (RAISE EXCEPTION) son seguros y útiles:
  if (m && !/^(new row|insert|update|select|relation|column|function|syntax)/i.test(m) && m.length < 200) return m;
  return 'No se pudo completar la acción.';
}
