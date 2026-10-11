import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Alert } from 'react-native';
import { BadgeCheck, XCircle } from 'lucide-react-native';
import { supabase, mensajeError, type Fila } from '@/lib/supabase';
import { money, revalidarWeb } from '@/lib/utils';
import { cancelarPedido, marcarPagado } from '@/lib/pedidos';
import { Badge, ErrorMsg, useDatos } from '@/ui';
import { TicketEsqueleto } from '@/ui/esqueleto';

const MEDIO: Record<string, string> = { yape: 'Yape', efectivo: 'Efectivo' };
const fechaLarga = (f?: string | null) => (f ? new Date(f + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

/** Contenido del modal de detalle: ticket del pedido con su desglose y un único estado: Pagado. */
export function DetallePedido({ id, onCambio }: { id: string; onCambio?: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const { data, recargar, cargando } = useDatos<Fila>(async () => {
    const [p, items, saldo, cfg] = await Promise.all([
      supabase.from('pedidos').select('*').eq('id', id).single(),
      supabase.from('pedido_items').select('*').eq('pedido_id', id),
      supabase.from('v_pedidos_saldo').select('pagado, saldo').eq('id', id).single(),
      supabase.from('config').select('moneda_simbolo').limit(1).single(),
    ]);
    if (p.error) throw p.error;
    return { pedido: p.data, items: items.data ?? [], saldo: saldo.data, cfg: cfg.data };
  });

  const p = data?.pedido;
  if (!p) return cargando ? <TicketEsqueleto /> : <ErrorMsg texto="No se encontró el pedido." />;
  const simbolo = data?.cfg?.moneda_simbolo ?? 'S/';
  const cancelado = p.estado === 'cancelado';
  const pagado = p.estado === 'pagado';

  function cancelar() {
    Alert.alert('Cancelar pedido', `¿Cancelar el pedido #${p.numero}? Se devuelve el stock reservado.`, [
      { text: 'No', style: 'cancel' },
      { text: 'Sí, cancelar', style: 'destructive', onPress: async () => {
        setOcupado(true); setError(null);
        const { error: e } = await cancelarPedido(id);
        setOcupado(false);
        if (e) setError(mensajeError(e)); else { recargar(); revalidarWeb(); onCambio?.(); }
      } },
    ]);
  }

  async function pagar() {
    setOcupado(true); setError(null);
    const { error: e } = await marcarPagado(id);
    setOcupado(false);
    if (e) setError(mensajeError(e)); else { recargar(); revalidarWeb(); onCambio?.(); }
  }

  return (
    <>
      {/* Ticket físico: papel térmico con bordes dentados, letra de máquina y línea de corte */}
      <View style={{ elevation: 3 }} className="mx-1">
        <Dientes arriba />
        <View style={{ backgroundColor: PAPEL }} className="px-5 py-4">
          <View className="items-center">
            <Text style={MONO} className="text-lg font-bold uppercase tracking-widest text-lana-900">Lanita</Text>
            <Text style={MONO} className="text-xs uppercase text-lana-800">Arte en cemento · Hecho a mano</Text>
          </View>
          <Perforacion />
          <View className="items-center">
            <Text style={MONO} className="text-base font-bold text-lana-900">PEDIDO Nº {String(p.numero).padStart(4, '0')}</Text>
            <Text style={MONO} className="text-xs text-lana-800">{fechaLarga(p.fecha_pedido)}</Text>
          </View>
          <Perforacion />
          <Fila a="CLIENTE" b={p.cliente_nombre} />
          {p.cliente_whatsapp && <Fila a="TEL." b={`+${p.cliente_whatsapp}`} />}
          <Fila a="ENTREGA" b={fechaLarga(p.fecha_entrega)} />
          {p.punto_encuentro && <Fila a="LUGAR" b={p.punto_encuentro} />}
          {p.tematica && <Fila a="TEMÁTICA" b={p.tematica} />}
          {p.personalizacion && <Fila a="PERSONAL." b={p.personalizacion} />}
          {p.notas_produccion && <Fila a="NOTAS" b={p.notas_produccion} />}
          <Perforacion />

          {/* Desglose */}
          <View className="flex-row">
            <Text style={MONO} className="w-9 text-xs font-bold text-lana-900">CANT</Text>
            <Text style={MONO} className="flex-1 text-xs font-bold text-lana-900">DESCRIPCIÓN</Text>
            <Text style={MONO} className="w-[78px] text-right text-xs font-bold text-lana-900">IMPORTE</Text>
          </View>
          {data!.items.map((i: Fila) => (
            <View key={i.id} className="py-1">
              <View className="flex-row">
                <Text style={MONO} className="w-9 text-sm text-lana-900">{i.cantidad}</Text>
                <Text style={MONO} className="flex-1 pr-1 text-sm text-lana-900">{String(i.nombre_snapshot).toUpperCase()}</Text>
                <Text style={MONO} className="w-[78px] text-right text-sm text-lana-900">{money(i.subtotal, simbolo)}</Text>
              </View>
              <Text style={MONO} className="pl-9 text-xs text-lana-800">{i.cantidad} x {money(i.precio_unitario, simbolo)} c/u</Text>
            </View>
          ))}
          <Perforacion />

          <Total a="SUBTOTAL" b={money(p.subtotal, simbolo)} />
          {Number(p.descuento) > 0 && <Total a="DESCUENTO" b={`-${money(p.descuento, simbolo)}`} />}
          {Number(p.costo_envio) > 0 && <Total a="ENVÍO" b={money(p.costo_envio, simbolo)} />}
          <View className="my-1 border-t-2 border-lana-900" />
          <View className="flex-row items-center justify-between">
            <Text style={MONO} className="text-xl font-bold text-lana-900">TOTAL</Text>
            <Text style={MONO} className="text-xl font-bold text-lana-900">{money(p.total, simbolo)}</Text>
          </View>
          <Perforacion />
          <Fila a="PAGO CON" b={(MEDIO[p.medio_pago] ?? 'Efectivo').toUpperCase()} />
          <Fila a="ESTADO" b={cancelado ? 'CANCELADO' : pagado ? 'PAGADO' : 'PENDIENTE'} />
          <Perforacion />

          <View className="items-center pt-1">
            <Text style={MONO} className="text-sm font-bold text-lana-900">¡GRACIAS POR TU COMPRA!</Text>
            <Barras seed={Number(p.numero) || 1} />
            <Text style={MONO} className="text-[10px] tracking-widest text-lana-800">{String(p.numero).padStart(8, '0')}</Text>
          </View>
        </View>
        <Dientes />
      </View>

      <ErrorMsg texto={error} />

      {/* Pendiente: se puede pagar o cancelar. Pagado: ya no se cancela. */}
      {!cancelado && (
        <View className="flex-row gap-2">
          <Pressable onPress={pagar} disabled={pagado || ocupado} accessibilityRole="button" style={{ backgroundColor: pagado ? '#74784a' : '#e9c16a', opacity: ocupado ? 0.6 : 1 }}
                     className="min-h-[56px] flex-1 flex-row items-center justify-center gap-2 rounded-xl px-3">
            <BadgeCheck size={22} color={pagado ? '#ffffff' : '#3b3a2a'} />
            <Text style={{ color: pagado ? '#ffffff' : '#3b3a2a' }} className="text-base font-semibold">{pagado ? 'Pagado' : 'Marcar pagado'}</Text>
          </Pressable>
          {!pagado && (
            <Pressable onPress={cancelar} disabled={ocupado} accessibilityRole="button" style={{ borderColor: '#b84f0b', borderWidth: 2, opacity: ocupado ? 0.6 : 1 }}
                       className="min-h-[56px] flex-1 flex-row items-center justify-center gap-2 rounded-xl px-3">
              <XCircle size={22} color="#b84f0b" />
              <Text style={{ color: '#b84f0b' }} className="text-base font-semibold">Cancelar</Text>
            </Pressable>
          )}
        </View>
      )}
    </>
  );
}

const PAPEL = '#fbf8ef';
const MONO = { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' } as const;

function Fila({ a, b }: { a: string; b: string }) {
  return (
    <View className="flex-row justify-between gap-3 py-0.5">
      <Text style={MONO} className="text-xs text-lana-800">{a}</Text>
      <Text style={MONO} className="max-w-[65%] flex-1 text-right text-sm text-lana-900">{b}</Text>
    </View>
  );
}

function Total({ a, b }: { a: string; b: string }) {
  return (
    <View className="flex-row justify-between py-0.5">
      <Text style={MONO} className="text-sm text-lana-800">{a}</Text>
      <Text style={MONO} className="text-sm text-lana-900">{b}</Text>
    </View>
  );
}

/** Línea de corte punteada del ticket. */
function Perforacion() {
  return <View className="my-3 border-t border-dashed border-neutral-500" />;
}

/** Borde dentado del papel (arriba o abajo). */
function Dientes({ arriba = false }: { arriba?: boolean }) {
  return (
    <View className="h-2 flex-row justify-between overflow-hidden" style={{ backgroundColor: PAPEL }}>
      {Array.from({ length: 22 }, (_, i) => (
        <View key={i} className={`h-3 w-3 rotate-45 bg-white ${arriba ? '-mt-1.5' : '-mb-1.5 mt-1'}`} />
      ))}
    </View>
  );
}

/** Código de barras decorativo (varía con el número del pedido). */
function Barras({ seed }: { seed: number }) {
  const anchos = Array.from({ length: 34 }, (_, i) => 1 + ((seed * (i + 3) * 7 + i * 5) % 4));
  return (
    <View className="my-2 h-10 flex-row items-stretch justify-center gap-[2px]">
      {anchos.map((w, i) => <View key={i} style={{ width: w }} className="bg-lana-900" />)}
    </View>
  );
}
