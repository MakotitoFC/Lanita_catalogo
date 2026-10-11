import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, type Fila } from './supabase';
import { registrarPush } from './push';

type Rol = 'admin' | 'produccion' | 'ventas';
type Ctx = {
  session: Session | null;
  perfil: { id: string; nombre: string; rol: Rol } | null;
  cargando: boolean;
  sinAcceso: boolean;
  esAdmin: boolean;
  puede: (...roles: Rol[]) => boolean;
  salir: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);
export const useAuth = () => {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth fuera de AuthProvider');
  return c;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Ctx['perfil']>(null);
  const [cargando, setCargando] = useState(true);
  const [sinAcceso, setSinAcceso] = useState(false);

  const cargarPerfil = useCallback(async (s: Session | null) => {
    if (!s) { setPerfil(null); setSinAcceso(false); return; }
    const { data } = await supabase.from('perfiles').select('id, nombre, rol, activo').eq('id', s.user.id).maybeSingle();
    const p = data as Fila | null;
    if (!p || !p.activo) {          // sin rol asignado => sin acceso
      setPerfil(null); setSinAcceso(true);
      await supabase.auth.signOut();
      return;
    }
    setSinAcceso(false);
    setPerfil({ id: p.id, nombre: p.nombre, rol: p.rol });
    registrarPush().catch(() => {});
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await cargarPerfil(data.session);
      setCargando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      // Evita deadlock: no llamar a supabase dentro del callback de forma síncrona.
      setTimeout(() => { cargarPerfil(s); }, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [cargarPerfil]);

  const value = useMemo<Ctx>(() => ({
    session, perfil, cargando, sinAcceso,
    esAdmin: perfil?.rol === 'admin',
    puede: (...roles) => !!perfil && roles.includes(perfil.rol),
    salir: async () => { await supabase.auth.signOut(); },
  }), [session, perfil, cargando, sinAcceso]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
