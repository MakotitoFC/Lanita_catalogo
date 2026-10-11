'use client';

import { useMemo, useState } from 'react';
import type { Categoria, ItemCatalogo } from '@/lib/data';
import { TarjetaProducto } from '@/components/tarjetas';
import { Selector, type OpcionSelector } from '@/components/selector';

/** Catálogo: título, selector del tipo de producto y cuadrícula. Solo datos reales del negocio. */
export default function CatalogoCliente({ items, categorias, simbolo }: { items: ItemCatalogo[]; categorias: Categoria[]; simbolo: string }) {
  const [filtro, setFiltro] = useState<string>('todos');

  // Un combo es un producto marcado "Es combo" o que está en la categoría "Combos".
  const idCategoriaCombos = categorias.find((c) => c.slug === 'combos')?.id;
  const esCombo = useMemo(() => (i: ItemCatalogo) => i.es_combo || (!!idCategoriaCombos && i.categoria_id === idCategoriaCombos), [idCategoriaCombos]);
  const tipos = useMemo(() => categorias.filter((c) => c.slug !== 'combos'), [categorias]);
  const nombreCategoria = useMemo(() => new Map(categorias.map((c) => [c.id, c.nombre])), [categorias]);

  const opciones: OpcionSelector[] = useMemo(() => [
    { id: 'todos', texto: 'Todos los productos', cantidad: items.length },
    ...tipos.map((c) => ({ id: c.id, texto: c.nombre, cantidad: items.filter((i) => !esCombo(i) && i.categoria_id === c.id).length })).filter((o) => o.cantidad > 0), // sin tipos vacíos
    { id: 'combos', texto: 'Combos', cantidad: items.filter(esCombo).length },
  ], [items, tipos, esCombo]);

  const lista = useMemo(() => items.filter((i) =>
    filtro === 'todos' ? true : filtro === 'combos' ? esCombo(i) : !esCombo(i) && i.categoria_id === filtro), [items, filtro, esCombo]);

  return (
    <section aria-labelledby="titulo-catalogo">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 sm:mb-8">
        <h2 id="titulo-catalogo" className="text-xl font-semibold sm:text-3xl">
          Nuestros <span className="text-lana-700">productos</span>
        </h2>
        <Selector etiqueta="Tipo de producto" valor={filtro} opciones={opciones} onChange={setFiltro} />
      </div>

      {lista.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-lana-300 bg-lana-50 px-4 py-12 text-center text-sm text-lana-800">
          {filtro === 'combos' ? 'Aún no hay combos publicados.' : 'No hay productos en esta sección por ahora.'}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-3">
          {lista.map((p, i) => (
            <TarjetaProducto key={p.id} id={p.id} nombre={p.nombre} descripcion={p.descripcion_corta} precio={Number(p.precio)}
                             categoria={esCombo(p) ? 'Combo' : nombreCategoria.get(p.categoria_id)} simbolo={simbolo}
                             imagen={p.imagen} href={p.ruta} agotado={!p.disponible} combo={esCombo(p)} prioridad={i < 3} />
          ))}
        </div>
      )}
    </section>
  );
}
