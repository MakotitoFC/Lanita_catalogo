import type { Promocion } from '@/lib/data';
import { CarruselOfertas } from './carrusel-ofertas';
import { TituloOfertas } from './titulo-ofertas';

/** Sección superior de la portada ("Ofertas del mes"). Sin promociones vigentes muestra el mensaje por defecto. */
export function SeccionPromociones({ promociones }: { promociones: Promocion[] }) {
  return (
    <section id="promociones" aria-labelledby="titulo-promociones">
      {promociones.length === 0 ? (
        <>
          <div className="mb-3"><TituloOfertas /></div>
          <p className="rounded-2xl border border-dashed border-lana-300 bg-lana-50 px-4 py-5 text-center text-sm text-lana-800">
            Por ahora no hay promociones.
          </p>
        </>
      ) : (
        <CarruselOfertas promociones={promociones} />
      )}
    </section>
  );
}
