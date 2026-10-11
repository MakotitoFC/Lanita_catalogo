'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export type OpcionSelector = { id: string; texto: string; cantidad?: number };

/**
 * Selector personalizado (reemplaza al <select> del navegador): botón en forma de píldora y lista desplegable propia,
 * con teclado (flechas, Inicio/Fin, Enter, Esc), cierre al tocar fuera y pensado para el celular.
 */
export function Selector({ etiqueta, valor, opciones, onChange }: {
  etiqueta: string; valor: string; opciones: OpcionSelector[]; onChange: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [foco, setFoco] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const idLista = useId();
  const actual = opciones.find((o) => o.id === valor) ?? opciones[0];

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => { if (!raiz.current?.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener('pointerdown', fuera);
    return () => document.removeEventListener('pointerdown', fuera);
  }, [abierto]);

  function elegir(id: string) { onChange(id); setAbierto(false); }

  function teclado(e: React.KeyboardEvent) {
    if (!abierto) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setFoco(Math.max(0, opciones.findIndex((o) => o.id === valor))); setAbierto(true); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); setAbierto(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setFoco((f) => Math.min(opciones.length - 1, f + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFoco((f) => Math.max(0, f - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setFoco(0); }
    else if (e.key === 'End') { e.preventDefault(); setFoco(opciones.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const o = opciones[foco]; if (o) elegir(o.id); }
    else if (e.key === 'Tab') setAbierto(false);
  }

  return (
    <div ref={raiz} className="relative w-full sm:w-auto" onKeyDown={teclado}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={idLista}
        aria-label={`${etiqueta}: ${actual?.texto ?? ''}`}
        onClick={() => { setFoco(Math.max(0, opciones.findIndex((o) => o.id === valor))); setAbierto((a) => !a); }}
        className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-full bg-lana-700 px-5 text-sm font-medium text-lana-50 transition-colors hover:bg-lana-800 sm:w-auto sm:min-w-[13rem]"
      >
        <span className="truncate">{actual?.texto}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {abierto && (
        <ul
          id={idLista}
          role="listbox"
          aria-label={etiqueta}
          className="absolute left-0 right-0 z-30 mt-2 max-h-72 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-2xl border border-lana-300 bg-lana-50 p-1.5 shadow-xl sm:left-auto sm:right-0 sm:w-72"
        >
          {opciones.map((o, i) => {
            const activa = o.id === valor;
            return (
              <li
                key={o.id}
                role="option"
                aria-selected={activa}
                onClick={() => elegir(o.id)}
                onMouseEnter={() => setFoco(i)}
                className={`flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-xl px-4 text-sm ${i === foco ? 'bg-lana-200' : ''} ${activa ? 'font-semibold text-lana-900' : 'text-lana-800'}`}
              >
                <span className="truncate">{o.texto}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {o.cantidad != null && <span className="text-xs text-lana-800">{o.cantidad}</span>}
                  {activa && <Check className="h-4 w-4" aria-hidden="true" />}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
