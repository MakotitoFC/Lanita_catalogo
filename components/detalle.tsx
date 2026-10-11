'use client';

import Image from 'next/image';
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { CalendarDays, MessageCircle, ShoppingBag, X } from 'lucide-react';
import { vigencia } from '@/lib/fechas';
import type { Categoria, ItemCatalogo, Promocion } from '@/lib/data';
import { useLista } from './lista';

type Ctx = { abrir: (clave: string) => boolean; abrirPromo: (p: Promocion) => boolean };
const DetalleCtx = createContext<Ctx | null>(null);

/** Si no hay proveedor (p. ej. en una página de detalle) no hace nada y el enlace funciona normal. */
export const useDetalle = (): Ctx => useContext(DetalleCtx) ?? { abrir: () => false, abrirPromo: () => false };

/**
 * Clic normal => abre el modal. Ctrl/Cmd/Shift/clic central => se deja al navegador (abre la página en otra pestaña).
 * Los enlaces mantienen su href real, así que también funcionan sin JavaScript y para buscadores.
 */
export function manejarClic(e: React.MouseEvent, abrir: () => boolean) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (abrir()) e.preventDefault();
}

/** Lo que muestra el modal: puede ser un producto/combo o una oferta sin producto. */
type Contenido = {
  clave: string;
  nombre: string;
  categoria: string | null;
  precio: number | null;
  fotos: string[];
  esCombo: boolean;
  agotado: boolean;
  descripcion: string | null;
  specs: [string, string][];
  incluye: { nombre: string; cantidad: number }[];
  ruta: string | null;
  oferta: { vigencia: string; titulo: string; descripcion: string | null; imagen: string | null } | null;
  accion: { tipo: 'agregar'; id: string; nombre: string; precio: number; ruta: string } | { tipo: 'consultar' };
};

function deProducto(i: ItemCatalogo, categoria: string | null, oferta: Contenido['oferta']): Contenido {
  const base = deProductoBase(i, categoria, oferta);
  if (!oferta) return base;
  // Una oferta muestra SU título, foto y texto; el producto enlazado queda como referencia y es lo que se agrega a la consulta.
  return { ...base, nombre: oferta.titulo, categoria: `Producto: ${i.nombre}`, fotos: [...(oferta.imagen ? [oferta.imagen] : []), ...base.fotos.filter((f) => f !== oferta.imagen)], descripcion: oferta.descripcion ?? base.descripcion };
}

function deProductoBase(i: ItemCatalogo, categoria: string | null, oferta: Contenido['oferta']): Contenido {
  return {
    clave: i.id, nombre: i.nombre, categoria: i.es_combo ? 'Combo' : categoria, precio: Number(i.precio),
    fotos: i.fotos && i.fotos.length ? i.fotos : i.imagen ? [i.imagen] : [],
    esCombo: i.es_combo, agotado: !i.disponible,
    descripcion: i.descripcion ?? i.descripcion_corta ?? null,
    specs: [
      ['Material', i.material],
      ...(i.dimensiones ? [['Medidas', i.dimensiones] as [string, string]] : []),
      ...(i.bajo_pedido && i.tiempo_elaboracion_dias != null ? [['Elaboración', `${i.tiempo_elaboracion_dias} días aprox.`] as [string, string]] : []),
    ],
    incluye: i.incluye ?? [], ruta: i.ruta, oferta,
    accion: { tipo: 'agregar', id: i.id, nombre: i.nombre, precio: Number(i.precio), ruta: i.ruta },
  };
}

function dePromo(p: Promocion): Contenido {
  return {
    clave: 'promo-' + p.id, nombre: p.titulo, categoria: 'Oferta', precio: null, fotos: p.imagen_url ? [p.imagen_url] : [],
    esCombo: false, agotado: false, descripcion: p.descripcion, specs: [], incluye: [], ruta: null,
    oferta: { vigencia: vigencia(p.fecha_inicio, p.fecha_fin), titulo: p.titulo, descripcion: null, imagen: p.imagen_url },
    accion: { tipo: 'consultar' },
  };
}

export function DetalleProvider({ items, categorias, simbolo, children }: {
  items: ItemCatalogo[]; categorias: Categoria[]; simbolo: string; children: React.ReactNode;
}) {
  const [actual, setActual] = useState<Contenido | null>(null);
  const nombreCategoria = useMemo(() => new Map(categorias.map((c) => [c.id, c.nombre])), [categorias]);

  const abrir = useCallback((clave: string) => {
    const it = items.find((i) => i.id === clave || i.slug === clave);
    if (!it) return false;
    setActual(deProducto(it, nombreCategoria.get(it.categoria_id) ?? null, null));
    return true;
  }, [items, nombreCategoria]);

  // Una oferta abre el detalle del producto enlazado (con la etiqueta de vigencia) o, si no tiene producto, su propio detalle.
  const abrirPromo = useCallback((p: Promocion) => {
    const it = p.producto_slug ? items.find((i) => i.slug === p.producto_slug) : undefined;
    if (!it) { setActual(dePromo(p)); return true; }
    setActual(deProducto(it, nombreCategoria.get(it.categoria_id) ?? null, { vigencia: vigencia(p.fecha_inicio, p.fecha_fin), titulo: p.titulo, descripcion: p.descripcion, imagen: p.imagen_url }));
    return true;
  }, [items, nombreCategoria]);

  const valor = useMemo(() => ({ abrir, abrirPromo }), [abrir, abrirPromo]);

  return (
    <DetalleCtx.Provider value={valor}>
      {children}
      {actual && <ModalDetalle key={actual.clave} c={actual} simbolo={simbolo} onCerrado={() => setActual(null)} />}
    </DetalleCtx.Provider>
  );
}

function ModalDetalle({ c, simbolo, onCerrado }: { c: Contenido; simbolo: string; onCerrado: () => void }) {
  const { agregar, setAbierto } = useLista();
  const idTitulo = useId();
  const [visible, setVisible] = useState(false);
  const [dy, setDy] = useState(0);
  const [arrastrando, setArrastrando] = useState(false);
  const [foto, setFoto] = useState(0);
  const dialogo = useRef<HTMLDivElement>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const gesto = useRef<{ y: number; t: number } | null>(null);

  const cerrar = useCallback(() => {
    setVisible(false);
    setDy(0);
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(onCerrado, 280);   // espera la animación de salida
  }, [onCerrado]);

  // Entrada animada, bloqueo del scroll de fondo y manejo del foco.
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    dialogo.current?.focus();
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(temporizador.current);
      document.documentElement.style.overflow = overflow;
      previo?.focus?.();
    };
  }, []);

  function alTeclado(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.stopPropagation(); cerrar(); return; }
    if (e.key !== 'Tab') return;
    const f = dialogo.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (!f || !f.length) return;
    const primero = f[0]!, ultimo = f[f.length - 1]!;
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  }

  // Barra de arrastre (solo celular): arrastrar hacia abajo cierra la hoja.
  function soltar(e: React.PointerEvent, cancelado = false) {
    const g = gesto.current;
    if (!g) return;
    gesto.current = null;
    setArrastrando(false);
    const d = Math.max(0, e.clientY - g.y);
    const velocidad = d / Math.max(1, performance.now() - g.t);
    if (!cancelado && (d > 110 || (d > 40 && velocidad > 0.6))) cerrar(); else setDy(0);
  }

  function accionPrincipal() {
    if (c.accion.tipo === 'agregar') agregar({ id: c.accion.id, nombre: c.accion.nombre, precio: c.accion.precio, ruta: c.accion.ruta });   // abre el panel de la consulta
    else setAbierto(true);
    cerrar();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" onKeyDown={alTeclado}>
      <div
        aria-hidden="true"
        onClick={cerrar}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 motion-reduce:transition-none ${visible ? 'opacity-100' : 'opacity-0'}`}
      />

      <div
        ref={dialogo}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        style={dy > 0 ? { transform: `translateY(${dy}px)` } : undefined}
        className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl outline-none motion-reduce:transition-none sm:max-h-[88vh] sm:max-w-4xl sm:rounded-3xl
          ${arrastrando ? 'transition-none' : 'transition duration-300 ease-out'}
          ${visible ? 'translate-y-0 sm:scale-100 sm:opacity-100' : 'translate-y-full sm:translate-y-0 sm:scale-95 sm:opacity-0'}`}
      >
        {/* Barra de arrastre (celular) */}
        <div
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); gesto.current = { y: e.clientY, t: performance.now() }; setArrastrando(true); }}
          onPointerMove={(e) => { if (gesto.current) setDy(Math.max(0, e.clientY - gesto.current.y)); }}
          onPointerUp={(e) => soltar(e)}
          onPointerCancel={(e) => soltar(e, true)}
          role="presentation"
          className="flex h-8 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing sm:hidden"
        >
          <span className="h-1.5 w-12 rounded-full bg-lana-300" aria-hidden="true" />
        </div>

        {/* Escritorio: la X va en la esquina del modal */}
        <button type="button" onClick={cerrar} aria-label="Cerrar detalle"
                className="absolute right-4 top-4 z-10 hidden h-10 w-10 items-center justify-center rounded-full bg-foto text-lana-900 transition-colors hover:bg-lana-200 sm:flex">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden overscroll-contain px-4 pb-6 sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2 sm:gap-8">
            <div className="min-w-0">
              <div className="relative aspect-square overflow-hidden rounded-3xl bg-foto">
                <button type="button" onClick={cerrar} aria-label="Cerrar detalle"
                        className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-foto text-lana-900 shadow-sm transition-colors hover:bg-lana-200 sm:hidden">
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
                {c.fotos[foto] ? (
                  <Image src={c.fotos[foto]!} alt={c.nombre} fill priority sizes="(min-width:640px) 400px, 100vw" className={`object-cover ${c.agotado ? 'grayscale' : ''}`} />
                ) : (
                  <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-6xl font-semibold text-lana-800/40">{c.nombre.charAt(0).toUpperCase()}</div>
                )}
                {c.precio != null && (
                  <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1">
                    {c.esCombo && <span className="rounded-full bg-lana-700 px-3 py-1 text-xs font-semibold text-lana-50">Combo</span>}
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${c.agotado ? 'bg-neutral-500' : 'bg-lana-700'}`}>{c.agotado ? 'Agotado' : 'Disponible'}</span>
                  </div>
                )}
              </div>
              {c.fotos.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {c.fotos.map((f, i) => (
                    <button key={f + i} type="button" onClick={() => setFoto(i)} aria-label={`Ver foto ${i + 1}`} aria-current={i === foto}
                            className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-foto ${i === foto ? 'ring-2 ring-lana-700' : ''}`}>
                      <Image src={f} alt="" fill sizes="64px" className="object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="min-w-0 sm:pr-10">
              {/* Etiqueta (no es un botón): período en que está vigente la oferta */}
              {c.oferta && (
                <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-acento px-3 py-1 text-xs font-semibold text-lana-900">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Oferta · {c.oferta.vigencia}
                </span>
              )}
              {c.categoria && <p className="text-sm text-lana-800">{c.categoria}</p>}
              <h2 id={idTitulo} className="mt-0.5 text-2xl font-semibold leading-tight sm:text-3xl">{c.nombre}</h2>
              {c.precio != null && <p className="mt-2 text-2xl font-semibold text-precio">{simbolo}{c.precio.toFixed(2)}</p>}
              {c.agotado && <p className="mt-2 text-sm text-peligro">Agotado por ahora. Agrégalo a tu consulta y te avisamos la disponibilidad.</p>}
              {c.descripcion && <p className="mt-4 whitespace-pre-line text-sm text-lana-800 sm:text-base">{c.descripcion}</p>}

              {c.specs.length > 0 && (
                <dl className="mt-5 divide-y divide-lana-300 border-y border-lana-300 text-sm">
                  {c.specs.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 py-2"><dt className="text-lana-800">{k}</dt><dd className="text-right">{v}</dd></div>
                  ))}
                </dl>
              )}

              {c.incluye.length > 0 && (
                <div className="mt-5">
                  <h3 className="mb-1 text-base font-semibold">Incluye</h3>
                  <ul className="space-y-1 text-sm text-lana-800">
                    {c.incluye.map((i) => <li key={i.nombre}>{i.cantidad} × {i.nombre}</li>)}
                  </ul>
                </div>
              )}

              <div className="mt-6 space-y-1">
                <button type="button" onClick={accionPrincipal} className="btn btn-primario w-full gap-2">
                  {c.accion.tipo === 'agregar'
                    ? <><ShoppingBag className="h-4 w-4" aria-hidden="true" /> Agregar a mi consulta</>
                    : <><MessageCircle className="h-4 w-4" aria-hidden="true" /> Consultar por esta oferta</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
