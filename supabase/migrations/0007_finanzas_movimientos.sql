-- =====================================================================
-- Lanita · 0007 · Gastos, movimientos de insumo y consumo automático
-- =====================================================================

create table public.gastos (
  id                  uuid primary key default gen_random_uuid(),
  fecha               date not null default app.hoy(),
  monto               numeric(12,2) not null check (monto > 0),
  categoria_gasto_id  uuid not null references public.categorias_gasto (id) on delete restrict,
  descripcion         text not null check (char_length(descripcion) between 3 and 300),
  metodo_pago         text not null default 'efectivo' check (metodo_pago in ('efectivo', 'transferencia', 'tarjeta', 'otro')),
  proveedor_id        uuid references public.proveedores (id) on delete set null,
  -- Ruta dentro del bucket PRIVADO "comprobantes" (no URL): se accede con URL firmada.
  comprobante_path    text check (comprobante_path is null or
                        (comprobante_path !~ '\.\.' and comprobante_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._/-]+$')),
  insumo_id           uuid references public.insumos (id) on delete set null,
  molde_id            uuid references public.moldes (id) on delete set null,
  pedido_id           uuid references public.pedidos (id) on delete set null,
  eliminado_en        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid,
  updated_by          uuid
);
create index gastos_fecha_idx     on public.gastos (fecha desc) where eliminado_en is null;
create index gastos_categoria_idx on public.gastos (categoria_gasto_id, fecha desc);

-- ---------------------------------------------------------------------
-- movimientos_insumo: libro inmutable; única vía para cambiar stock.
-- 'ajuste' lleva cantidad con signo (delta). Entradas con costo recalculan
-- el costo promedio ponderado del insumo.
-- ---------------------------------------------------------------------
create table public.movimientos_insumo (
  id               uuid primary key default gen_random_uuid(),
  insumo_id        uuid not null references public.insumos (id) on delete restrict,
  tipo             text not null check (tipo in ('entrada', 'salida', 'ajuste')),
  cantidad         numeric(14,3) not null check (cantidad <> 0),
  costo_unitario   numeric(14,4) check (costo_unitario is null or costo_unitario >= 0),
  motivo           text not null check (char_length(motivo) between 3 and 200),
  pedido_id        uuid references public.pedidos (id) on delete set null,
  gasto_id         uuid references public.gastos (id) on delete set null,
  stock_antes      numeric(14,3),
  stock_despues    numeric(14,3),
  fecha            timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid(),
  check (tipo = 'ajuste' or cantidad > 0)
);
create index movimientos_insumo_idx  on public.movimientos_insumo (insumo_id, fecha desc);
create index movimientos_pedido_idx  on public.movimientos_insumo (pedido_id) where pedido_id is not null;
create trigger tg_00_inmutable before update or delete on public.movimientos_insumo
  for each row execute function app.tg_inmutable();

create or replace function app.tg_movimiento_insumo()
returns trigger language plpgsql security definer set search_path = '' as $$
declare i public.insumos%rowtype; v_delta numeric;
begin
  select * into i from public.insumos where id = new.insumo_id and eliminado_en is null for update;
  if not found then raise exception 'El insumo no existe o está archivado'; end if;

  v_delta := case new.tipo when 'salida' then -new.cantidad else new.cantidad end;
  new.stock_antes   := i.stock_actual;
  new.stock_despues := i.stock_actual + v_delta;
  new.created_by    := auth.uid();
  new.created_at    := now();
  if new.stock_despues < 0 then
    raise exception 'Stock insuficiente de %: hay % y se intenta sacar %', i.nombre, i.stock_actual, abs(v_delta)
      using errcode = '23514';
  end if;

  perform set_config('app.mov', 'on', true);
  update public.insumos
     set stock_actual = new.stock_despues,
         costo_unitario = case
           when new.tipo = 'entrada' and new.costo_unitario is not null then
             case when i.stock_actual + new.cantidad > 0
                  then round((i.stock_actual * coalesce(i.costo_unitario, new.costo_unitario)
                              + new.cantidad * new.costo_unitario) / (i.stock_actual + new.cantidad), 4)
                  else new.costo_unitario end
           else i.costo_unitario end
   where id = i.id;
  perform set_config('app.mov', 'off', true);

  if i.alerta_activa and i.stock_minimo > 0
     and i.stock_actual > i.stock_minimo and new.stock_despues <= i.stock_minimo then
    perform app.notificar(array['admin', 'produccion'], 'stock_bajo',
                          'Stock bajo: ' || i.nombre,
                          'Quedan ' || new.stock_despues || ' ' || i.unidad_medida, 'insumos', i.id);
  end if;
  return new;
end $$;
create trigger tg_10_movimiento_insumo before insert on public.movimientos_insumo
  for each row execute function app.tg_movimiento_insumo();

-- ---------------------------------------------------------------------
-- Compra de insumo: gasto + entrada de stock en UNA transacción.
-- ---------------------------------------------------------------------
create or replace function public.registrar_compra_insumo(
  p_insumo uuid, p_cantidad numeric, p_monto_total numeric,
  p_proveedor uuid default null, p_fecha date default null,
  p_comprobante_path text default null, p_descripcion text default null,
  p_metodo_pago text default 'efectivo')
returns uuid language plpgsql security definer set search_path = '' as $$
declare i public.insumos%rowtype; v_cat uuid; v_gasto uuid;
begin
  if not app.tiene_rol(array['admin', 'produccion']) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then raise exception 'Cantidad inválida'; end if;
  if p_monto_total is null or p_monto_total <= 0 then raise exception 'Monto inválido'; end if;
  if p_comprobante_path is not null and split_part(p_comprobante_path, '/', 1) <> auth.uid()::text then
    raise exception 'Ruta de comprobante inválida' using errcode = '42501';
  end if;

  select * into i from public.insumos where id = p_insumo and eliminado_en is null;
  if not found then raise exception 'Insumo no encontrado'; end if;

  v_cat := coalesce(i.categoria_gasto_id,
                    (select id from public.categorias_gasto where slug = 'materia-prima'),
                    (select id from public.categorias_gasto order by created_at limit 1));

  insert into public.gastos (fecha, monto, categoria_gasto_id, descripcion, metodo_pago, proveedor_id,
                             comprobante_path, insumo_id)
  values (coalesce(p_fecha, app.hoy()), p_monto_total, v_cat,
          coalesce(p_descripcion, 'Compra de ' || i.nombre), p_metodo_pago,
          coalesce(p_proveedor, i.proveedor_id), p_comprobante_path, i.id)
  returning id into v_gasto;

  insert into public.movimientos_insumo (insumo_id, tipo, cantidad, costo_unitario, motivo, gasto_id)
  values (i.id, 'entrada', p_cantidad, round(p_monto_total / p_cantidad, 4), 'Compra', v_gasto);

  return v_gasto;
end $$;

-- ---------------------------------------------------------------------
-- Consumo automático al pasar un pedido a producción:
--   recetas × cantidad + empaque por producto + empaque por pedido.
-- Si faltan insumos: bloquea (config.bloquear_sin_stock) o descuenta lo
-- disponible y avisa al admin.
-- ---------------------------------------------------------------------
create or replace function app.descontar_insumos_pedido(p_pedido uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r record; v_numero bigint; v_bloquear boolean; v_cant numeric; v_unidades int;
begin
  select numero into v_numero from public.pedidos where id = p_pedido;
  select bloquear_sin_stock into v_bloquear from public.config limit 1;
  select coalesce(sum(cantidad), 0) into v_unidades from public.pedido_items where pedido_id = p_pedido;

  for r in
    select x.insumo_id, sum(x.cantidad) as requerido, n.nombre, n.stock_actual
    from (
      select rc.insumo_id, rc.cantidad * pi.cantidad as cantidad
        from public.pedido_items pi join public.recetas rc on rc.producto_id = pi.producto_id
       where pi.pedido_id = p_pedido
      union all
      select e.insumo_id, e.cantidad * v_unidades
        from public.empaque_default e where e.activo and e.aplica_por = 'producto'
      union all
      select e.insumo_id, e.cantidad
        from public.empaque_default e where e.activo and e.aplica_por = 'pedido'
    ) x
    join public.insumos n on n.id = x.insumo_id and n.eliminado_en is null
    group by x.insumo_id, n.nombre, n.stock_actual
  loop
    v_cant := r.requerido;
    if v_cant > r.stock_actual then
      if v_bloquear then
        raise exception 'Stock insuficiente de %: se necesitan % y hay %', r.nombre, r.requerido, r.stock_actual
          using errcode = '23514';
      end if;
      v_cant := r.stock_actual;
      perform app.notificar(array['admin'], 'stock_insuficiente',
                            'Faltó stock de ' || r.nombre || ' (pedido #' || v_numero || ')',
                            'Requerido ' || r.requerido || ', descontado ' || v_cant, 'pedidos', p_pedido);
    end if;
    if v_cant > 0 then
      insert into public.movimientos_insumo (insumo_id, tipo, cantidad, motivo, pedido_id)
      values (r.insumo_id, 'salida', v_cant, 'Consumo pedido #' || v_numero, p_pedido);
    end if;
  end loop;
end $$;
