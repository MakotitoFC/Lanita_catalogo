'use client';

import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Minus, Plus, Send, Trash2, X } from 'lucide-react';
import { generarMensajeWhatsApp } from '@lanita/shared';
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
  const money = (n: number) => `${simbolo}${n.toFixed(2)}`;
  const puedeEnviar = items.length > 0 || nota.trim().length > 0;

  const enlace = useMemo(() => {
    if (!puedeEnviar) return null;
    return generarMensajeWhatsApp(
      {
        tipo: 'lista',
        cliente: nombre.trim() || undefined,
        nota: nota.trim() || undefined,
        items: items.map((i) => ({ nombre: i.nombre, cantidad: i.cantidad, precio: i.precio, url: `${siteUrl}${i.ruta}` })),
      },
      { whatsapp_numero: numero, moneda_simbolo: simbolo },
    ).url;
  }, [items, nombre, nota, numero, simbolo, siteUrl, puedeEnviar]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-end gap-3 px-4 sm:px-5" style={{ paddingBottom: `calc(max(1rem, env(safe-area-inset-bottom)) + ${subir}px)`, ["--subir" as string]: `${subir}px` }}>
      {abierto && (
        <section role="dialog" aria-label="Tu consulta" className="tarjeta pointer-events-auto flex max-h-[calc(100dvh-6.5rem-var(--subir,0px))] w-full max-w-sm flex-col shadow-xl">
          <header className="flex items-center justify-between gap-2 bg-lana-700 py-1 pl-4 pr-1 text-lana-50">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold !text-lana-50">Consulta a {negocio}</h2>
              <p className="text-xs text-lana-200">Te respondemos por WhatsApp</p>
            </div>
            <button type="button" aria-label="Cerrar" onClick={() => setAbierto(false)} className="flex h-11 w-11 shrink-0 items-center justify-center">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-lana-100 p-3">
            {items.length === 0 ? (
              <p className="rounded-xl bg-lana-50 p-3 text-sm text-lana-800">
                Toca <strong>Agregar</strong> en los productos que te interesen y los enviamos juntos en un solo mensaje. También puedes escribir tu consulta abajo.
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
            {enlace ? (
              <a href={enlace} target="_blank" rel="noopener noreferrer" className="btn btn-primario w-full gap-2 !text-sm">
                <Send className="h-4 w-4" aria-hidden="true" /> Enviar a WhatsApp
              </a>
            ) : (
              <button type="button" disabled className="btn btn-primario w-full gap-2 !text-sm opacity-50">
                <Send className="h-4 w-4" aria-hidden="true" /> Enviar a WhatsApp
              </button>
            )}
            {items.length > 0 && <button type="button" onClick={vaciar} className="w-full py-2 text-center text-sm text-lana-800 underline">Vaciar lista</button>}
          </footer>
        </section>
      )}

      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-label={abierto ? 'Cerrar consulta' : 'Abrir consulta'}
        aria-expanded={abierto}
        className="pointer-events-auto relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-lana-700 text-lana-50 shadow-xl ring-4 ring-lana-100 transition hover:scale-105 hover:bg-lana-800"
      >
        {cantidadTotal > 0 && !abierto && <span className="absolute inset-0 animate-ping rounded-full bg-lana-600/40" aria-hidden="true" />}
        {abierto ? <X className="relative h-7 w-7" aria-hidden="true" /> : <MessageCircle className="relative h-8 w-8" aria-hidden="true" />}
        {cantidadTotal > 0 && (
          <span className="absolute -right-1 -top-1 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-acento px-1 text-xs font-semibold text-lana-900">{cantidadTotal}</span>
        )}
      </button>
    </div>
  );
}
