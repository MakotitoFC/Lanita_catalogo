-- =====================================================================
-- Lanita · 0021 · Pedido simple
--   · El pedido guarda el MEDIO DE PAGO elegido al registrarlo (yape / efectivo).
--   · Cancelar un pedido ya no pide motivo.
--   · Se elimina la captura (comprobante) de los pagos: el negocio ya no la adjunta.
--     (Los comprobantes de GASTOS se mantienen.)
-- =====================================================================

alter table public.pedidos
  add column medio_pago text not null default 'efectivo' check (medio_pago in ('yape', 'efectivo'));

alter table public.pagos drop column if exists comprobante_path;

-- Cancelar sin motivo obligatorio (devuelve el stock reservado igual que antes).
create or replace function app.tg_pedidos()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_rol text := app.rol_actual(); v_n int; r record;
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

    if old.estado in ('entregado', 'cancelado') and new.estado = old.estado
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

      if new.estado = 'en_produccion' and not old.insumos_descontados then
        select count(*) into v_n from public.pedido_items where pedido_id = new.id;
        if v_n = 0 then raise exception 'El pedido no tiene productos'; end if;
        perform app.descontar_insumos_pedido(new.id);
        new.insumos_descontados := true;
      end if;

      if new.estado = 'entregado' then new.fecha_entrega_real := coalesce(new.fecha_entrega_real, app.hoy()); end if;
    end if;
  end if;

  new.descuento := least(new.descuento, new.subtotal);
  new.total := new.subtotal - new.descuento + new.costo_envio;
  return new;
end $$;

-- crear_pedido con medio de pago.
create or replace function public.crear_pedido(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id  uuid := coalesce(nullif(p ->> 'id', '')::uuid, gen_random_uuid());
  v_wa  text := nullif(regexp_replace(coalesce(p ->> 'cliente_whatsapp', ''), '\D', '', 'g'), '');
  v_nom text := btrim(coalesce(p ->> 'cliente_nombre', ''));
  v_cli uuid;
  it    jsonb;
begin
  if not app.tiene_rol(array['admin', 'ventas']) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if exists (select 1 from public.pedidos where id = v_id) then return v_id; end if;   -- idempotente
  if jsonb_typeof(p -> 'items') is distinct from 'array' or jsonb_array_length(p -> 'items') = 0 then
    raise exception 'Agregue al menos un producto';
  end if;

  if v_wa is not null then
    select id into v_cli from public.clientes where whatsapp = v_wa and eliminado_en is null;
    if v_cli is null then
      insert into public.clientes (nombre, whatsapp, canal_preferido)
      values (v_nom, v_wa, coalesce(p ->> 'canal', 'whatsapp')) returning id into v_cli;
    end if;
  end if;

  insert into public.pedidos (id, cliente_id, cliente_nombre, cliente_whatsapp, direccion_entrega, punto_encuentro, requiere_envio,
                              canal, fecha_entrega, tematica, personalizacion, notas, notas_produccion,
                              descuento, costo_envio, caja_envio_id, medio_pago)
  values (v_id, v_cli, v_nom, v_wa, nullif(p ->> 'direccion_entrega', ''),
          coalesce(nullif(p ->> 'punto_encuentro', ''), (select punto_encuentro_defecto from public.config limit 1)),
          coalesce((p ->> 'requiere_envio')::boolean, false), coalesce(p ->> 'canal', 'whatsapp'),
          nullif(p ->> 'fecha_entrega', '')::date, nullif(p ->> 'tematica', ''), nullif(p ->> 'personalizacion', ''),
          nullif(p ->> 'notas', ''), nullif(p ->> 'notas_produccion', ''),
          coalesce((p ->> 'descuento')::numeric, 0), coalesce((p ->> 'costo_envio')::numeric, 0),
          (select caja_defecto_id from public.config limit 1),
          coalesce(nullif(p ->> 'medio_pago', ''), 'efectivo'));

  for it in select * from jsonb_array_elements(p -> 'items') loop
    insert into public.pedido_items (pedido_id, producto_id, cantidad, precio_unitario, notas)
    values (v_id, (it ->> 'producto_id')::uuid, (it ->> 'cantidad')::int,
            nullif(it ->> 'precio_unitario', '')::numeric, nullif(it ->> 'notas', ''));
  end loop;
  return v_id;
end $$;

revoke all on function public.crear_pedido(jsonb) from public, anon, authenticated;
grant execute on function public.crear_pedido(jsonb) to authenticated;
