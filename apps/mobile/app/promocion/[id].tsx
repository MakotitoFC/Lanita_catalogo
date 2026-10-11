import { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, ChevronDown, Search, X } from 'lucide-react-native';
import { TEMA } from '@lanita/shared';
import { supabase, mensajeError, type Fila } from '@/lib/supabase';
import { hoyISO, revalidarWeb, subirImagen, tomarFoto, uuidv4 } from '@/lib/utils';
import { Boton, Campo, ErrorMsg, Nota, useDatos } from '@/ui';
import { Foto } from '@/ui/esqueleto';
import { HojaRuta } from '@/ui/hoja';
import { SelectorFecha } from '@/ui/fecha';

const sumarDias = (iso: string, d: number) => {
  const [y, m, dd] = iso.split('-').map(Number);
  const f = new Date(y!, m! - 1, dd! + d);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
};

/** Selector con buscador: al escribir se filtran los productos y cada uno se ve con su miniatura. */
function SelectorProducto({ productos, valor, onChange }: { productos: Fila[]; valor: string; onChange: (id: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState('');
  const actual = productos.find((p) => p.id === valor);
  const lista = productos.filter((p) => !q || p.nombre.toLowerCase().includes(q.toLowerCase()));
  const Mini = ({ url }: { url?: string | null }) => (url ? <Foto uri={url} className="h-10 w-10 rounded-lg bg-[#f2f2f2]" /> : <View className="h-10 w-10 rounded-lg bg-[#f2f2f2]" />);
  return (
    <>
      <Pressable onPress={() => { setQ(''); setAbierto(true); }} accessibilityRole="button" className="min-h-[52px] flex-row items-center gap-3 rounded-xl border border-neutral-300 bg-white px-3">
        {actual ? <Mini url={actual.imagen_url} /> : null}
        <Text numberOfLines={1} className={`flex-1 text-base ${actual ? 'text-lana-900' : 'text-lana-500'}`}>{actual ? actual.nombre : 'Buscar un producto…'}</Text>
        {actual ? (
          <Pressable onPress={() => onChange('')} hitSlop={8} accessibilityLabel="Quitar enlace"><X size={18} color={TEMA.lana['500']} /></Pressable>
        ) : <ChevronDown size={18} color={TEMA.lana['700']} />}
      </Pressable>
      <Modal visible={abierto} transparent animationType="fade" onRequestClose={() => setAbierto(false)} statusBarTranslucent>
        <Pressable className="flex-1 items-center justify-center bg-black/50 p-6" onPress={() => setAbierto(false)}>
          <Pressable onPress={() => {}} className="max-h-[75%] w-full max-w-sm rounded-3xl bg-white p-3">
            <View className="mb-2 min-h-[48px] flex-row items-center gap-2 rounded-xl border border-neutral-300 px-3">
              <Search size={18} color={TEMA.lana['500']} />
              <TextInput value={q} onChangeText={setQ} autoFocus placeholder="Escribe el nombre…" placeholderTextColor={TEMA.lana['400']} style={{ fontFamily: 'Poppins_400Regular' }} className="flex-1 text-base text-lana-900" />
              <Pressable onPress={() => setAbierto(false)} hitSlop={8} accessibilityLabel="Cerrar"><X size={18} color={TEMA.lana['500']} /></Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {lista.length === 0 && <Text className="p-4 text-center text-base text-lana-800">Sin resultados.</Text>}
              {lista.map((p) => (
                <Pressable key={p.id} onPress={() => { onChange(p.id); setAbierto(false); }} className={`min-h-[56px] flex-row items-center gap-3 rounded-xl px-2 ${p.id === valor ? 'bg-lana-200' : ''}`}>
                  <Mini url={p.imagen_url} />
                  <Text numberOfLines={1} className="flex-1 text-base text-lana-900">{p.nombre}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export default function PromocionForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const nuevo = id === 'nuevo';
  const router = useRouter();
  const [f, setF] = useState({ titulo: '', descripcion: '', imagen_url: '', producto_id: '', fecha_inicio: hoyISO(), fecha_fin: sumarDias(hoyISO(), 7), activa: true });
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const { data } = useDatos<Fila>(async () => {
    const prods = await supabase.from('productos').select('id, nombre, imagen_url').is('eliminado_en', null).eq('publicado', true).order('nombre');
    let promo: Fila | null = null;
    if (!nuevo) {
      const r = await supabase.from('promociones').select('*').eq('id', id).single();
      if (r.error) throw r.error;
      promo = r.data;
    }
    return { prods: prods.data ?? [], promo };
  });

  useEffect(() => {
    const p = data?.promo;
    if (p) setF({ titulo: p.titulo, descripcion: p.descripcion ?? '', imagen_url: p.imagen_url ?? '', producto_id: p.producto_id ?? '', fecha_inicio: p.fecha_inicio, fecha_fin: p.fecha_fin, activa: p.activa });
  }, [data]);

  async function foto(origen: 'camara' | 'galeria') {
    const r = await tomarFoto(origen);
    if (!r) return;
    try {
      const { url } = await subirImagen('productos', `promos/${uuidv4()}.jpg`, r.base64);
      set('imagen_url')(url!);
    } catch (e) { setError(mensajeError(e)); }
  }
  const elegirOrigen = () => Alert.alert('Foto de la promoción', 'Elige de dónde tomarla', [
    { text: 'Cámara', onPress: () => foto('camara') }, { text: 'Galería', onPress: () => foto('galeria') }, { text: 'Cancelar', style: 'cancel' },
  ]);

  async function guardar() {
    setError(null);
    if (f.titulo.trim().length < 2) return setError('Escribe un título.');
    if (!f.fecha_inicio || !f.fecha_fin) return setError('Elige las fechas de inicio y fin.');
    if (f.fecha_fin < f.fecha_inicio) return setError('La fecha de fin no puede ser anterior a la de inicio.');
    setOcupado(true);
    const fila = {
      titulo: f.titulo.trim(), descripcion: f.descripcion.trim() || null, imagen_url: f.imagen_url || null,
      producto_id: f.producto_id || null, fecha_inicio: f.fecha_inicio, fecha_fin: f.fecha_fin, activa: f.activa,
    };
    const res = nuevo ? await supabase.from('promociones').insert(fila) : await supabase.from('promociones').update(fila).eq('id', id);
    setOcupado(false);
    if (res.error) return setError(mensajeError(res.error));
    revalidarWeb();
    router.back();
  }

  function archivar() {
    Alert.alert('Eliminar promoción', '¿Eliminar esta promoción? Dejará de verse en la web.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        const { error: e } = await supabase.from('promociones').update({ eliminado_en: new Date().toISOString(), activa: false }).eq('id', id);
        if (e) return setError(mensajeError(e));
        revalidarWeb(); router.back();
      } },
    ]);
  }

  return (
    <HojaRuta titulo={nuevo ? 'Nueva promoción' : 'Promoción'}>
      {/* Foto con botón de cámara al pie */}
      <View className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-[#f2f2f2]">
        {f.imagen_url ? <Foto uri={f.imagen_url} className="h-full w-full" resizeMode="cover" /> : <View className="h-full w-full items-center justify-center"><Text className="text-base text-lana-500">Sin foto</Text></View>}
        <Pressable onPress={elegirOrigen} accessibilityRole="button" accessibilityLabel="Agregar foto" className="absolute bottom-3 right-3 h-12 w-12 items-center justify-center rounded-full bg-white" style={{ elevation: 3 }}>
          <Camera size={22} color={TEMA.lana['700']} />
        </Pressable>
      </View>
      <Campo etiqueta="Título *" value={f.titulo} onChangeText={set('titulo')} maxLength={80} placeholder="Ej.: Combo Navidad con 15 % de descuento" />
      <Campo etiqueta="Descripción" value={f.descripcion} onChangeText={set('descripcion')} multiline maxLength={500} style={{ minHeight: 90, textAlignVertical: 'top' }} />
      <View className="flex-row gap-2">
        <View className="flex-1"><SelectorFecha etiqueta="Desde *" valor={f.fecha_inicio} onChange={(v) => set('fecha_inicio')(v || f.fecha_inicio)} /></View>
        <View className="flex-1"><SelectorFecha etiqueta="Hasta *" valor={f.fecha_fin} onChange={(v) => set('fecha_fin')(v || f.fecha_fin)} /></View>
      </View>
      <View className="gap-1">
        <Text className="text-sm font-medium text-lana-800">Enlazar a un producto (opcional)</Text>
        <SelectorProducto productos={data?.prods ?? []} valor={f.producto_id} onChange={set('producto_id')} />
      </View>

      {/* Activar / pausar: color propio (naranja) */}
      <Pressable onPress={() => set('activa')(!f.activa)} accessibilityRole="button" accessibilityState={{ selected: f.activa }}
                 style={f.activa ? { borderColor: '#b84f0b', borderWidth: 2 } : { backgroundColor: '#b84f0b' }} className="min-h-[52px] items-center justify-center rounded-xl">
        <Text style={{ color: f.activa ? '#b84f0b' : '#ffffff' }} className="text-lg font-semibold">{f.activa ? 'Promoción activa · Pausar' : 'Activar promoción'}</Text>
      </Pressable>
      <Nota>Aparece sola cuando llega la fecha de inicio y desaparece al pasar la fecha de fin.</Nota>
      <ErrorMsg texto={error} />

      <View className="flex-row gap-2">
        <View className="flex-1"><Boton titulo={nuevo ? 'Publicar' : 'Guardar'} cargando={ocupado} onPress={guardar} /></View>
        {!nuevo && <View className="flex-1"><Boton titulo="Eliminar" variante="suave" onPress={archivar} /></View>}
      </View>
    </HojaRuta>
  );
}
