import { useState } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Pencil, Plus, Trash2 } from 'lucide-react-native';
import { TEMA } from '@lanita/shared';
import { supabase, mensajeError, type Fila } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { money, revalidarWeb } from '@/lib/utils';
import { Buscador, Encabezado, ErrorMsg, Nota, Pantalla, useDatos, Vacio } from '@/ui';
import { Foto, ListaEsqueleto } from '@/ui/esqueleto';
import { Selector } from '@/ui/selector';
import { Paginador } from '@/ui/paginador';

const POR_PAGINA = 5;

type Estado = 'disponible' | 'agotado';
const estadoDe = (p: Fila): Estado => (p.disponible ? 'disponible' : 'agotado');
const ESTILO: Record<Estado, { texto: string; fondo: string; letra: string }> = {
  disponible: { texto: 'Disponible', fondo: 'bg-ok/15', letra: 'text-ok' },
  agotado: { texto: 'Agotado', fondo: 'bg-neutral-200', letra: 'text-neutral-600' },
};

export default function Productos() {
  const router = useRouter();
  const { esAdmin } = useAuth();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('todas');
  const [est, setEst] = useState<string>('todos');
  const [pagina, setPagina] = useState(1);
  const [errAccion, setErrAccion] = useState<string | null>(null);

  const { data, cargando, error, offline, recargar } = useDatos<{ productos: Fila[]; categorias: Fila[] }>(async () => {
    const [p, c] = await Promise.all([
      supabase.from('productos').select('id, nombre, precio, categoria_id, stock, disponible, publicado, es_combo, imagen_url').is('eliminado_en', null).order('nombre'),
      supabase.from('categorias').select('id, nombre').is('eliminado_en', null).order('orden'),
    ]);
    if (p.error) throw p.error;
    return { productos: p.data ?? [], categorias: c.data ?? [] };
  }, 'productos_lista');

  function eliminar(p: Fila) {
    Alert.alert('Eliminar producto', `¿Eliminar "${p.nombre}"? Dejará de verse en la web y en la app. Los pedidos anteriores se conservan.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        setErrAccion(null);
        const { error: e } = await supabase.from('productos').update({ eliminado_en: new Date().toISOString(), publicado: false }).eq('id', p.id);
        if (e) setErrAccion(mensajeError(e)); else { revalidarWeb(); recargar(); }
      } },
    ]);
  }

  const lista = (data?.productos ?? []).filter((p) =>
    (cat === 'todas' || p.categoria_id === cat) &&
    (est === 'todos' || estadoDe(p) === est) &&
    (!q || p.nombre.toLowerCase().includes(q.toLowerCase())));

  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  const actual = Math.min(pagina, paginas);
  const visibles = lista.slice((actual - 1) * POR_PAGINA, actual * POR_PAGINA);
  const categoria = (id: string) => (data?.categorias ?? []).find((c) => c.id === id)?.nombre as string | undefined;

  return (
    <Pantalla arriba onRefresh={recargar} refrescando={cargando}>
      <Encabezado titulo="Productos" descripcion="Lo que ven tus clientes en la web: edita, marca agotados o elimina." />
      {/* Fila 1: buscador + Nuevo */}
      <View className="flex-row items-center gap-2">
        <Buscador value={q} onChangeText={(v) => { setQ(v); setPagina(1); }} placeholder="Buscar producto…" />
        {esAdmin && (
          <Pressable onPress={() => router.push('/producto/nuevo')} accessibilityRole="button" className="min-h-[48px] flex-row items-center gap-1.5 rounded-xl bg-lana-200 px-4">
            <Plus size={18} color={TEMA.lana['700']} />
            <Text className="text-base font-semibold text-lana-900">Nuevo</Text>
          </Pressable>
        )}
      </View>

      {/* Fila 2: filtros como selectores */}
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Selector valor={cat} onChange={(v) => { setCat(v); setPagina(1); }} opciones={[{ id: 'todas', texto: 'Todas las categorías' }, ...(data?.categorias ?? []).map((c) => ({ id: c.id as string, texto: c.nombre as string }))]} />
        </View>
        <View className="flex-1">
          <Selector valor={est} onChange={(v) => { setEst(v); setPagina(1); }} opciones={[{ id: 'todos', texto: 'Todos los estados' }, { id: 'disponible', texto: 'Disponibles' }, { id: 'agotado', texto: 'Agotados' }]} />
        </View>
      </View>

      {offline && <Nota>Sin conexión: mostrando la última copia guardada.</Nota>}
      <ErrorMsg texto={error ?? errAccion} />

      {cargando && !data && <ListaEsqueleto n={4} />}
      {lista.length === 0 && !cargando && !!data && <Vacio texto="Sin productos." />}
      <View className="gap-3">
        {visibles.map((p) => {
          const e = ESTILO[estadoDe(p)];
          return (
            <View key={p.id} className="overflow-hidden rounded-3xl border border-neutral-300 bg-white">
              <View className="flex-row items-center justify-between border-b border-neutral-200 px-4 py-1">
                <Text numberOfLines={1} className="flex-1 text-sm font-semibold text-lana-500">{p.es_combo ? 'Combo' : categoria(p.categoria_id) ?? 'Sin categoría'}</Text>
                {esAdmin && (
                  <View className="flex-row">
                    <Pressable onPress={() => router.push(`/producto/${p.id}`)} accessibilityLabel={`Editar ${p.nombre}`} className="h-11 w-11 items-center justify-center"><Pencil size={19} color={TEMA.lana['700']} /></Pressable>
                    <Pressable onPress={() => eliminar(p)} accessibilityLabel={`Eliminar ${p.nombre}`} className="h-11 w-11 items-center justify-center"><Trash2 size={19} color="#b3261e" /></Pressable>
                  </View>
                )}
              </View>
              <Pressable onPress={() => router.push(`/producto/${p.id}`)} accessibilityRole="button" accessibilityLabel={`Abrir ${p.nombre}`} className="flex-row items-center gap-3 px-4 py-3">
                {p.imagen_url ? <Foto uri={p.imagen_url} className="h-14 w-14 rounded-2xl bg-[#f2f2f2]" /> : <View className="h-14 w-14 items-center justify-center rounded-2xl bg-[#f2f2f2]"><Text className="text-xl font-semibold text-lana-700/50">{String(p.nombre).charAt(0).toUpperCase()}</Text></View>}
                <View className="min-w-0 flex-1 gap-0.5">
                  <Text numberOfLines={1} className="text-base font-bold text-lana-900">{p.nombre}</Text>
                  <Text className="text-sm text-lana-800">Stock: {p.stock}</Text>
                </View>
                <View className="items-end gap-1">
                  <View className={`rounded-full px-3 py-1 ${e.fondo}`}><Text className={`text-xs font-semibold ${e.letra}`}>{e.texto}</Text></View>
                  {!p.publicado && <View className="rounded-full bg-lana-200 px-3 py-1"><Text className="text-xs font-semibold text-lana-800">Oculto en la web</Text></View>}
                </View>
              </Pressable>
              <View className="mx-4 flex-row items-center justify-between border-t border-neutral-200 py-3">
                <Text className="text-xs font-bold uppercase text-lana-500">Precio</Text>
                <Text className="text-lg font-semibold text-[#74784a]">{money(p.precio)}</Text>
              </View>
            </View>
          );
        })}
      </View>
      <Paginador pagina={actual} total={paginas} onChange={setPagina} />
    </Pantalla>
  );
}
