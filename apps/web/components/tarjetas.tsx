'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Maximize2 } from 'lucide-react';
import { BotonIconoAgregar } from './lista';
import { manejarClic, useDetalle } from './detalle';

// Tarjeta del catálogo. No importa nada del servidor (se usa también desde componentes cliente).
// Solo muestra datos reales del producto: categoría, nombre, descripción corta y precio.

function SinFoto({ nombre }: { nombre: string }) {
  return (
    <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-white/60 text-5xl font-semibold text-lana-800/50">
      {nombre.trim().charAt(0).toUpperCase()}
    </div>
  );
}

export type DatosTarjeta = {
  id: string; nombre: string; descripcion?: string | null; categoria?: string | null; precio: number; simbolo: string;
  imagen?: string | null; href: string; agotado?: boolean; combo?: boolean; prioridad?: boolean;
};

export function TarjetaProducto({ id, nombre, descripcion, categoria, precio, simbolo, imagen, href, agotado, combo, prioridad }: DatosTarjeta) {
  const { abrir } = useDetalle();
  const alAbrir = (e: React.MouseEvent) => manejarClic(e, () => abrir(id));
  return (
    <article className={`group relative min-w-0 overflow-hidden rounded-3xl p-2 sm:p-3 ${agotado ? 'bg-[#dcdcdc]' : 'bg-foto'}`}>
      {/* Sello: logo grande y tenue sobre la tarjeta, asomando por la esquina inferior derecha (decorativo, no bloquea clics) */}
      <Image src="/marca-agua.webp" alt="" aria-hidden="true" width={400} height={400} sizes="300px" className="pointer-events-none absolute -bottom-6 -right-6 z-10 h-auto w-3/5 -rotate-12 opacity-[0.25] mix-blend-multiply" />

      <div className="relative aspect-square overflow-hidden rounded-2xl bg-white/60">
<div aria-hidden="true" className="absolute inset-0 animate-pulse bg-neutral-200/70" />
        <Link href={href} onClick={alAbrir} aria-label={`Ver ${nombre}`} className="absolute inset-0">
          {imagen ? (
            <Image src={imagen} alt={nombre} fill priority={prioridad} sizes="(min-width:1024px) 370px, (min-width:640px) 33vw, 50vw"
                   className={`object-cover transition duration-500 group-hover:scale-105 ${agotado ? 'grayscale' : ''}`} />
          ) : <SinFoto nombre={nombre} />}
        </Link>

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1">
          {combo && <span className="rounded-full bg-lana-700 px-3 py-1 text-xs font-semibold text-lana-50">Combo</span>}
          <span className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${agotado ? 'bg-neutral-500' : 'bg-lana-700'}`}>{agotado ? 'Agotado' : 'Disponible'}</span>
        </div>

        <div className="absolute right-3 top-3 flex flex-col gap-2">
          <Link href={href} onClick={alAbrir} aria-label={`Ver detalle de ${nombre}`} title="Ver detalle"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-lana-900 shadow-sm transition hover:bg-white">
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          </Link>
          <BotonIconoAgregar id={id} nombre={nombre} precio={precio} ruta={href} />
        </div>
      </div>

      <Link href={href} onClick={alAbrir} className={`relative mt-3 block px-2 pb-2 ${agotado ? 'text-neutral-600' : ''}`}>
        {categoria && <p className="truncate text-xs text-lana-800 sm:text-sm">{categoria}</p>}
        <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug sm:text-base">{nombre}</h3>
        {descripcion && <p className="mt-0.5 line-clamp-1 text-xs text-lana-800 sm:text-sm">{descripcion}</p>}
        <p className={`mt-1.5 text-base font-semibold sm:text-lg ${agotado ? 'text-neutral-500' : 'text-precio'}`}>{simbolo}{Number(precio).toFixed(2)}</p>
      </Link>
    </article>
  );
}
