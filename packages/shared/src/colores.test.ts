import { describe, expect, it } from 'vitest';
import tema from './tema.json';
import { CLAVES_COLOR, PALETAS_PREDEFINIDAS, TEMA_LANITA, TEMA_LAVANDA, TEMA_NARANJA, TEMA_TOPO, contraste, cssDelTema, esHex, generarEscala, normalizarTema } from './colores';

describe('paleta configurable', () => {
  it('tema.json (usado por Tailwind y el APK) coincide con la paleta oficial', () => {
    expect(tema.lana).toEqual(generarEscala(TEMA_LANITA));
  });
  it('el verde oliva de las capturas se oscurece lo justo para que el texto blanco se lea', () => {
    const e = generarEscala(TEMA_LANITA);
    expect(contraste(e['700'], '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contraste(TEMA_LANITA.principal, e['700'])).toBeLessThan(1.4); // sigue siendo el mismo verde, apenas más oscuro
  });
  it('en TODAS las paletas el texto se lee bien sobre el fondo y sobre las tarjetas', () => {
    for (const p of PALETAS_PREDEFINIDAS) {
      const e = generarEscala(p.colores);
      expect(contraste(e['900'], e['100']), p.id + ' 900/100').toBeGreaterThanOrEqual(7);
      expect(contraste(e['800'], e['100']), p.id + ' 800/100').toBeGreaterThanOrEqual(4.5);
      expect(contraste(e['800'], e['50']), p.id + ' 800/50').toBeGreaterThanOrEqual(4.5);
      expect(contraste(e['700'], '#ffffff'), p.id + ' 700/blanco').toBeGreaterThanOrEqual(4.5);
    }
  });
  it('el fondo exterior es el beige grisáceo de la captura y las tarjetas son casi blancas', () => {
    const e = generarEscala(TEMA_LANITA);
    expect(e['100']).toBe('#d4d4c9');
    expect(contraste(e['50'], '#ffffff')).toBeLessThan(1.1);
    expect(contraste(e['200'], '#ffffff')).toBeLessThan(contraste(e['100'], '#ffffff')); // fotos más claras que el fondo
  });
  it('incluye el marco claro (--claro) y el acento ámbar en el CSS', () => {
    const css = cssDelTema(TEMA_LANITA);
    expect(css).toContain('--claro:233 234 226');
    expect(css).toContain('--acento:252 184 72');
    expect(TEMA_TOPO.base).toBe('#ede9e2');
  });
  it('oscurece un principal demasiado claro para mantener el contraste de los botones', () => {
    const e = generarEscala({ ...TEMA_LANITA, principal: '#f2c94c' });
    expect(contraste(e['700'], '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
  it('funciona con otras paletas (lavanda)', () => {
    const e = generarEscala(TEMA_LAVANDA);
    expect(contraste(e['700'], '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contraste(e['900'], e['100'])).toBeGreaterThanOrEqual(7);
  });
  it('normaliza entradas inválidas sin romper nada', () => {
    expect(normalizarTema(null)).toEqual(TEMA_LANITA);
    expect(normalizarTema({ principal: 'rojo', acento: 'url(javascript:alert(1))', base: '#ABCDEF' }).base).toBe('#abcdef');
    expect(normalizarTema({ principal: 'rojo' }).principal).toBe(TEMA_LANITA.principal);
    expect(TEMA_NARANJA.principal).toBe('#b84f0b');
    expect(esHex('#12ab34')).toBe(true);
    expect(esHex('#12ab3')).toBe(false);
  });
  it('el CSS generado solo contiene variables y números (sin inyección)', () => {
    const css = cssDelTema({ principal: '#b84f0b', acento: '};body{display:none}/*', base: 'x', claro: 'y', secundario: 'z' });
    expect(css).toMatch(/^:root\{(--[a-z0-9-]+:\d{1,3} \d{1,3} \d{1,3};?)+\}$/);
    expect(css).not.toContain('display');
  });
  it('define las 5 claves esperadas', () => {
    expect([...CLAVES_COLOR].sort()).toEqual(['acento', 'base', 'claro', 'principal', 'secundario']);
  });
});
