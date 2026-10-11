-- =====================================================================
-- Lanita · 0016 · Stock automático de productos terminados
--
-- Regla: al REGISTRAR un pedido (sus ítems) el stock de los productos que NO son "bajo pedido" baja solo;
-- si el pedido se cancela, el stock vuelve. Cuando el stock llega a 0 el producto queda "agotado" en la web
-- (disponible = false) y vuelve a estar disponible al reponer stock.
-- Productos "bajo pedido" (se elaboran al recibir el pedido) no tocan stock.
-- =====================================================================

-- Ajuste atómico y seguro (bloquea la fila). Impide vender más de lo que hay.
create or replace function app.ajustar_stock_producto(p_producto uuid, p_delta int)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.productos%rowtype;
begin
  if p_delta = 0 then return; end if;
  select * into v from public.productos where id = p_producto for update;
  if not found or v.bajo_pedido then return; end if;
  if v.stock + p_delta < 0 then
    raise exception 'Stock insuficiente de %: hay % y se piden %', v.nombre, v.stock, abs(p_delta) using errcode = '23514';
  end if;
  update public.productos set stock = stock + p_delta where id = p_producto;
end $$;

-- Productos: el stock manda sobre "disponible" cuando no es bajo pedido.
create or replace function app.tg_productos()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.slug is null or new.slug = '' then new.slug := app.slugify(new.nombre); end if;

  if tg_op = 'UPDATE' then
    if new.precio is distinct from old.precio then
      insert into public.precios_historico (producto_id, precio_anterior, precio_nuevo, motivo)
      values (new.id, old.precio, new.precio, new.motivo_cambio_precio);
    end if;
    if old.es_combo and not new.es_combo
       and exists (select 1 from public.combo_items where combo_id = new.id) then
      raise exception 'Quite primero los ítems del combo antes de convertirlo en producto';
    end if;
    if not old.es_combo and new.es_combo
       and exists (select 1 from public.combo_items where producto_id = new.id) then
      raise exception 'Este producto forma parte de combos; no puede convertirse en combo';
    end if;
    -- Stock agotado => agotado en la web; repuesto => disponible.
    if new.stock is distinct from old.stock and not new.bajo_pedido then
      new.disponible := new.stock > 0;
    end if;
  end if;
  new.motivo_cambio_precio := null;

  -- Publicar exige datos mínimos (solo al pasar a publicado).
  if new.publicado and (tg_op = 'INSERT' or not old.publicado) then
    if new.precio <= 0 then raise exception 'Un producto publicado necesita precio mayor a 0'; end if;
    if new.imagen_url is null and not (
         new.es_combo and exists (select 1 from public.combos_fotos where combo_id = new.id)) then
      raise exception 'Un producto publicado necesita imagen (o, si es combo, al menos una foto)';
    end if;
  end if;
  return new;
end $$;

-- Ítems del pedido: descuentan / devuelven stock.
create or replace function app.tg_pedido_items_stock()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform app.ajustar_stock_producto(new.producto_id, -new.cantidad);
  elsif tg_op = 'DELETE' then
    perform app.ajustar_stock_producto(old.producto_id, old.cantidad);
  else
    if new.producto_id = old.producto_id then
      perform app.ajustar_stock_producto(new.producto_id, old.cantidad - new.cantidad);
    else
      perform app.ajustar_stock_producto(old.producto_id, old.cantidad);
      perform app.ajustar_stock_producto(new.producto_id, -new.cantidad);
    end if;
  end if;
  return null;
end $$;
drop trigger if exists tg_15_pedido_items_stock on public.pedido_items;
create trigger tg_15_pedido_items_stock after insert or update or delete on public.pedido_items
  for each row execute function app.tg_pedido_items_stock();

-- Pedidos: ya no se descuenta al enviar; al CANCELAR se devuelve el stock.
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
        if coalesce(new.cancelado_motivo, '') = '' then raise exception 'Indique el motivo de la cancelación'; end if;
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
