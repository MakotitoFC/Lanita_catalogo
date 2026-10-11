/**
 * Paleta configurable. El negocio elige 5 colores y de ellos se deriva la escala completa que usan la web y el APK
 * (`lana-50` … `lana-900`), cuidando que los botones y textos mantengan buen contraste.
 *
 *   principal  → botones, barras, enlaces fuertes (se oscurece solo si no contrasta con blanco)
 *   acento     → detalles y resaltados (contadores, insignias)
 *   base       → fondos y bordes cálidos (se aclara para fondos y tarjetas)
 *   claro      → tono suave de apoyo (iconos inactivos)
 *   secundario → tono medio de apoyo
 */
export type ColoresTema = { principal: string; acento: string; base: string; claro: string; secundario: string };
export const CLAVES_COLOR = ['principal', 'acento', 'base', 'claro', 'secundario'] as const;

export const ETIQUETAS_COLOR: Record<(typeof CLAVES_COLOR)[number], string> = {
  principal: 'Principal (botones y barras)',
  acento: 'Acento (resaltados)',
  base: 'Base (fondos y bordes)',
  claro: 'Claro (apoyo suave)',
  secundario: 'Secundario (apoyo)',
};

/**
 * Paleta oficial de Lanita, medida píxel por píxel de las capturas de referencia (colección de productos y ofertas):
 *   principal  = verde oliva de botones e insignias
 *   acento     = ámbar (contadores y resaltados)
 *   base       = beige grisáceo del fondo exterior
 *   claro      = marco claro que rodea el contenedor blanco
 *   secundario = verde grisáceo de apoyo (mezcla del oliva con el fondo)
 */
export const TEMA_LANITA: ColoresTema = { principal: '#7d8150', acento: '#fcb848', base: '#d4d4c9', claro: '#e9eae2', secundario: '#a9ac8c' };
/** Paleta de la carta de pintura (gris topo y crema). */
export const TEMA_TOPO: ColoresTema = { principal: '#8b8577', acento: '#b3b5b4', base: '#ede9e2', claro: '#dddddb', secundario: '#b3b5b4' };
/** Paleta anterior (naranja y turquesa). */
export const TEMA_NARANJA: ColoresTema = { principal: '#b84f0b', acento: '#e9c16a', base: '#d3c199', claro: '#a2d5d8', secundario: '#64a2ad' };
/** Paleta anterior, disponible como alternativa. */
export const TEMA_LAVANDA: ColoresTema = { principal: '#554d74', acento: '#a6a9c8', base: '#d3d9e9', claro: '#a6a9c8', secundario: '#796ea8' };
export const PALETAS_PREDEFINIDAS: { id: string; nombre: string; colores: ColoresTema }[] = [
  { id: 'lanita', nombre: 'Lanita (verde oliva y beige)', colores: TEMA_LANITA },
  { id: 'topo', nombre: 'Gris topo y crema', colores: TEMA_TOPO },
  { id: 'naranja', nombre: 'Naranja y turquesa', colores: TEMA_NARANJA },
  { id: 'lavanda', nombre: 'Lavanda', colores: TEMA_LAVANDA },
];

const HEX = /^#[0-9a-fA-F]{6}$/;
export const esHex = (s: unknown): s is string => typeof s === 'string' && HEX.test(s);

/** Devuelve una paleta válida: cualquier valor faltante o inválido se reemplaza por el de Lanita. */
export function normalizarTema(entrada: unknown): ColoresTema {
  const e = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, unknown>;
  const salida = { ...TEMA_LANITA };
  for (const k of CLAVES_COLOR) if (esHex(e[k])) salida[k] = (e[k] as string).toLowerCase();
  return salida;
}

type RGB = [number, number, number];
const aRgb = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const aHex = ([r, g, b]: RGB) => '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
const mezclar = (a: string, b: string, t: number) => {
  const x = aRgb(a), y = aRgb(b);
  return aHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
};
const luz = (h: string) => {
  const [r, g, b] = aRgb(h).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }) as RGB;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** Relación de contraste WCAG entre dos colores (1 a 21). */
export const contraste = (a: string, b: string) => {
  const la = luz(a), lb = luz(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

export type EscalaTema = Record<'50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900', string>;

export function generarEscala(entrada: ColoresTema): EscalaTema {
  const c = normalizarTema(entrada);
  let principal = c.principal;
  // Los botones llevan texto blanco: se oscurece el principal hasta alcanzar contraste AA (4.5:1).
  for (let i = 0; i < 14 && contraste(principal, '#ffffff') < 4.5; i++) principal = mezclar(principal, '#000000', 0.07);
  // Fondo de la página: el color base, aclarado solo si es demasiado oscuro para servir de fondo.
  let fondo = c.base;
  for (let i = 0; i < 14 && luz(fondo) < 0.6; i++) fondo = mezclar(fondo, '#ffffff', 0.1);
  return {
    '50': mezclar(fondo, '#ffffff', 0.9),           // tarjetas y contenedor (casi blanco)
    '100': fondo,                                   // fondo de la página
    '200': luz(fondo) < 0.75 ? mezclar(fondo, '#ffffff', 0.55) : mezclar(fondo, '#000000', 0.05), // rellenos suaves y fondo de fotos
    '300': mezclar(c.claro, c.secundario, 0.4),     // bordes
    '400': c.secundario,                            // iconos inactivos
    '500': mezclar(c.secundario, principal, 0.5),
    '600': mezclar(principal, '#ffffff', 0.12),
    '700': principal,                               // botones, barras
    '800': mezclar(principal, '#000000', 0.25),     // texto secundario
    '900': mezclar(principal, '#000000', 0.78),     // texto principal
  };
}

/** "#b84f0b" -> "184 79 11" (formato que usa Tailwind con variables CSS y opacidad). */
export const aTripleta = (h: string) => aRgb(h).join(' ');

/** CSS con las variables del tema. Solo contiene números calculados: no puede inyectar contenido arbitrario. */
export function cssDelTema(entrada: unknown): string {
  const c = normalizarTema(entrada);
  const e = generarEscala(c);
  const vars = (Object.keys(e) as (keyof EscalaTema)[]).map((k) => `--lana-${k}:${aTripleta(e[k])}`);
  vars.push(`--acento:${aTripleta(c.acento)}`, `--claro:${aTripleta(c.claro)}`);
  return `:root{${vars.join(';')}}`;
}
