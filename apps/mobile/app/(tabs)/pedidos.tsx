import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Minus, Plus, ShoppingBag } from 'lucide-react-native';
import { TEMA } from '@lanita/shared';
import { supabase, type Fila } from '@/lib/supabase';
import { money } from '@/lib/utils';
import { Badge, Buscador, Encabezado, ErrorMsg, Pantalla, useDatos, Vacio } from '@/ui';
import { CuadriculaEsqueleto, FilasEsqueleto, Foto } from '@/ui/esqueleto';
import { Selector } from '@/ui/selector';
import { Hoja } from '@/ui/hoja';
import { Paginador } from '@/ui/paginador';
import { NuevoPedido } from '@/componentes/NuevoPedido';
import { DetallePedido } from '@/componentes/DetallePedido';

const POR_PAGINA = 4;
const ESTADO: Record<string, { texto: string; tono: string }> = {
  pendiente: { texto: 'Pendiente', tono: 'alerta' }, pagado: { texto: 'Pagado', tono: 'ok' }, cancelado: { texto: 'Cancelado', tono: 'peligro' },
};

export default function Pedidos() {
  const [filtro, setFiltro] = useState<string>('pendiente');
  const [pagina, setPagina] = useState(1);
  const [verId, setVerId] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [cant, setCant] = useState<Record<string, number>>({});
  const [buscar, setBuscar] = useState('');

  const { data, cargando, error, recargar } = useDatos<{ pedidos: Fila[]; productos: Fila[]; punto: string | null }>(async () => {
    const [p, pr, cfg] = await Promise.all([
      supabase.from('pedidos').select('id, numero, cliente_nombre, estado, total, fecha_entrega').is('eliminado_en', null).order('fecha_pedido', { ascending: false }).order('numero', { ascending: false }).limit(200),
      supabase.from('productos').select('id, nombre, precio, es_combo, stock, bajo_pedido, imagen_url').is('eliminado_en', null).order('es_combo').order('nombre'),
      supabase.from('config').select('punto_encuentro_defecto').limit(1).single(),
    ]);
    if (p.error) throw p.error;
    return { pedidos: p.data ?? [], productos: pr.data ?? [], punto: cfg.data?.punto_encuentro_defecto ?? null };
  }, 'pedidos_vista');

  const lista = (data?.pedidos ?? []).filter((p) => filtro === 'todos' || p.estado === filtro);
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  const actual = Math.min(pagina, paginas);
  const visibles = lista.slice((actual - 1) * POR_PAGINA, actual * POR_PAGINA);

  const productos = data?.productos ?? [];
  const catalogo = productos.filter((p) => !buscar || p.nombre.toLowerCase().includes(buscar.toLowerCase()));
  const elegidos = productos.filter((p) => (cant[p.id] ?? 0) > 0);
  const unidades = elegidos.reduce((s, p) => s + cant[p.id]!, 0);
  const subtotal = elegidos.reduce((s, p) => s + Number(p.precio) * cant[p.id]!, 0);
  const cambiar = (p: Fila, d: number) => setCant((c) => ({ ...c, [p.id]: Math.max(0, Math.min(p.bajo_pedido ? 999 : p.stock, (c[p.id] ?? 0) + d)) }));

  return (
    <View className="flex-1 bg-white">
      <Pantalla arriba onRefresh={recargar} refrescando={cargando}>
        <Encabezado titulo="Pedidos" descripcion="Pendientes, pagados y cancelados. Arma uno nuevo eligiendo productos." />
        {/* Filtro por estado + nuevo pedido */}
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <Selector valor={filtro} onChange={(v) => { setFiltro(v); setPagina(1); }}
                      opciones={[{ id: 'pendiente', texto: 'Pendientes' }, { id: 'pagado', texto: 'Pagados' }, { id: 'cancelado', texto: 'Cancelados' }, { id: 'todos', texto: 'Todos' }]} />
          </View>
          <Pressable onPress={() => setNuevo(true)} accessibilityRole="button" className="min-h-[48px] flex-row items-center gap-1.5 rounded-xl bg-lana-200 px-4">
            <Plus size={18} color={TEMA.lana['700']} />
            <Text className="text-base font-semibold text-lana-900">Nuevo pedido</Text>
          </Pressable>
        </View>
        <ErrorMsg texto={error} />

        {/* Pedidos recientes (4 por página) */}
        {cargando && !data ? <FilasEsqueleto n={4} /> : <View className="overflow-hidden rounded-2xl border border-neutral-300 bg-white">
          {lista.length === 0 && !cargando && <View className="p-4"><Vacio texto="No hay pedidos en esta vista." /></View>}
          {visibles.map((p, i) => {
            const e = ESTADO[p.estado] ?? ESTADO.pendiente!;
            return (
              <Pressable key={p.id} onPress={() => setVerId(p.id)} accessibilityRole="button" className={`flex-row items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-neutral-200' : ''}`}>
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="text-base font-bold text-lana-900">#{p.numero} · {p.cliente_nombre}</Text>
                  <Text className="text-sm text-lana-800">{p.fecha_entrega ? `Entrega ${p.fecha_entrega}` : 'Sin fecha de entrega'}</Text>
                </View>
                <View className="items-end gap-1">
                  <Text className="text-base font-semibold text-[#74784a]">{money(p.total)}</Text>
                  <Badge texto={e.texto} tono={e.tono} />
                </View>
              </Pressable>
            );
          })}
        </View>}
        <Paginador pagina={actual} total={paginas} onChange={setPagina} />

        {/* Productos para armar un pedido */}
        <Text className="mt-2 text-lg font-semibold text-lana-800">Elige los productos del pedido</Text>
        <View className="flex-row"><Buscador value={buscar} onChangeText={setBuscar} placeholder="Buscar producto…" /></View>
        {cargando && !data && <CuadriculaEsqueleto n={4} />}
        <View className="flex-row flex-wrap justify-between gap-y-3">
          {catalogo.map((p) => {
            const n = cant[p.id] ?? 0;
            return (
              <View key={p.id} className={`w-[48.5%] overflow-hidden rounded-3xl bg-[#f2f2f2] p-2 ${n > 0 ? 'border-2 border-lana-700' : 'border-2 border-transparent'}`}>
                <View className="aspect-square overflow-hidden rounded-2xl bg-white/60">
                  {p.imagen_url ? <Foto uri={p.imagen_url} className="h-full w-full" resizeMode="cover" accessibilityLabel={p.nombre} /> : <View className="h-full w-full items-center justify-center"><Text className="text-4xl font-semibold text-lana-700/40">{String(p.nombre).charAt(0).toUpperCase()}</Text></View>}
                </View>
                <Text numberOfLines={2} className="mt-2 px-1 text-sm font-semibold text-lana-900">{p.nombre}{p.es_combo ? ' (combo)' : ''}</Text>
                <Text className="px-1 text-sm font-semibold text-[#74784a]">{money(p.precio)}</Text>
                <View className="mt-2 flex-row items-center justify-between">
                  <Pressable onPress={() => cambiar(p, -1)} accessibilityLabel={`Quitar ${p.nombre}`} className="h-11 w-11 items-center justify-center rounded-xl bg-white"><Minus size={18} color={TEMA.lana['800']} /></Pressable>
                  <Text className="text-lg font-bold text-lana-900">{n}</Text>
                  <Pressable onPress={() => cambiar(p, 1)} accessibilityLabel={`Agregar ${p.nombre}`} className="h-11 w-11 items-center justify-center rounded-xl bg-lana-700"><Plus size={18} color="#fff" /></Pressable>
                </View>
              </View>
            );
          })}
        </View>
        <View style={{ height: unidades > 0 ? 72 : 0 }} />
      </Pantalla>

      {/* Barra del pedido en curso: aparece al elegir productos */}
      {unidades > 0 && (
        <View className="absolute bottom-3 left-4 right-4">
          <Pressable onPress={() => setNuevo(true)} accessibilityRole="button" className="min-h-[56px] flex-row items-center justify-between rounded-xl bg-lana-700 px-4" style={{ elevation: 4 }}>
            <View className="flex-row items-center gap-2">
              <ShoppingBag size={20} color="#fff" />
              <Text className="text-base font-semibold text-white">{unidades} {unidades === 1 ? 'producto' : 'productos'} · {money(subtotal)}</Text>
            </View>
            <Text className="text-base font-bold text-white">Continuar ›</Text>
          </Pressable>
        </View>
      )}

      <Hoja visible={nuevo} onClose={() => setNuevo(false)} titulo="Nuevo pedido">
        <NuevoPedido productos={productos} cant={cant} setCant={setCant} defectoPunto={data?.punto}
                     onListo={() => { setNuevo(false); setCant({}); recargar(); }} />
      </Hoja>
      <Hoja visible={verId !== null} onClose={() => setVerId(null)} titulo="Detalle del pedido" sinRelleno>
        {verId && <DetallePedido id={verId} onCambio={recargar} />}
      </Hoja>
    </View>
  );
}
