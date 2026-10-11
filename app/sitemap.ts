import type { MetadataRoute } from 'next';
import { getCombos, getProductos, SITE_URL } from '@/lib/data';

export const revalidate = 600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [productos, combos] = await Promise.all([getProductos(), getCombos()]);
  const fijas = [''].map((r) => ({ url: `${SITE_URL}${r}`, changeFrequency: 'weekly' as const }));
  return [
    ...fijas,
    ...productos.map((p) => ({ url: `${SITE_URL}/catalogo/${p.slug}`, lastModified: p.updated_at })),
    ...combos.map((c) => ({ url: `${SITE_URL}/combos/${c.slug}`, lastModified: c.updated_at })),
  ];
}
