import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

export const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const uuidv4 = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

export const money = (n: number | string | null | undefined, simbolo = 'S/') => `${simbolo}${Number(n ?? 0).toFixed(2)}`;

/** Abre cámara o galería, reduce a 1600px y comprime. El re-encode elimina EXIF (ubicación del taller/hogar). */
export async function tomarFoto(origen: 'camara' | 'galeria', formato: 'jpeg' | 'png' = 'jpeg'): Promise<{ base64: string } | null> {
  const permiso = origen === 'camara' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) return null;
  const r = origen === 'camara'
    ? await ImagePicker.launchCameraAsync({ quality: 0.9, exif: false })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, exif: false });
  if (r.canceled || !r.assets[0]) return null;
  const out = await ImageManipulator.manipulateAsync(r.assets[0].uri, [{ resize: { width: 1600 } }], {
    compress: 0.75, format: formato === 'png' ? ImageManipulator.SaveFormat.PNG : ImageManipulator.SaveFormat.JPEG, base64: true,
  });
  return out.base64 ? { base64: out.base64 } : null;
}

/** Sube a un bucket. `publico` => devuelve URL pública; si no, solo la ruta (acceso por URL firmada). */
export async function subirImagen(bucket: 'productos' | 'combos' | 'comprobantes', path: string, base64: string, tipo: 'image/jpeg' | 'image/png' = 'image/jpeg') {
  const { error } = await supabase.storage.from(bucket).upload(path, decode(base64), { contentType: tipo, upsert: false });
  if (error) throw error;
  const url = bucket === 'comprobantes' ? null : supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  return { path, url };
}

/** Avisa a la web que hay cambios (usa el token del usuario; no hay secretos en el APK). */
export async function revalidarWeb() {
  const base = process.env.EXPO_PUBLIC_WEB_URL;
  if (!base) return;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;
  try {
    await fetch(`${base.replace(/\/$/, '')}/api/revalidate`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  } catch { /* la web también se refresca sola cada 5 min */ }
}
