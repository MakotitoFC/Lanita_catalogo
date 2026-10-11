'use client';

import { Plus, ShoppingBag } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ItemLista = { id: string; nombre: string; precio: number; ruta: string; cantidad: number };
type Ctx = {
  items: ItemLista[];
  total: number;
  cantidadTotal: number;
  agregar: (i: Omit<ItemLista, 'cantidad'>) => void;
  cambiarCantidad: (id: string, delta: number) => void;
  quitar: (id: string) => void;
  vaciar: () => void;
  abierto: boolean;
  setAbierto: (v: boolean) => void;
};

const ListaCtx = createContext<Ctx | null>(null);
const CLAVE = 'lanita_lista_v1';
export const useLista = () => {
  const c = useContext(ListaCtx);
  if (!c) throw new Error('useLista fuera de ListaProvider');
  return c;
};

/** La lista vive solo en el navegador del visitante (localStorage): no se envía a ningún servidor. */
export function ListaProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ItemLista[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE) ?? '[]');
      if (Array.isArray(guardado)) {
        setItems(guardado.filter((i) => i && typeof i.id === 'string' && typeof i.nombre === 'string' && Number.isFinite(i.cantidad)).slice(0, 50));
      }
    } catch { /* sin almacenamiento: la lista funciona solo en memoria */ }
    setListo(true);
  }, []);

  useEffect(() => {
    if (!listo) return;
    try { localStorage.setItem(CLAVE, JSON.stringify(items)); } catch { /* ignorar */ }
  }, [items, listo]);

  const agregar = useCallback((i: Omit<ItemLista, 'cantidad'>) => {
    setItems((prev) => {
      const ya = prev.find((p) => p.id === i.id);
      if (ya) return prev.map((p) => (p.id === i.id ? { ...p, cantidad: Math.min(99, p.cantidad + 1) } : p));
      return [...prev, { ...i, cantidad: 1 }].slice(0, 50);
    });
    setAbierto(true);
  }, []);
  const cambiarCantidad = useCallback((id: string, delta: number) => {
    setItems((prev) => prev.flatMap((p) => {
      if (p.id !== id) return [p];
      const c = Math.min(99, p.cantidad + delta);
      return c <= 0 ? [] : [{ ...p, cantidad: c }];
    }));
  }, []);
  const quitar = useCallback((id: string) => setItems((prev) => prev.filter((p) => p.id !== id)), []);
  const vaciar = useCallback(() => setItems([]), []);

  const value = useMemo<Ctx>(() => ({
    items, agregar, cambiarCantidad, quitar, vaciar, abierto, setAbierto,
    total: items.reduce((s, i) => s + i.precio * i.cantidad, 0),
    cantidadTotal: items.reduce((s, i) => s + i.cantidad, 0),
  }), [items, agregar, cambiarCantidad, quitar, vaciar, abierto]);

  return <ListaCtx.Provider value={value}>{children}</ListaCtx.Provider>;
}

export function BotonAgregar({ id, nombre, precio, ruta, className = '', etiqueta = 'Agregar' }: {
  id: string; nombre: string; precio: number; ruta: string; className?: string; etiqueta?: string;
}) {
  const { agregar } = useLista();
  return (
    <button type="button" onClick={() => agregar({ id, nombre, precio, ruta })}
            className={`flex min-h-[44px] items-stretch rounded-full bg-lana-700 text-sm text-lana-50 transition-colors hover:bg-lana-800 ${className}`}>
      <span className="flex flex-1 items-center px-3 text-left">{etiqueta}</span>
      <span className="m-1.5 flex w-8 shrink-0 items-center justify-center rounded-sm border border-lana-50/60" aria-hidden="true"><Plus className="h-4 w-4" /></span>
    </button>
  );
}

/** Botón redondo (solo icono) para agregar a la consulta desde la foto de la tarjeta. */
export function BotonIconoAgregar({ id, nombre, precio, ruta }: { id: string; nombre: string; precio: number; ruta: string }) {
  const { agregar } = useLista();
  return (
    <button type="button" onClick={() => agregar({ id, nombre, precio, ruta })} aria-label={`Agregar ${nombre} a mi consulta`} title="Agregar a mi consulta"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-lana-900 shadow-sm transition hover:bg-white">
      <ShoppingBag className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
