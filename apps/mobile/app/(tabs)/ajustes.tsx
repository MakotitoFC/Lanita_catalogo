import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { supabase, mensajeError, type Fila } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { revalidarWeb, subirImagen, tomarFoto, uuidv4 } from '@/lib/utils';
import { Image as ImageIcon } from 'lucide-react-native';
import { Boton, Campo, Encabezado, ErrorMsg, Fila as FilaUI, Interruptor, Nota, Pantalla, Subtitulo, Tarjeta, Texto, useDatos } from '@/ui';
import { Foto } from '@/ui/esqueleto';

const CAMPOS_CONFIG = [
  ['nombre_negocio', 'Nombre del negocio'], ['eslogan', 'Eslogan'], ['whatsapp_numero', 'WhatsApp del negocio (solo dígitos, con país)'],
  ['mensaje_whatsapp_default', 'Mensaje por defecto de WhatsApp'],
] as const;

export default function Ajustes() {
  const { esAdmin, perfil } = useAuth();
  const [cfg, setCfg] = useState<Fila>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, recargar } = useDatos<Fila>(async () => {
    if (!esAdmin) return {};
    const [c, u, cajas, emp] = await Promise.all([
      supabase.from('config').select('*').single(),
      supabase.from('perfiles').select('id, nombre, rol, activo').order('nombre'),
      supabase.from('cajas_envio').select('*').order('nombre'),
      supabase.from('empaque_default').select('id, cantidad, aplica_por, activo, insumos(nombre, unidad_medida)').order('aplica_por'),
    ]);
    return { config: c.data, usuarios: u.data ?? [], cajas: cajas.data ?? [], empaque: emp.data ?? [] };
  });
  useEffect(() => { if (data?.config) { setCfg(data.config); } }, [data]);

  async function guardarConfig() {
    setError(null); setMsg(null);
    const { id: _i, created_at: _c, updated_at: _u, created_by: _cb, updated_by: _ub, ...cambios } = cfg;
    for (const k of ['eslogan']) if (cambios[k] === '') cambios[k] = null;
    const { error: e } = await supabase.from('config').update(cambios).eq('id', true);
    if (e) setError(mensajeError(e)); else { setMsg('Guardado'); revalidarWeb(); }
  }

  async function cambiarInterruptor(campo: 'web_mostrar_promociones' | 'web_mostrar_burbuja', valor: boolean) {
    setError(null); setMsg(null);
    const anterior = cfg[campo];
    setCfg((c) => ({ ...c, [campo]: valor }));
    const { error: e } = await supabase.from('config').update({ [campo]: valor }).eq('id', true);
    if (e) { setCfg((c) => ({ ...c, [campo]: anterior })); setError(mensajeError(e)); } else { setMsg('Cambio aplicado en la web.'); revalidarWeb(); }
  }

  async function cambiarLogo() {
    setError(null); setMsg(null);
    try {
      const f = await tomarFoto('galeria', 'png');
      if (!f) return;
      const { url } = await subirImagen('productos', `logo/${uuidv4()}.png`, f.base64, 'image/png');
      const { error: e } = await supabase.from('config').update({ logo_url: url }).eq('id', true);
      if (e) throw e;
      setCfg((c) => ({ ...c, logo_url: url })); setMsg('Logo actualizado'); revalidarWeb();
    } catch (e) { setError(mensajeError(e)); }
  }

  async function cambiarUsuario(id: string, cambios: Fila) {
    const { error: e } = await supabase.from('perfiles').update(cambios).eq('id', id);
    if (e) setError(mensajeError(e)); else recargar();
  }

  async function guardarCaja(c: Fila) {
    const { error: e } = await supabase.from('cajas_envio').update({ ancho_cm: Number(c.ancho_cm) || null, alto_cm: Number(c.alto_cm) || null, largo_cm: Number(c.largo_cm) || null }).eq('id', c.id);
    if (e) setError(mensajeError(e)); else setMsg('Caja actualizada');
  }

  return (
    <Pantalla arriba>
      <Encabezado titulo="Ajustes" descripcion="Tu logo y los datos de tu negocio." />
      <Tarjeta><FilaUI a="Usuario" b={perfil?.nombre ?? ''} /><FilaUI a="Rol" b="Administrador" /></Tarjeta>
      <ErrorMsg texto={error} />
      {msg && <Nota>{msg}</Nota>}

      {esAdmin && data?.config && (
        <>
          <Subtitulo>Logo</Subtitulo>
          <Nota>Se ve redondo en el inicio de la app. Usa una imagen cuadrada.</Nota>
          {cfg.logo_url ? <View className="items-center"><Foto uri={cfg.logo_url} className="h-24 w-24 rounded-full border border-neutral-300 bg-white" resizeMode="cover" /></View> : null}
          <Boton titulo={cfg.logo_url ? 'Cambiar logo' : 'Subir logo'} icono={ImageIcon} variante="suave" onPress={cambiarLogo} />
          <Subtitulo>Mostrar en la web</Subtitulo>
          <Interruptor etiqueta="Sección de promociones" valor={cfg.web_mostrar_promociones !== false} onChange={(v) => cambiarInterruptor('web_mostrar_promociones', v)} />
          <Interruptor etiqueta="Burbuja de consulta (WhatsApp)" valor={cfg.web_mostrar_burbuja !== false} onChange={(v) => cambiarInterruptor('web_mostrar_burbuja', v)} />
          
          <Subtitulo>Datos del negocio</Subtitulo>
          {CAMPOS_CONFIG.map(([k, et]) => (
            <Campo key={k} etiqueta={et} value={cfg[k] ?? ''} onChangeText={(v) => setCfg({ ...cfg, [k]: v })} autoCapitalize="none" />
          ))}
          <Interruptor etiqueta="Exigir verificación en 2 pasos (TOTP) a administradores" valor={!!cfg.exigir_mfa_admin} onChange={(v) => setCfg({ ...cfg, exigir_mfa_admin: v })} />
          <Nota>Actívalo solo después de que cada admin haya registrado su app autenticadora.</Nota>
          <Boton titulo="Guardar datos del negocio" onPress={guardarConfig} />

          <Subtitulo>Empaque por defecto</Subtitulo>
          <Tarjeta>
            {data.empaque.map((e: Fila) => <FilaUI key={e.id} a={`${e.insumos?.nombre} (por ${e.aplica_por})`} b={`${Number(e.cantidad)} ${e.insumos?.unidad_medida}`} />)}
          </Tarjeta>

          <Subtitulo>Cajas de envío</Subtitulo>
          {data.cajas.map((c: Fila) => <CajaEditor key={c.id} caja={c} onGuardar={guardarCaja} />)}

          <Subtitulo>Usuarios</Subtitulo>
          {data.usuarios.map((u: Fila) => (
            <Tarjeta key={u.id}>
              <Texto className="font-semibold">{u.nombre}{u.id === perfil?.id ? ' (tú)' : ''}</Texto>
              <Nota>Administrador</Nota>
              {u.id !== perfil?.id && <View className="mt-2"><Interruptor etiqueta="Activo" valor={u.activo} onChange={(a) => cambiarUsuario(u.id, { activo: a })} /></View>}
            </Tarjeta>
          ))}
          <Nota>Para crear un usuario nuevo: Supabase → Authentication → Add user; luego asígnale rol aquí o con SQL (ver README).</Nota>
        </>
      )}
    </Pantalla>
  );
}

function CajaEditor({ caja, onGuardar }: { caja: Fila; onGuardar: (c: Fila) => void }) {
  const [c, setC] = useState<Fila>({ ...caja, ancho_cm: caja.ancho_cm?.toString() ?? '', alto_cm: caja.alto_cm?.toString() ?? '', largo_cm: caja.largo_cm?.toString() ?? '' });
  return (
    <Tarjeta className="gap-2">
      <Texto className="font-semibold">Caja {caja.nombre}</Texto>
      <Campo etiqueta="Ancho (cm)" value={c.ancho_cm} onChangeText={(v) => setC({ ...c, ancho_cm: v })} keyboardType="decimal-pad" />
      <Campo etiqueta="Alto (cm)" value={c.alto_cm} onChangeText={(v) => setC({ ...c, alto_cm: v })} keyboardType="decimal-pad" />
      <Campo etiqueta="Largo (cm)" value={c.largo_cm} onChangeText={(v) => setC({ ...c, largo_cm: v })} keyboardType="decimal-pad" />
      <Boton titulo="Guardar medidas" variante="suave" onPress={() => onGuardar(c)} />
    </Tarjeta>
  );
}
