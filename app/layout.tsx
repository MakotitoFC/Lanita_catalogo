import type { Metadata, Viewport } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Poppins, Yellowtail } from 'next/font/google';
import './globals.css';
import { getConfig, SITE_URL } from '@/lib/data';
import { ListaProvider } from '@/components/lista';
import { BurbujaConsulta } from '@/components/consulta';
import { cssDelTema } from '@lanita/shared';

// Poppins autoalojada por Next (sin pedir nada a Google desde el navegador del visitante).
const poppins = Poppins({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700'], display: 'swap', variable: '--font-poppins' });

// Letra manuscrita parecida a la del logo, solo para el nombre del negocio en el encabezado.
const manuscrita = Yellowtail({ subsets: ['latin'], weight: '400', display: 'swap', variable: '--font-manuscrita' });

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const cfg = await getConfig();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `${cfg.nombre_negocio} · ${cfg.eslogan ?? 'Decoración artesanal'}`, template: `%s · ${cfg.nombre_negocio}` },
    description: cfg.descripcion_corta ?? 'Decoración artesanal en cemento, hecha a mano.',
    openGraph: { type: 'website', siteName: cfg.nombre_negocio, locale: 'es_ES' },
    robots: { index: true, follow: true },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const cfg = await getConfig();
  return { width: 'device-width', initialScale: 1, themeColor: '#ffffff' };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cfg = await getConfig();
  return (
    <html lang="es" className={`${poppins.variable} ${manuscrita.variable}`}>
      <head>
        {/* Colores del sitio (configurables desde el APK). Solo contiene números calculados y validados. */}
        <style dangerouslySetInnerHTML={{ __html: cssDelTema(cfg.tema_colores) }} />
      </head>
      <body className="flex min-h-screen flex-col font-sans">
        <ListaProvider>
          <header className="sticky top-0 z-30 border-b border-lana-300 bg-white/95 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center px-4 py-3">
              <Link href="/" aria-label={`Catálogo ${cfg.nombre_negocio}: ir al inicio`} className="inline-flex min-h-[44px] min-w-0 items-center gap-3">
                <span className="text-xl font-semibold text-lana-900 sm:text-2xl">Catálogo</span>
                <span aria-hidden="true" className="h-6 w-px bg-lana-300 sm:h-7" />
                <span className="truncate font-script text-4xl leading-none text-lana-700 sm:text-5xl">{cfg.nombre_negocio}</span>
              </Link>
            </div>
          </header>

          <div className="relative flex flex-1 flex-col">
            <main className="relative mx-auto w-full max-w-6xl flex-1 px-4 pb-12 pt-4 sm:pb-16 sm:pt-6">{children}</main>
          </div>

          <footer className="bg-lana-700 px-4 py-6 text-center text-sm text-lana-50">
            <p>© 2026 Maria Caffo. Derechos reservados.</p>
          </footer>

          {cfg.web_mostrar_burbuja !== false && <BurbujaConsulta negocio={cfg.nombre_negocio} simbolo={cfg.moneda_simbolo} numero={cfg.whatsapp_numero} siteUrl={SITE_URL} />}
        </ListaProvider>
      </body>
    </html>
  );
}
