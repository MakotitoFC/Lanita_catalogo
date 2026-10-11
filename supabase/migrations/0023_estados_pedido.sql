-- =====================================================================
-- Lanita · 0023 · Estados del pedido: pendiente, pagado y cancelado
-- Reemplaza el flujo anterior (en producción / listo / enviado / entregado).
--   pendiente  -> pagado       (solo si el pedido ya está cobrado por completo)
--   pendiente  -> cancelado    (devuelve el stock reservado)
--   pagado     -> cancelado    (devuelve el stock reservado)
-- Además el resumen de Inicio (dashboard_resumen) devuelve solo lo que usa la app.
-- =====================================================================

-- 1) Pasar los pedidos existentes a los nuevos estados (sin disparar las reglas de negocio).
alter table public.pedidos disable trigger user;
alter table public.pedidos drop constraint if exists pedidos_estado_check;
update public.pedidos p set estado = 'pagado'
  from public.v_pedidos_saldo s
 where s.id = p.id and p.estado = 'entregado' and s.saldo <= 0;
update public.pedidos set estado = 'pendiente' where estado not in ('pagado', 'cancelado');
alter table public.pedidos add constraint pedidos_estado_check check (estado in ('pendiente', 'pagado', 'cancelado'));
alter table public.pedidos enable trigger user;

-- 2) Transiciones permitidas.
create or replace function app.transicion_permitida(p_rol text, p_de text, p_a text)
returns boolean language sql immutable set search_path = '' as $$
  select case
    when p_de = p_a then true
    when p_rol is null or p_rol in ('admin', 'ventas') then (p_de || '>' || p_a) = any (array[
      'pendiente>pagado', 'pendiente>cancelado', 'pagado>cancelado'])
    else false
  end
$$;

-- 3) Reglas del pedido.
create or replace function app.tg_pedidos()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_rol text := app.rol_actual(); r record; v_pagado numeric; v_total numeric;
begin
  new.cliente_whatsapp := nullif(regexp_replace(coalesce(new.cliente_whatsapp, ''), '\D', '', 'g'), '');

  if tg_op = 'INSERT' then
    new.estado := 'pendiente';
    new.subtotal := 0;
    new.insumos_descontados := false;
    new.stock_productos_descontado := false;
    new.fecha_entrega_real := null;
    new.cancelado_motivo := null;
  else
    -- Banderas y subtotal NO son editables desde el cliente.
    new.numero := old.numero;
    new.insumos_descontados := old.insumos_descontados;
    new.stock_productos_descontado := old.stock_productos_descontado;
    select coalesce(sum(i.subtotal), 0) into new.subtotal from public.pedido_items i where i.pedido_id = new.id;

    if old.estado in ('pagado', 'cancelado') and new.estado = old.estado
       and (new.descuento is distinct from old.descuento or new.costo_envio is distinct from old.costo_envio) then
      raise exception 'Un pedido % no admite cambios de importes', old.estado;
    end if;

    if new.estado is distinct from old.estado then
      if not app.transicion_permitida(v_rol, old.estado, new.estado) then
        raise exception 'Cambio de estado no permitido (% -> %) para el rol %', old.estado, new.estado, coalesce(v_rol, 'sistema')
          using errcode = '42501';
      end if;

      if new.estado = 'cancelado' then
        -- Devuelve al stock lo reservado por este pedido.
        for r in select producto_id, sum(cantidad)::int as cant from public.pedido_items where pedido_id = new.id group by producto_id loop
          perform app.ajustar_stock_producto(r.producto_id, r.cant);
        end loop;
      end if;

      if new.estado = 'pagado' then
        v_total := new.subtotal - least(new.descuento, new.subtotal) + new.costo_envio;
        select coalesce(sum(case g.tipo when 'reembolso' then -g.monto else g.monto end), 0) into v_pagado
          from public.pagos g where g.pedido_id = new.id;
        if v_total - v_pagado > 0 then
          raise exception 'El pedido tiene saldo pendiente: registra el pago completo antes de marcarlo como pagado';
        end if;
      end if;
    end if;
  end if;

  new.descuento := least(new.descuento, new.subtotal);
  new.total := new.subtotal - new.descuento + new.costo_envio;
  return new;
end $$;

-- 4) Resumen de Inicio: solo lo que usa la app (cada rol recibe solo lo suyo).
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
        'hoy',    coalesce(sum(total) filter (where fecha_pedido = v_hoy), 0),
        'semana', coalesce(sum(total) filter (where fecha_pedido >= v_sem), 0),
        'mes',    coalesce(sum(total) filter (where fecha_pedido >= v_mes), 0))
      from public.pedidos
      where estado <> 'cancelado' and eliminado_en is null and fecha_pedido >= least(v_mes, v_sem)));
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

-- 5) Cambio de estado por RPC (sin motivo).
create or replace function public.pedido_cambiar_estado(p_pedido uuid, p_estado text, p_motivo text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app.es_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  update public.pedidos set estado = p_estado where id = p_pedido and eliminado_en is null;
  if not found then raise exception 'Pedido no encontrado'; end if;
end $$;
