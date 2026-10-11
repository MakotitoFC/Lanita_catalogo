import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { TEMA } from '@lanita/shared';
import { supabase, type Fila } from '@/lib/supabase';
import { hoyISO, money } from '@/lib/utils';
import { Encabezado, ErrorMsg, Nota, Pantalla, useDatos } from '@/ui';
import { Hoja } from '@/ui/hoja';
import { Paginador } from '@/ui/paginador';
import { Selector } from '@/ui/selector';
import { Bloque, FilasEsqueleto } from '@/ui/esqueleto';
import { DetallePedido } from '@/componentes/DetallePedido';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const POR_PAGINA = 6;
const MEDIOS: Record<string, string> = { yape: 'Yape', efectivo: 'Efectivo', plin: 'Plin', transferencia: 'Transferencia', tarjeta: 'Tarjeta', otro: 'Otro' };
const mover = (m: string, d: number) => { const [y, mm] = m.split('-').map(Number); const dt = new Date(y!, mm! - 1 + d, 1); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`; };
const fechaCorta = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' });
const neto = (g: Fila) => (g.tipo === 'reembolso' ? -Number(g.monto) : Number(g.monto));

/** Registro de ventas cobradas: cada pago recibido de un pedido es un ingreso. */
export default function Ingresos() {
  const [mes, setMes] = useState(hoyISO().slice(0, 7));
  const [medio, setMedio] = useState('todos');
  const [pagina, setPagina] = useState(1);
  const [verId, setVerId] = useState<string | null>(null);

  // Desde 5 meses antes: sirve para el gráfico de los últimos 6 meses.
  const { data, cargando, error, recargar } = useDatos<Fila[]>(async () => {
    const desde = `${mover(mes, -5)}-01`, hasta = `${mover(mes, 1)}-01`;
    const { data, error } = await supabase.from('pagos')
      .select('id, fecha, monto, tipo, metodo_pago, pedido_id, pedidos!inner(numero, cliente_nombre, estado, eliminado_en)')
      .gte('fecha', desde).lt('fecha', hasta).order('fecha', { ascending: false }).limit(1000);
    if (error) throw error;
    return (data ?? []).filter((g: Fila) => g.pedidos?.estado !== 'cancelado' && !g.pedidos?.eliminado_en);
  });

  const todos = (data ?? []).filter((g) => medio === 'todos' || g.metodo_pago === medio);
  const delMes = todos.filter((g) => g.fecha.startsWith(mes));
  const total = delMes.reduce((s, g) => s + neto(g), 0);

  const porMedio = new Map<string, number>();
  for (const g of delMes) porMedio.set(g.metodo_pago, (porMedio.get(g.metodo_pago) ?? 0) + neto(g));
  const medios = [...porMedio].sort((a, b) => b[1] - a[1]);

  const meses = Array.from({ length: 6 }, (_, i) => mover(mes, i - 5));
  const totalesMes = meses.map((m) => todos.filter((g) => g.fecha.startsWith(m)).reduce((s, g) => s + neto(g), 0));
  const maxMes = Math.max(1, ...totalesMes);

  const paginas = Math.max(1, Math.ceil(delMes.length / POR_PAGINA));
  const actual = Math.min(pagina, paginas);
  const visibles = delMes.slice((actual - 1) * POR_PAGINA, actual * POR_PAGINA);

  return (
    <Pantalla arriba onRefresh={recargar} refrescando={cargando}>
      <Encabezado titulo="Ingresos" descripcion="Registro de todas tus ventas cobradas." />
      <Selector valor={medio} onChange={(v) => { setMedio(v); setPagina(1); }}
                opciones={[{ id: 'todos', texto: 'Todos los medios de pago' }, { id: 'yape', texto: 'Yape' }, { id: 'efectivo', texto: 'Efectivo' }]} />

      {cargando && !data && (<><Bloque className="h-20 rounded-2xl" /><Bloque className="h-44 rounded-2xl" /><FilasEsqueleto n={4} /></>)}

      <View className="flex-row items-center justify-between rounded-2xl border border-neutral-300 bg-white p-3">
        <Pressable onPress={() => { setMes(mover(mes, -1)); setPagina(1); }} hitSlop={8} accessibilityLabel="Mes anterior" className="h-10 w-10 items-center justify-center rounded-full border border-neutral-300"><ChevronLeft size={18} color={TEMA.lana['700']} /></Pressable>
        <View className="items-center">
          <Text className="text-sm text-lana-800">{MESES[Number(mes.slice(5)) - 1]} {mes.slice(0, 4)}</Text>
          <Text className="text-2xl font-bold text-[#74784a]">{money(total)}</Text>
        </View>
        <Pressable onPress={() => { setMes(mover(mes, 1)); setPagina(1); }} hitSlop={8} accessibilityLabel="Mes siguiente" className="h-10 w-10 items-center justify-center rounded-full border border-neutral-300"><ChevronRight size={18} color={TEMA.lana['700']} /></Pressable>
      </View>

      <View className="rounded-2xl border border-neutral-300 bg-white p-4">
        <Text className="mb-3 text-base font-semibold text-lana-900">Últimos 6 meses</Text>
        <View className="h-36 flex-row items-end justify-between gap-2">
          {meses.map((m, i) => (
            <View key={m} className="flex-1 items-center justify-end">
              <Text className="mb-1 text-[10px] text-lana-800" numberOfLines={1}>{totalesMes[i]! > 0 ? Math.round(totalesMes[i]!) : ''}</Text>
              <View style={{ height: Math.max(4, (totalesMes[i]! / maxMes) * 100) }} className={`w-full rounded-t-lg ${m === mes ? 'bg-lana-700' : 'bg-lana-300'}`} />
              <Text className="mt-1 text-xs text-lana-800">{MESES[Number(m.slice(5)) - 1]!.slice(0, 3)}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="rounded-2xl border border-neutral-300 bg-white p-4">
        <Text className="mb-3 text-base font-semibold text-lana-900">Cómo te pagaron este mes</Text>
        {medios.length === 0 && <Nota>Sin ingresos en este mes.</Nota>}
        {medios.map(([id, t]) => (
          <View key={id} className="mb-3">
            <View className="mb-1 flex-row justify-between">
              <Text className="text-sm text-lana-800">{MEDIOS[id] ?? id}</Text>
              <Text className="text-sm font-semibold text-lana-900">{money(t)} · {Math.round((t / (total || 1)) * 100)}%</Text>
            </View>
            <View className="h-3 overflow-hidden rounded-full bg-neutral-100"><View style={{ width: `${Math.max(3, (t / (medios[0]![1] || 1)) * 100)}%` }} className="h-3 rounded-full bg-lana-700" /></View>
          </View>
        ))}
      </View>

      <Text className="mt-1 text-lg font-semibold text-lana-800">Registro de ventas</Text>
      <ErrorMsg texto={error} />
      {delMes.length === 0 && !cargando && <Nota>No hay ventas cobradas en este mes.</Nota>}
      <View className="overflow-hidden rounded-2xl border border-neutral-300 bg-white">
        {visibles.map((g, i) => (
          <Pressable key={g.id} onPress={() => setVerId(g.pedido_id)} accessibilityRole="button" className={`flex-row items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-neutral-200' : ''}`}>
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="text-base font-semibold text-lana-900">#{g.pedidos?.numero} · {g.pedidos?.cliente_nombre}</Text>
              <Text className="text-sm text-lana-800">{fechaCorta(g.fecha)} · {MEDIOS[g.metodo_pago] ?? g.metodo_pago}{g.tipo === 'reembolso' ? ' · reembolso' : ''}</Text>
            </View>
            <Text className={`text-base font-bold ${g.tipo === 'reembolso' ? 'text-peligro' : 'text-[#74784a]'}`}>{g.tipo === 'reembolso' ? '−' : ''}{money(g.monto)}</Text>
          </Pressable>
        ))}
      </View>
      <Paginador pagina={actual} total={paginas} onChange={setPagina} />

      <Hoja visible={verId !== null} onClose={() => setVerId(null)} titulo="Detalle del pedido" sinRelleno>
        {verId && <DetallePedido id={verId} onCambio={recargar} />}
      </Hoja>
    </Pantalla>
  );
}
