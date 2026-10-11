import { useState } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Pencil, Plus, Trash2 } from 'lucide-react-native';
import { TEMA } from '@lanita/shared';
import { supabase, mensajeError, type Fila } from '@/lib/supabase';
import { hoyISO, revalidarWeb } from '@/lib/utils';
import { Encabezado, ErrorMsg, Pantalla, useDatos, Vacio } from '@/ui';
import { Foto, ListaEsqueleto } from '@/ui/esqueleto';
import { Paginador } from '@/ui/paginador';
import { SelectorFecha } from '@/ui/fecha';

const POR_PAGINA = 5;
const corta = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });

function estadoPromo(p: Fila, hoy: string): { texto: string; fondo: string; letra: string } {
  if (!p.activa) return { texto: 'Pausada', fondo: 'bg-neutral-200', letra: 'text-neutral-600' };
  if (p.fecha_fin < hoy) return { texto: 'Vencida', fondo: 'bg-peligro/15', letra: 'text-peligro' };
  if (p.fecha_inicio > hoy) return { texto: 'Programada', fondo: 'bg-alerta/15', letra: 'text-alerta' };
  return { texto: 'Vigente en la web', fondo: 'bg-ok/15', letra: 'text-ok' };
}

export default function Promociones() {
  const router = useRouter();
  const [fecha, setFecha] = useState('');
  const [pagina, setPagina] = useState(1);
  const [errAccion, setErrAccion] = useState<string | null>(null);
  const { data, cargando, error, recargar } = useDatos<Fila[]>(async () => {
    const { data, error } = await supabase.from('promociones').select('*').is('eliminado_en', null).order('fecha_fin', { ascending: false });
    if (error) throw error;
    return data ?? [];
  });
  const hoy = hoyISO();

  const lista = (data ?? []).filter((p) => !fecha || (p.fecha_inicio <= fecha && fecha <= p.fecha_fin));
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  const actual = Math.min(pagina, paginas);
  const visibles = lista.slice((actual - 1) * POR_PAGINA, actual * POR_PAGINA);

  function archivar(p: Fila) {
    Alert.alert('Eliminar promoción', `¿Eliminar "${p.titulo}"? Dejará de verse en la web.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        setErrAccion(null);
        const { error: e } = await supabase.from('promociones').update({ eliminado_en: new Date().toISOString(), activa: false }).eq('id', p.id);
        if (e) setErrAccion(mensajeError(e)); else { revalidarWeb(); recargar(); }
      } },
    ]);
  }

  return (
    <Pantalla arriba onRefresh={recargar} refrescando={cargando}>
      <Encabezado titulo="Promociones" descripcion="Programa ofertas: aparecen solas en tu web entre sus fechas." />
      <View className="flex-row items-end gap-2">
        <Pressable onPress={() => router.push('/promocion/nuevo')} accessibilityRole="button" className="min-h-[48px] flex-row items-center gap-1.5 rounded-xl bg-lana-200 px-4">
          <Plus size={18} color={TEMA.lana['700']} />
          <Text className="text-base font-semibold text-lana-900">Nuevo</Text>
        </Pressable>
        <View className="flex-1"><SelectorFecha etiqueta="" placeholder="Buscar por fecha" valor={fecha} onChange={(v) => { setFecha(v); setPagina(1); }} /></View>
      </View>
      <ErrorMsg texto={error ?? errAccion} />
      {cargando && !data && <ListaEsqueleto n={4} />}
      {lista.length === 0 && !cargando && !!data && <Vacio texto={fecha ? 'No hay promociones en esa fecha.' : 'Aún no creaste promociones.'} />}

      <View className="gap-3">
        {visibles.map((p) => {
          const e = estadoPromo(p, hoy);
          return (
            <View key={p.id} className="overflow-hidden rounded-3xl border border-neutral-300 bg-white">
              <View className="flex-row items-center justify-between border-b border-neutral-200 px-4 py-1">
                <View className={`rounded-full px-3 py-1 ${e.fondo}`}><Text className={`text-xs font-semibold ${e.letra}`}>{e.texto}</Text></View>
                <View className="flex-row">
                  <Pressable onPress={() => router.push(`/promocion/${p.id}`)} accessibilityLabel={`Editar ${p.titulo}`} className="h-11 w-11 items-center justify-center"><Pencil size={19} color={TEMA.lana['700']} /></Pressable>
                  <Pressable onPress={() => archivar(p)} accessibilityLabel={`Eliminar ${p.titulo}`} className="h-11 w-11 items-center justify-center"><Trash2 size={19} color="#b3261e" /></Pressable>
                </View>
              </View>
              <Pressable onPress={() => router.push(`/promocion/${p.id}`)} accessibilityRole="button" className="flex-row items-center gap-3 px-4 py-3">
                {p.imagen_url ? <Foto uri={p.imagen_url} className="h-14 w-14 rounded-2xl bg-[#f2f2f2]" /> : <View className="h-14 w-14 rounded-2xl bg-[#f2f2f2]" />}
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="text-base font-bold text-lana-900">{p.titulo}</Text>
                  {p.descripcion ? <Text numberOfLines={1} className="text-sm text-lana-800">{p.descripcion}</Text> : null}
                </View>
              </Pressable>
              <View className="mx-4 flex-row items-center justify-between border-t border-neutral-200 py-3">
                <Text className="text-xs font-bold uppercase text-lana-500">Vigencia</Text>
                <Text className="text-base font-semibold text-[#74784a]">{corta(p.fecha_inicio)} – {corta(p.fecha_fin)}</Text>
              </View>
            </View>
          );
        })}
      </View>
      <Paginador pagina={actual} total={paginas} onChange={setPagina} />
    </Pantalla>
  );
}
