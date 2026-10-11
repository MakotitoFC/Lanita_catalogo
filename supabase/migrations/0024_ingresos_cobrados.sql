-- =====================================================================
-- Lanita · 0024 · Ingresos = lo realmente cobrado
-- El resumen de Inicio calcula los ingresos (hoy / semana / mes) con los PAGOS recibidos
-- (restando reembolsos) de pedidos no cancelados, en vez de sumar el total de los pedidos.
-- La clave del JSON sigue siendo "ventas" para no romper la app.
-- =====================================================================
create or replace function public.dashboard_resumen()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_rol text;
  v_hoy date := app.hoy();
  v_sem date := date_trunc('week',  app.hoy())::date;
  v_mes date := date_trunc('month', app.hoy())::date;
  r jsonb := '{}'::jsonb;
begin
  if not app.es_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  v_rol := app.rol_actual();

  if v_rol in ('admin', 'ventas') then
    r := r || jsonb_build_object('ventas', (
      select jsonb_build_object(
        'hoy',    coalesce(sum(case g.tipo when 'reembolso' then -g.monto else g.monto end) filter (where g.fecha = v_hoy), 0),
        'semana', coalesce(sum(case g.tipo when 'reembolso' then -g.monto else g.monto end) filter (where g.fecha >= v_sem), 0),
        'mes',    coalesce(sum(case g.tipo when 'reembolso' then -g.monto else g.monto end) filter (where g.fecha >= v_mes), 0))
      from public.pagos g join public.pedidos p on p.id = g.pedido_id
      where p.estado <> 'cancelado' and p.eliminado_en is null and g.fecha >= least(v_mes, v_sem)));
    r := r || jsonb_build_object('saldo_por_cobrar', (
      select coalesce(sum(saldo), 0) from public.v_pedidos_saldo where estado = 'pendiente' and saldo > 0));
    r := r || jsonb_build_object('por_cobrar', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', id, 'numero', numero, 'cliente_nombre', cliente_nombre, 'total', total, 'fecha_entrega', fecha_entrega)
          order by fecha_entrega nulls last, numero), '[]'::jsonb)
        from (select id, numero, cliente_nombre, total, fecha_entrega from public.pedidos
               where eliminado_en is null and estado = 'pendiente'
               order by fecha_entrega nulls last, numero limit 8) q));
  end if;

  if v_rol = 'admin' then
    r := r || jsonb_build_object('gastos_mes', (
      select coalesce(sum(monto), 0) from public.gastos where eliminado_en is null and fecha >= v_mes));
  end if;

  r := r || jsonb_build_object('pedidos_pendientes',
    (select count(*) from public.pedidos where eliminado_en is null and estado = 'pendiente'));
  return r;
end $$;
