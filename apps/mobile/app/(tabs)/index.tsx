import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import { Check, X, HandCoins, PiggyBank, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react-native';
import { TEMA } from '@lanita/shared';
import { supabase, type Fila } from '@/lib/supabase';
import { pendientes, sincronizarCola } from '@/lib/cola';
import { useAuth } from '@/lib/auth';
import { money } from '@/lib/utils';
import { Hoja } from '@/ui/hoja';
import { DetallePedido } from '@/componentes/DetallePedido';
import { cancelarPedido, marcarPagado } from '@/lib/pedidos';
import { Boton, Cargando, Encabezado, ErrorMsg, Nota, Pantalla, Tarjeta, Texto, useDatos } from '@/ui';
import { Foto, InicioEsqueleto } from '@/ui/esqueleto';

/** Indicador con fondo suave, icono en contenedor cuadrado de esquinas redondeadas y valor. */
function Kpi({ icono: Icono, titulo, valor, fondo, tono }: { icono: LucideIcon; titulo: string; valor: string; fondo: string; tono?: string }) {
  return (
    <View style={{ backgroundColor: fondo }} className="min-w-[46%] flex-1 gap-3 rounded-2xl p-4">
      <View className="flex-row items-center gap-2">
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-white/80"><Icono size={22} color={TEMA.lana['700']} /></View>
        <Text numberOfLines={1} className={`flex-1 text-xl font-bold ${tono ?? 'text-lana-900'}`}>{valor}</Text>
      </View>
      <Text className="text-sm text-lana-800">{titulo}</Text>
    </View>
  );
}

/** Contenedor con barra de título gris (estilo tabla). */
function Cuadro({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View className="overflow-hidden rounded-2xl border border-neutral-300 bg-white">
      <View className="bg-neutral-100 px-4 py-3"><Text className="text-base font-semibold text-lana-900">{titulo}</Text></View>
      {children}
    </View>
  );
}

export default function Inicio() {
  const { perfil } = useAuth();
  const [verId, setVerId] = useState<string | null>(null);
  const { data, cargando, error, recargar } = useDatos<Fila>(async () => {
    const { data, error } = await supabase.rpc('dashboard_resumen');
    if (error) throw error;
    return data as Fila;
  });
  const [logo, setLogo] = useState<string | null>(null);
  useEffect(() => { supabase.from('config').select('logo_url').limit(1).single().then(({ data: c }) => setLogo(c?.logo_url ?? null)); }, [data]);
  const [compras, setCompras] = useState<Fila[]>([]);
  useEffect(() => {
    supabase.from('gastos').select('id, fecha, cantidad, monto, insumos(nombre)').not('insumo_id', 'is', null).is('eliminado_en', null).order('fecha', { ascending: false }).limit(4)
      .then(({ data: d }) => setCompras((d as Fila[] | null) ?? []));
  }, [data]);
  const [enCola, setEnCola] = useState(0);
  useEffect(() => { pendientes().then(setEnCola); }, [data]);

  async function cobrar(id: string) {
    const { error: e } = await marcarPagado(id);
    if (e) return Alert.alert('No se pudo marcar como pagado', e.message);
    recargar();
  }
  function anular(p: Fila) {
    Alert.alert('Cancelar pedido', `¿Cancelar el pedido #${p.numero} de ${p.cliente_nombre}?`, [
      { text: 'No', style: 'cancel' },
      { text: 'Sí, cancelar', style: 'destructive', onPress: async () => {
        const { error: e } = await cancelarPedido(p.id);
        if (e) Alert.alert('No se pudo cancelar', e.message); else recargar();
      } },
    ]);
  }

  const ventas = data?.ventas;
  const balance = ventas && data?.gastos_mes != null ? Number(ventas.mes) - Number(data.gastos_mes) : null;

  return (
    <Pantalla arriba onRefresh={recargar} refrescando={cargando}>
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1"><Encabezado titulo={`Hola, ${perfil?.nombre.split(' ')[0] ?? ''}`} descripcion="Así va tu negocio este mes." /></View>
        {logo ? <Foto uri={logo} className="h-14 w-14 rounded-full border border-neutral-300 bg-white" resizeMode="cover" accessibilityLabel="Logo" /> : null}
      </View>
      <ErrorMsg texto={error} />
      {cargando && !data && <InicioEsqueleto />}

      {enCola > 0 && (
        <Tarjeta>
          <Texto>Tienes {enCola} pedido(s) guardados sin conexión.</Texto>
          <View className="mt-2"><Boton titulo="Sincronizar ahora" variante="suave" onPress={async () => { await sincronizarCola(); setEnCola(await pendientes()); recargar(); }} /></View>
        </Tarjeta>
      )}

      {ventas && (
        <>
          <View className="flex-row flex-wrap gap-3">
            <Kpi icono={TrendingUp} titulo="Ingresos del mes" valor={money(ventas.mes)} fondo="#eef0e4" />
            {data.gastos_mes != null && <Kpi icono={TrendingDown} titulo="Gastos del mes" valor={money(data.gastos_mes)} fondo="#f8efd6" />}
            {balance != null && <Kpi icono={PiggyBank} titulo="Balance del mes" valor={money(balance)} fondo="#e3efe6" tono={balance < 0 ? 'text-peligro' : undefined} />}
            <Kpi icono={HandCoins} titulo="Por cobrar" valor={money(data.saldo_por_cobrar)} fondo="#f6e5dc" />
          </View>
        </>
      )}

      {data && (
        <Cuadro titulo={`Pendientes · ${data.pedidos_pendientes}`}>
          {(data.por_cobrar ?? []).length === 0 && <Text className="px-4 py-4 text-base text-lana-800">No tienes pedidos pendientes.</Text>}
          {data.por_cobrar?.map((p: Fila, k: number) => (
            <View key={p.id} className={`flex-row items-center ${k > 0 ? 'border-t border-neutral-200' : ''}`}>
              <Pressable onPress={() => setVerId(p.id)} className="min-w-0 flex-1 px-4 py-3">
                <Text numberOfLines={1} className="text-base font-semibold text-lana-900">#{p.numero} · {p.cliente_nombre}</Text>
                <Text className="text-sm text-lana-800">{money(p.total)} · {p.fecha_entrega ? `Entrega ${p.fecha_entrega}` : 'Sin fecha de entrega'}</Text>
              </Pressable>
              <Pressable onPress={() => cobrar(p.id)} hitSlop={4} accessibilityRole="button" accessibilityLabel={`Marcar el pedido ${p.numero} como pagado`}
                         className="mr-2 h-11 w-11 items-center justify-center rounded-full border-2 border-[#2e9e5b]">
                <Check size={20} color="#2e9e5b" strokeWidth={2.5} />
              </Pressable>
              <Pressable onPress={() => anular(p)} hitSlop={4} accessibilityRole="button" accessibilityLabel={`Cancelar el pedido ${p.numero}`}
                         className="mr-3 h-11 w-11 items-center justify-center rounded-full border-2 border-[#d33a2c]">
                <X size={20} color="#d33a2c" strokeWidth={2.5} />
              </Pressable>
            </View>
          ))}
        </Cuadro>
      )}

      {compras.length > 0 && (
        <Cuadro titulo="Compras de insumos recientes">
          <View className="flex-row px-4 pb-1 pt-3">
            <Text className="flex-1 text-sm font-semibold text-lana-900">Insumo</Text>
            <Text className="w-20 text-center text-sm font-semibold text-lana-900">Cant.</Text>
            <Text className="w-20 text-right text-sm font-semibold text-lana-900">Monto</Text>
          </View>
          {compras.map((c: Fila) => (
            <View key={c.id} className="flex-row items-center px-4 py-3">
              <View className="flex-1 pr-2">
                <Text numberOfLines={1} className="text-base text-lana-800">{c.insumos?.nombre ?? 'Insumo'}</Text>
                <Text className="text-xs text-lana-500">{c.fecha}</Text>
              </View>
              <View className="w-20 items-center">
                <View className="min-h-[32px] min-w-[32px] items-center justify-center rounded-full border border-lana-700 px-1.5">
                  <Text className="text-sm font-semibold text-lana-900">{Number(c.cantidad)}</Text>
                </View>
              </View>
              <Text className="w-20 text-right text-base text-lana-800">{money(c.monto)}</Text>
            </View>
          ))}
        </Cuadro>
      )}

      <Hoja visible={verId !== null} onClose={() => setVerId(null)} titulo="Detalle del pedido" sinRelleno>
        {verId && <DetallePedido id={verId} onCambio={recargar} />}
      </Hoja>
    </Pantalla>
  );
}
