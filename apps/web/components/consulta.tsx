'use client';

import { useEffect, useState } from 'react';
import { Minus, Plus, Send, ShoppingBag, Trash2, X } from 'lucide-react';
import { generarMensajeWhatsApp, normalizarNumero } from '@lanita/shared';
import { useLista } from './lista';

/**
 * Burbuja flotante de consulta. El visitante arma su lista de productos y la envía al WhatsApp del negocio
 * como un mensaje con formato (negritas y emojis) y un enlace por producto.
 * WhatsApp solo permite texto por enlace: no se pueden adjuntar archivos automáticamente.
 */
export function BurbujaConsulta({ negocio, simbolo, numero, siteUrl }: { negocio: string; simbolo: string; numero: string; siteUrl: string }) {
  const { items, total, cantidadTotal, cambiarCantidad, quitar, vaciar, abierto, setAbierto } = useLista();
  const [nombre, setNombre] = useState('');
  const [nota, setNota] = useState('');
  // Cuando el footer entra en pantalla, la burbuja sube lo necesario para quedar siempre encima de él.
  const [subir, setSubir] = useState(0);
  useEffect(() => {
    const calcular = () => {
      const f = document.querySelector('footer');
      if (f) setSubir(Math.max(0, Math.round(window.innerHeight - f.getBoundingClientRect().top)));
    };
    calcular();
    window.addEventListener('scroll', calcular, { passive: true });
    window.addEventListener('resize', calcular);
    return () => { window.removeEventListener('scroll', calcular); window.removeEventListener('resize', calcular); };
  }, []);
  // En celular/tablet la burbuja se esconde al bajar con el dedo para no tapar los productos; vuelve al subir o al detenerse.
  const [oculta, setOculta] = useState(false);
  useEffect(() => {
    let ultimo = window.scrollY;
    let reloj: ReturnType<typeof setTimeout> | undefined;
    const alScroll = () => {
      const y = window.scrollY;
      const delta = y - ultimo;
      ultimo = y;
      if (window.innerWidth >= 1024) { setOculta(false); return; }
      if (delta > 6) setOculta(true);
      else if (delta < -6) setOculta(false);
      clearTimeout(reloj);
      reloj = setTimeout(() => setOculta(false), 1200);
    };
    window.addEventListener('scroll', alScroll, { passive: true });
    return () => { window.removeEventListener('scroll', alScroll); clearTimeout(reloj); };
  }, []);
  const esconder = oculta && !abierto;
  const money = (n: number) => `${simbolo}${n.toFixed(2)}`;
  const puedeEnviar = items.length > 0 || nota.trim().length > 0;

  // La fecha del mensaje es la del momento del clic, por eso el enlace se arma al enviar y no al renderizar.
  const enviar = () => {
    if (!puedeEnviar) return;
    const fecha = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const { url: urlMovil, texto } = generarMensajeWhatsApp(
      {
        tipo: 'lista',
        fecha,
        cliente: nombre.trim() || undefined,
        nota: nota.trim() || undefined,
        items: items.map((i) => ({ nombre: i.nombre, cantidad: i.cantidad, precio: i.precio, url: `${siteUrl}${i.ruta}` })),
      },
      { whatsapp_numero: numero, moneda_simbolo: simbolo, nombre_negocio: negocio },
    );
    // En computadora, wa.me abre la app de escritorio por un protocolo que en Windows puede deformar los emojis (salen como �);
    // WhatsApp Web recibe el texto en UTF-8 y los conserva. En el celular wa.me funciona bien.
    const movil = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const url = movil ? urlMovil : `https://web.whatsapp.com/send?phone=${normalizarNumero(numero)}&text=${encodeURIComponent(texto)}`;
    if (url && urlMovil) window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-end gap-3 px-4 sm:px-5" style={{ paddingBottom: `calc(max(1rem, env(safe-area-inset-bottom)) + ${subir}px)`, ["--subir" as string]: `${subir}px` }}>
      {abierto && (
        <section role="dialog" aria-label="Tu consulta" className="tarjeta pointer-events-auto flex max-h-[calc(100dvh-6.5rem-var(--subir,0px))] w-full max-w-sm flex-col shadow-xl">
          <header className="flex items-center justify-between gap-2 bg-lana-700 py-1 pl-4 pr-1 text-lana-50">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold !text-lana-50">Tu pedido</h2>
            </div>
            <button type="button" aria-label="Cerrar" onClick={() => setAbierto(false)} className="flex h-11 w-11 shrink-0 items-center justify-center">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-lana-100 p-3">
            {items.length === 0 ? (
              <p className="rounded-xl bg-lana-50 p-3 text-sm text-lana-800">
                Aún no hay productos en tu pedido.
              </p>
            ) : (
              <ul className="space-y-2">
                {items.map((i) => (
                  <li key={i.id} className="rounded-xl border border-lana-200 bg-lana-50 p-2 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 font-medium text-lana-900">{i.nombre}</p>
                      <button type="button" aria-label={`Quitar ${i.nombre}`} onClick={() => quitar(i.id)} className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center text-lana-800">
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-lana-800">{money(i.precio)} c/u</span>
                      <div className="flex items-center gap-1">
                        <button type="button" aria-label={`Quitar una unidad de ${i.nombre}`} onClick={() => cambiarCantidad(i.id, -1)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-lana-300 bg-white">
                          <Minus className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <span className="w-8 text-center font-medium">{i.cantidad}</span>
                        <button type="button" aria-label={`Agregar una unidad de ${i.nombre}`} onClick={() => cambiarCantidad(i.id, 1)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-lana-300 bg-white">
                          <Plus className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <input value={nombre} onChange={(e) => setNombre(e.target.value.slice(0, 60))} placeholder="Tu nombre (opcional)" aria-label="Tu nombre, opcional"
                   autoComplete="name" className="min-h-[44px] w-full rounded-xl border border-lana-300 bg-white px-3 text-base placeholder:text-sm placeholder:text-lana-800/70 outline-none focus:border-precio focus:ring-1 focus:ring-precio" />
            <textarea value={nota} onChange={(e) => setNota(e.target.value.slice(0, 300))} rows={3} placeholder="Escribe tu consulta (fecha, temática, dudas…)" aria-label="Tu consulta"
                      className="w-full resize-none rounded-xl border border-lana-300 bg-white p-3 text-base placeholder:text-sm placeholder:text-lana-800/70 outline-none focus:border-precio focus:ring-1 focus:ring-precio" />
          </div>

          <footer className="space-y-2 border-t border-lana-200 bg-lana-50 p-3">
            {items.length > 0 && (
              <p className="flex justify-between text-sm font-medium text-lana-900"><span>Total estimado</span><span>{money(total)}</span></p>
            )}
            {!numero && <p className="text-center text-xs text-peligro">El WhatsApp del negocio aún no está configurado.</p>}
            <button type="button" onClick={enviar} disabled={!puedeEnviar || !numero} className="btn btn-primario w-full gap-2 !text-sm disabled:opacity-50">
              <Send className="h-4 w-4" aria-hidden="true" /> Enviar pedido por WhatsApp
            </button>
            {items.length > 0 && <button type="button" onClick={vaciar} className="w-full py-2 text-center text-sm text-lana-800 underline">Vaciar lista</button>}
          </footer>
        </section>
      )}

      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-label={abierto ? 'Cerrar pedido' : 'Abrir mi pedido'}
        aria-expanded={abierto}
        className={`pointer-events-auto relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-lana-700 text-lana-50 shadow-xl ring-4 ring-lana-100 transition duration-300 hover:bg-lana-800 lg:h-16 lg:w-16 lg:hover:scale-105 ${esconder ? 'max-lg:pointer-events-none max-lg:translate-x-[150%] max-lg:opacity-0' : ''}`}
      >
        {cantidadTotal > 0 && !abierto && <span className="absolute inset-0 animate-ping rounded-full bg-lana-600/40" aria-hidden="true" />}
        {abierto ? <X className="relative h-6 w-6 lg:h-7 lg:w-7" aria-hidden="true" /> : <ShoppingBag className="relative h-6 w-6 lg:h-7 lg:w-7" aria-hidden="true" />}
        {cantidadTotal > 0 && (
          <span className="absolute -right-1 -top-1 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-acento px-1 text-xs font-semibold text-lana-900">{cantidadTotal}</span>
        )}
      </button>
    </div>
  );
}
