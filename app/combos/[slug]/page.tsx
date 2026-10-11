import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getCombo, getCombos, getConfig, precio, SITE_URL } from '@/lib/data';
import { BotonAgregar } from '@/components/lista';

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await getCombos()).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await getCombo(slug);
  if (!d) return {};
  const img = d.fotos[0]?.imagen_url ?? d.combo.imagen_url;
  const desc = d.combo.seo_descripcion ?? d.combo.descripcion_corta ?? undefined;
  return {
    title: d.combo.seo_titulo ?? d.combo.nombre,
    description: desc,
    alternates: { canonical: `${SITE_URL}/combos/${d.combo.slug}` },
    openGraph: { title: d.combo.nombre, description: desc, images: img ? [{ url: img }] : [] },
  };
}

export default async function ComboPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [d, cfg] = await Promise.all([getCombo(slug), getConfig()]);
  if (!d) notFound();
  const { combo, fotos, items } = d;

  // Galería propia del combo primero; solo si no hay fotos se usa la imagen del producto.
  const galeria = fotos.length
    ? fotos.map((f) => ({ src: f.imagen_url, alt: f.alt_text ?? `${combo.nombre}${f.tematica ? ` · ${f.tematica}` : ''}`, tematica: f.tematica }))
    : combo.imagen_url ? [{ src: combo.imagen_url, alt: combo.nombre, tematica: null as string | null }] : [];
  const [principal, ...resto] = galeria;
  const tematicas = [...new Set(galeria.map((g) => g.tematica).filter(Boolean))];

  return (
    <article>
      <Link href="/" aria-label="Volver al catálogo" className="mb-4 inline-flex min-h-[44px] items-center gap-1 text-base font-medium text-lana-800 hover:text-lana-900">
        <ChevronLeft className="h-5 w-5" aria-hidden="true" /> Catálogo
      </Link>

      <div className="grid gap-6 md:grid-cols-2 md:gap-10">
        {/* Galería: foto principal grande y miniaturas debajo */}
        <div className="min-w-0">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-foto">
            {principal ? (
              <Image src={principal.src} alt={principal.alt} fill priority sizes="(min-width:768px) 50vw, 100vw" className="object-cover" />
            ) : (
              <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-foto text-7xl font-semibold text-lana-600/70">{combo.nombre.charAt(0).toUpperCase()}</div>
            )}
          </div>
          {resto.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {resto.map((f, i) => (
                <div key={f.src + i} className="relative aspect-square overflow-hidden rounded-2xl bg-foto">
                  <Image src={f.src} alt={f.alt} fill sizes="(min-width:768px) 12vw, 33vw" className="object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <h1 className="text-3xl sm:text-4xl">{combo.nombre}</h1>
          <p className="mt-3 inline-block rounded-2xl border border-lana-300 bg-lana-50 px-4 py-2 text-xl font-semibold text-precio">{precio(combo.precio, cfg)}</p>
          {tematicas.length > 0 && <p className="mt-3 text-sm text-lana-800">Temática: {tematicas.join(', ')}</p>}
          {combo.descripcion && <p className="mt-5 whitespace-pre-line text-sm text-lana-800 sm:text-base">{combo.descripcion}</p>}

          {items.length > 0 && (
            <div className="mt-6 border-y border-lana-200 py-4">
              <h2 className="mb-2 text-lg">Incluye</h2>
              <ul className="space-y-1 text-sm text-lana-800">
                {items.map((i) => <li key={i.producto_id}>{i.cantidad} × {i.producto_nombre}</li>)}
              </ul>
            </div>
          )}

          <div className="mt-6 max-w-sm">
            <BotonAgregar id={combo.id} nombre={combo.nombre} precio={combo.precio} ruta={`/combos/${combo.slug}`} etiqueta="Agregar a mi consulta" className="w-full" />
          </div>
        </div>
      </div>
    </article>
  );
}
