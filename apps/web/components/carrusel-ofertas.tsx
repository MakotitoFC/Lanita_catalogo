'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Maximize2, Tag } from 'lucide-react';
import type { Promocion } from '@/lib/data';
import { TituloOfertas } from './titulo-ofertas';
import { manejarClic, useDetalle } from './detalle';

/** Ofertas del mes: tarjetas en carrusel con flechas "‹ ›" de solo trazo. El período de vigencia se ve en el detalle (modal). */
export function CarruselOfertas({ promociones }: { promociones: Promocion[] }) {
  const { abrirPromo } = useDetalle();
  const pista = useRef<HTMLDivElement>(null);
  const [extremos, setExtremos] = useState({ inicio: true, final: true });

  const medir = useCallback(() => {
    const el = pista.current;
    if (!el) return;
    setExtremos({ inicio: el.scrollLeft <= 2, final: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  }, []);

  useEffect(() => {
    medir();
    const el = pista.current;
    const ro = typeof ResizeObserver !== 'undefined' && el ? new ResizeObserver(medir) : null;
    if (el && ro) ro.observe(el);
    window.addEventListener('resize', medir);
    return () => { ro?.disconnect(); window.removeEventListener('resize', medir); };
  }, [medir, promociones.length]);

  function mover(dir: 1 | -1) {
    const el = pista.current;
    if (!el) return;
    const tarjeta = el.querySelector('article');
    el.scrollBy({ left: dir * ((tarjeta?.clientWidth ?? el.clientWidth * 0.8) + 16), behavior: 'smooth' });
  }

  const hayMas = !(extremos.inicio && extremos.final);

  return (
    <div role="region" aria-roledescription="carrusel" aria-label="Ofertas del mes">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <TituloOfertas />
          <p className="mt-1 text-sm text-lana-800">Promociones vigentes por tiempo limitado.</p>
        </div>
        {hayMas && (
          <div className="flex shrink-0 gap-2">
            <button type="button" aria-label="Ofertas anteriores" disabled={extremos.inicio} onClick={() => mover(-1)}
                    className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-lana-800 bg-transparent text-lana-800 transition-opacity hover:opacity-70 disabled:opacity-30">
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button type="button" aria-label="Ofertas siguientes" disabled={extremos.final} onClick={() => mover(1)}
                    className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-lana-800 bg-transparent text-lana-800 transition-opacity hover:opacity-70 disabled:opacity-30">
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={pista}
        onScroll={medir}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {promociones.map((p) => {
          const ruta = p.producto_slug ? (p.producto_es_combo ? `/combos/${p.producto_slug}` : `/catalogo/${p.producto_slug}`) : null;
          const alAbrir = (e: React.MouseEvent) => manejarClic(e, () => abrirPromo(p));
          const imagen = p.imagen_url ? (
            <Image src={p.imagen_url} alt={p.titulo} fill sizes="(min-width:1024px) 370px, (min-width:640px) 45vw, 76vw" className="object-cover transition duration-500 group-hover:scale-105" />
          ) : (
            <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-white/60 text-lana-800/50">
              <Tag className="h-14 w-14" />
            </div>
          );
          return (
            <article key={p.id} className="group relative w-[76%] shrink-0 snap-start overflow-hidden rounded-3xl bg-foto p-2 sm:w-[calc(50%-0.5rem)] sm:p-3 lg:w-[calc(33.333%-0.667rem)]">
              <Image src="/marca-agua.webp" alt="" aria-hidden="true" width={400} height={400} sizes="300px" className="pointer-events-none absolute -bottom-6 -right-6 z-10 h-auto w-3/5 -rotate-12 opacity-[0.25] mix-blend-multiply" />
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-white/60">
<div aria-hidden="true" className="absolute inset-0 animate-pulse bg-neutral-200/70" />
                {ruta ? (
                  <Link href={ruta} onClick={alAbrir} aria-label={`Ver ${p.titulo}`} className="absolute inset-0">{imagen}</Link>
                ) : (
                  <button type="button" onClick={() => abrirPromo(p)} aria-label={`Ver ${p.titulo}`} className="absolute inset-0 block">{imagen}</button>
                )}
                <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-lana-700 px-3 py-1 text-xs font-semibold text-lana-50">Oferta</span>
                <button type="button" onClick={() => abrirPromo(p)} aria-label={`Ver detalle de ${p.titulo}`} title="Ver detalle"
                        className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-lana-900 shadow-sm transition hover:bg-white">
                  <Maximize2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="relative mt-3 px-2 pb-2">
                <h3 className="text-base font-semibold leading-snug">{p.titulo}</h3>
                {p.descripcion && <p className="mt-0.5 line-clamp-2 text-sm text-lana-800">{p.descripcion}</p>}
                {ruta ? (
                  <Link href={ruta} onClick={alAbrir} className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-white px-5 text-sm font-semibold text-black shadow-sm transition-colors hover:bg-white/70">
                    Ver producto <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                ) : (
                  <button type="button" onClick={() => abrirPromo(p)} className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-white px-5 text-sm font-semibold text-black shadow-sm transition-colors hover:bg-white/70">
                    Ver oferta <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
