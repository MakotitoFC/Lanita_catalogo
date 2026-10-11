import { supabase } from '@/lib/supabase';

type Resultado = { error: { message: string } | null };

/**
 * Marca un pedido como PAGADO: registra el cobro del saldo con el medio de pago elegido al crear el pedido
 * y cambia el estado a "pagado".
 */
export async function marcarPagado(id: string): Promise<Resultado> {
  const [p, s] = await Promise.all([
    supabase.from('pedidos').select('*').eq('id', id).single(),
    supabase.from('v_pedidos_saldo').select('pagado, saldo').eq('id', id).single(),
  ]);
  if (p.error) return { error: p.error };
  if (p.data.estado === 'cancelado') return { error: { message: 'El pedido está cancelado.' } };
  const saldo = Number(s.data?.saldo ?? p.data.total);
  if (saldo > 0) {
    const r = await supabase.from('pagos').insert({
      pedido_id: id, monto: saldo, metodo_pago: p.data.medio_pago ?? 'efectivo', tipo: Number(s.data?.pagado) > 0 ? 'saldo' : 'anticipo',
    });
    if (r.error) return { error: r.error };
  }
  if (p.data.estado !== 'pagado') {
    const r = await supabase.rpc('pedido_cambiar_estado', { p_pedido: id, p_estado: 'pagado' });
    if (r.error) return { error: r.error };
  }
  return { error: null };
}

/** Cancela un pedido (devuelve el stock reservado). No pide motivo. */
export async function cancelarPedido(id: string): Promise<Resultado> {
  const r = await supabase.rpc('pedido_cambiar_estado', { p_pedido: id, p_estado: 'cancelado' });
  return { error: r.error };
}
