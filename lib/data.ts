import { cache } from 'react';
import { crearClienteSupabase } from '@lanita/shared';

export const REVALIDATE_SEGUNDOS = 300; // 5 min; además se invalida a demanda desde el APK
export const TAG_CATALOGO = 'catalogo';

// Un único cliente por proceso. Solo clave anon; solo lee vistas públicas (v_catalogo_*).
const supabase = crearClienteSupabase({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  fetch: (input, init) => fetch(input, { ...init, next: { revalidate: process.env.NODE_ENV === 'production' ? REVALIDATE_SEGUNDOS : 15, tags: [TAG_CATALOGO] } }),
});

export type Categoria = { id: string; nombre: string; slug: string; descripcion: string | null; imagen_url: string | null; orden: number };
export type Producto = {
  id: string; nombre: string; slug: string; descripcion_corta: string | null; descripcion: string | null;
  precio: number; categoria_id: string; imagen_url: string | null; es_combo: boolean; destacado: boolean;
  disponible: boolean; bajo_pedido: boolean; tiempo_elaboracion_dias: number | null; dimensiones: string | null;
  material: string; seo_titulo: string | null; seo_descripcion: string | null; updated_at: string;
};
export type ComboFoto = { id: string; combo_id: string; imagen_url: string; tematica: string | null; alt_text: string | null; es_portada: boolean; orden: number };
export type ComboItem = { combo_id: string; producto_id: string; cantidad: number; producto_nombre: string; producto_slug: string };
export type ConfigPublica = {
  nombre_negocio: string; eslogan: string | null; descripcion_corta: string | null; sobre_nosotros: string | null;
  horarios: string | null; logo_url: string | null; whatsapp_numero: string; instagram_url: string | null;
  facebook_url: string | null; tiktok_url: string | null; moneda: string; moneda_simbolo: string; mensaje_whatsapp_default: string;
  tema_colores: unknown; web_mostrar_promociones: boolean; web_mostrar_burbuja: boolean;
};

const CONFIG_VACIA: ConfigPublica = {
  nombre_negocio: 'Lanita', eslogan: null, descripcion_corta: null, sobre_nosotros: null, horarios: null, logo_url: null,
  whatsapp_numero: '', instagram_url: null, facebook_url: null, tiktok_url: null, moneda: 'PEN', moneda_simbolo: 'S/',
  mensaje_whatsapp_default: 'Hola, me gustaría consultar por este producto:',
  tema_colores: null, web_mostrar_promociones: true, web_mostrar_burbuja: true,
};

export const getConfig = cache(async (): Promise<ConfigPublica> => {
  const { data } = await supabase.from('v_catalogo_config').select('*').limit(1).maybeSingle();
  return (data as ConfigPublica | null) ?? CONFIG_VACIA;
});

export const getCategorias = cache(async (): Promise<Categoria[]> => {
  const { data } = await supabase.from('v_catalogo_categorias').select('*').order('orden');
  return (data as Categoria[] | null) ?? [];
});

export const getProductos = cache(async (): Promise<Producto[]> => {
  const { data } = await supabase.from('v_catalogo_productos').select('*').eq('es_combo', false).order('nombre');
  return (data as Producto[] | null) ?? [];
});

export const getProducto = cache(async (slug: string): Promise<Producto | null> => {
  const { data } = await supabase.from('v_catalogo_productos').select('*').eq('slug', slug).eq('es_combo', false).maybeSingle();
  return (data as Producto | null) ?? null;
});

export type DatosCombo = { portada: string | null; fotos: string[]; incluye: { nombre: string; cantidad: number }[] };

export const getCombos = cache(async (): Promise<(Producto & DatosCombo)[]> => {
  const { data: combos } = await supabase.from('v_catalogo_productos').select('*').eq('es_combo', true).order('destacado', { ascending: false }).order('nombre');
  const lista = (combos as Producto[] | null) ?? [];
  if (!lista.length) return [];
  const ids = lista.map((c) => c.id);
  const [{ data: fotos }, { data: incluidos }] = await Promise.all([
    supabase.from('v_catalogo_combo_fotos').select('*').in('combo_id', ids).order('es_portada', { ascending: false }).order('orden'),
    supabase.from('v_catalogo_combo_items').select('*').in('combo_id', ids),
  ]);
  const porCombo = new Map<string, ComboFoto[]>();
  for (const f of (fotos as ComboFoto[] | null) ?? []) porCombo.set(f.combo_id, [...(porCombo.get(f.combo_id) ?? []), f]);
  // Prioridad: la foto de portada propia del combo > primera foto del combo > imagen del producto.
  return lista.map((c) => {
    const fs = porCombo.get(c.id) ?? [];
    const incluye = ((incluidos as ComboItem[] | null) ?? []).filter((i) => i.combo_id === c.id).map((i) => ({ nombre: i.producto_nombre, cantidad: i.cantidad }));
    return { ...c, portada: (fs.find((f) => f.es_portada) ?? fs[0])?.imagen_url ?? c.imagen_url, fotos: fs.map((f) => f.imagen_url), incluye };
  });
});

export const getCombo = cache(async (slug: string) => {
  const { data } = await supabase.from('v_catalogo_productos').select('*').eq('slug', slug).eq('es_combo', true).maybeSingle();
  const combo = data as Producto | null;
  if (!combo) return null;
  const [fotos, items] = await Promise.all([
    supabase.from('v_catalogo_combo_fotos').select('*').eq('combo_id', combo.id).order('es_portada', { ascending: false }).order('orden'),
    supabase.from('v_catalogo_combo_items').select('*').eq('combo_id', combo.id),
  ]);
  return { combo, fotos: (fotos.data as ComboFoto[] | null) ?? [], items: (items.data as ComboItem[] | null) ?? [] };
});

export function precio(n: number, cfg: Pick<ConfigPublica, 'moneda_simbolo'>) {
  return `${cfg.moneda_simbolo}${Number(n).toFixed(2)}`;
}

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

// ---- Catálogo único: productos y combos juntos (el combo usa su propia foto de portada) ----
export type ItemCatalogo = Producto & { imagen: string | null; ruta: string; fotos?: string[]; incluye?: { nombre: string; cantidad: number }[] };

export const getCatalogo = cache(async (): Promise<ItemCatalogo[]> => {
  const [productos, combos] = await Promise.all([getProductos(), getCombos()]);
  const lista: ItemCatalogo[] = [
    ...combos.map((c) => ({ ...c, imagen: c.portada, ruta: `/combos/${c.slug}` })),
    ...productos.map((p) => ({ ...p, imagen: p.imagen_url, ruta: `/catalogo/${p.slug}` })),
  ];
  return lista.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
});

// ---- Promociones vigentes (la base de datos ya filtra por activa + fechas) ----
export type Promocion = {
  id: string; titulo: string; descripcion: string | null; imagen_url: string | null;
  fecha_inicio: string; fecha_fin: string; orden: number; producto_slug: string | null; producto_es_combo: boolean | null;
};

export const getPromociones = cache(async (): Promise<Promocion[]> => {
  const { data } = await supabase.from('v_catalogo_promociones').select('*').order('orden').order('fecha_fin');
  return (data as Promocion[] | null) ?? [];
});
