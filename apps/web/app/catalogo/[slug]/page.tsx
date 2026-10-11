import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getConfig, getProducto, getProductos, precio, SITE_URL } from '@/lib/data';
import { BotonAgregar } from '@/components/lista';

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await getProductos()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProducto(slug);
  if (!p) return {};
  const desc = p.seo_descripcion ?? p.descripcion_corta ?? undefined;
  return {
    title: p.seo_titulo ?? p.nombre,
    description: desc,
    alternates: { canonical: `${SITE_URL}/catalogo/${p.slug}` },
    openGraph: { title: p.nombre, description: desc, images: p.imagen_url ? [{ url: p.imagen_url }] : [], type: 'website' },
  };
}

export default async function ProductoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [p, cfg] = await Promise.all([getProducto(slug), getConfig()]);
  if (!p) notFound();

  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.nombre, description: p.descripcion_corta ?? p.descripcion ?? undefined,
    image: p.imagen_url ?? undefined,
    offers: { '@type': 'Offer', priceCurrency: cfg.moneda, price: p.precio, availability: p.disponible ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' },
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <Link href="/" aria-label="Volver al catálogo" className="mb-4 inline-flex min-h-[44px] items-center gap-1 text-base font-medium text-lana-800 hover:text-lana-900">
        <ChevronLeft className="h-5 w-5" aria-hidden="true" /> Catálogo
      </Link>

      <div className="grid gap-6 md:grid-cols-2 md:gap-10">
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-foto">
          {p.imagen_url ? (
            <Image src={p.imagen_url} alt={p.nombre} fill priority sizes="(min-width:768px) 50vw, 100vw" className="object-cover" />
          ) : (
            <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-foto text-7xl font-semibold text-lana-600/70">{p.nombre.charAt(0).toUpperCase()}</div>
          )}
          {!p.disponible && <span className="absolute left-3 top-3 rounded-2xl bg-lana-900 px-3 py-1 text-xs text-lana-50">Agotado</span>}
        </div>

        <div className="min-w-0">
          <h1 className="text-3xl sm:text-4xl">{p.nombre}</h1>
          <p className="mt-3 inline-block rounded-2xl border border-lana-300 bg-lana-50 px-4 py-2 text-xl font-semibold text-precio">{precio(p.precio, cfg)}</p>
          {!p.disponible && <p className="mt-3 text-sm text-peligro">Agotado por ahora. Agrégalo a tu consulta y te avisamos la disponibilidad.</p>}
          {p.descripcion && <p className="mt-5 whitespace-pre-line text-sm text-lana-800 sm:text-base">{p.descripcion}</p>}

          <dl className="mt-6 divide-y divide-lana-200 border-y border-lana-200 text-sm">
            <div className="flex justify-between gap-4 py-2"><dt className="text-lana-800">Material</dt><dd className="text-right">{p.material}</dd></div>
            {p.dimensiones && <div className="flex justify-between gap-4 py-2"><dt className="text-lana-800">Medidas</dt><dd className="text-right">{p.dimensiones}</dd></div>}
            {p.bajo_pedido && p.tiempo_elaboracion_dias != null && (
              <div className="flex justify-between gap-4 py-2"><dt className="text-lana-800">Elaboración</dt><dd className="text-right">{p.tiempo_elaboracion_dias} días aprox.</dd></div>
            )}
          </dl>

          <div className="mt-6 max-w-sm">
            <BotonAgregar id={p.id} nombre={p.nombre} precio={p.precio} ruta={`/catalogo/${p.slug}`} etiqueta="Agregar a mi consulta" className="w-full" />
          </div>
        </div>
      </div>
    </article>
  );
}
