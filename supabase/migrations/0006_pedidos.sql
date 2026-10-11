-- =====================================================================
-- Lanita · 0006 · Clientes, pedidos, ítems y pagos
-- Datos personales (nombre, WhatsApp, dirección) SOLO visibles a admin y
-- ventas. Producción trabaja con vistas sin datos personales (0008).
-- =====================================================================

create table public.clientes (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null check (char_length(nombre) between 2 and 100),
  whatsapp          text check (whatsapp is null or whatsapp ~ '^[0-9]{8,15}$'),   -- con código de país
  email             text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  direccion         text check (char_length(direccion) <= 300),
  ciudad            text check (char_length(ciudad) <= 80),
  canal_preferido   text check (canal_preferido in ('whatsapp', 'instagram', 'tiktok', 'facebook', 'presencial')),
  notas             text check (char_length(notas) <= 1000),
  eliminado_en      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid,
  updated_by        uuid
);
create unique index clientes_whatsapp_uq on public.clientes (whatsapp) where whatsapp is not null and eliminado_en is null;

create or replace function app.tg_normalizar_whatsapp()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.whatsapp := nullif(regexp_replace(coalesce(new.whatsapp, ''), '\D', '', 'g'), '');
  return new;
end $$;
create trigger tg_05_normalizar before insert or update on public.clientes
  for each row execute function app.tg_normalizar_whatsapp();

-- ---------------------------------------------------------------------
-- pedidos. El cliente puede generar el uuid (id) al crear offline: el
-- upsert es idempotente. Totales los calcula SIEMPRE la base de datos.
-- ---------------------------------------------------------------------
create table public.pedidos (
  id                         uuid primary key default gen_random_uuid(),
  numero                     bigint generated always as identity unique,
  cliente_id                 uuid references public.clientes (id) on delete set null,
  cliente_nombre             text not null check (char_length(cliente_nombre) between 2 and 100),
  cliente_whatsapp           text check (cliente_whatsapp is null or cliente_whatsapp ~ '^[0-9]{8,15}$'),
  direccion_entrega          text check (char_length(direccion_entrega) <= 300),
  requiere_envio             boolean not null default false,
  canal                      text not null default 'whatsapp' check (canal in ('whatsapp', 'instagram', 'tiktok', 'facebook', 'presencial')),
  estado                     text not null default 'pendiente'
                               check (estado in ('pendiente', 'en_produccion', 'listo', 'enviado', 'entregado', 'cancelado')),
  fecha_pedido               date not null default app.hoy(),
  fecha_entrega              date,                     -- prometida
  fecha_entrega_real         date,
  tematica                   text check (char_length(tematica) <= 60),
  personalizacion            text check (char_length(personalizacion) <= 1000),
  notas                      text check (char_length(notas) <= 2000),              -- internas (ventas/admin)
  notas_produccion           text check (char_length(notas_produccion) <= 1000),   -- visibles a producción
  caja_envio_id              uuid references public.cajas_envio (id) on delete set null,
  subtotal                   numeric(12,2) not null default 0,
  descuento                  numeric(12,2) not null default 0 check (descuento >= 0),
  costo_envio                numeric(12,2) not null default 0 check (costo_envio >= 0),
  total                      numeric(12,2) not null default 0,
  cancelado_motivo           text check (char_length(cancelado_motivo) <= 300),
  insumos_descontados        boolean not null default false,
  stock_productos_descontado boolean not null default false,
  eliminado_en               timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  created_by                 uuid,
  updated_by                 uuid,
  check (fecha_entrega is null or fecha_entrega >= fecha_pedido)
);
create index pedidos_estado_idx  on public.pedidos (estado, fecha_entrega) where eliminado_en is null;
create index pedidos_fecha_idx   on public.pedidos (fecha_pedido desc);
create index pedidos_cliente_idx on public.pedidos (cliente_id);

create table public.pedido_items (
  id               uuid primary key default gen_random_uuid(),
  pedido_id        uuid not null references public.pedidos (id) on delete cascade,
  producto_id      uuid not null references public.productos (id) on delete restrict,  -- producto o combo
  nombre_snapshot  text not null,                          -- nombre al momento de la venta
  cantidad         int not null check (cantidad between 1 and 9999),
  precio_unitario  numeric(12,2) not null check (precio_unitario >= 0),
  subtotal         numeric(12,2) generated always as (cantidad * precio_unitario) stored,
  notas            text check (char_length(notas) <= 300),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid,
  updated_by       uuid
);
create index pedido_items_pedido_idx   on public.pedido_items (pedido_id);
create index pedido_items_producto_idx on public.pedido_items (producto_id);

-- Pagos: libro inmutable. Errores se corrigen con un 'reembolso'.
create table public.pagos (
  id               uuid primary key default gen_random_uuid(),
  pedido_id        uuid not null references public.pedidos (id) on delete restrict,
  tipo             text not null default 'anticipo' check (tipo in ('anticipo', 'saldo', 'reembolso')),
  monto            numeric(12,2) not null check (monto > 0),
  metodo_pago      text not null default 'efectivo' check (metodo_pago in ('efectivo', 'transferencia', 'tarjeta', 'otro')),
  fecha            date not null default app.hoy(),
  referencia       text check (char_length(referencia) <= 100),
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid()
);
create index pagos_pedido_idx on public.pagos (pedido_id);
create trigger tg_00_inmutable before update or delete on public.pagos
  for each row execute function app.tg_inmutable();

-- ---------------------------------------------------------------------
-- Máquina de estados con permisos por rol
-- ---------------------------------------------------------------------
create or replace function app.transicion_permitida(p_rol text, p_de text, p_a text)
returns boolean language sql immutable set search_path = '' as $$
  select case
    when p_de = p_a then true
    when p_rol is null or p_rol = 'admin' then (p_de || '>' || p_a) = any (array[
      'pendiente>en_produccion', 'pendiente>cancelado',
      'en_produccion>listo', 'en_produccion>cancelado', 'en_produccion>pendiente',
      'listo>enviado', 'listo>entregado', 'listo>cancelado', 'listo>en_produccion',
      'enviado>entregado'])
    when p_rol = 'produccion' then (p_de || '>' || p_a) = any (array[
      'pendiente>en_produccion', 'en_produccion>listo'])
    when p_rol = 'ventas' then (p_de || '>' || p_a) = any (array[
      'pendiente>cancelado', 'en_produccion>cancelado', 'listo>cancelado',
      'listo>enviado', 'listo>entregado', 'enviado>entregado'])
    else false
  end
$$;

create or replace function app.tg_pedidos()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_rol text := app.rol_actual(); v_n int;
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

      if new.estado = 'cancelado' and coalesce(new.cancelado_motivo, '') = '' then
        raise exception 'Indique el motivo de la cancelación';
      end if;

      if new.estado = 'en_produccion' and not old.insumos_descontados then
        select count(*) into v_n from public.pedido_items where pedido_id = new.id;
        if v_n = 0 then raise exception 'El pedido no tiene productos'; end if;
        perform app.descontar_insumos_pedido(new.id);
        new.insumos_descontados := true;
      end if;

      if new.estado in ('enviado', 'entregado') and not old.stock_productos_descontado then
        update public.productos p
           set stock = greatest(p.stock - i.cant, 0)
          from (select producto_id, sum(cantidad)::int as cant
                  from public.pedido_items where pedido_id = new.id group by producto_id) i
         where p.id = i.producto_id and not p.bajo_pedido;
        new.stock_productos_descontado := true;
      end if;

      if new.estado = 'entregado' then new.fecha_entrega_real := coalesce(new.fecha_entrega_real, app.hoy()); end if;
    end if;
  end if;

  new.descuento := least(new.descuento, new.subtotal);
  new.total := new.subtotal - new.descuento + new.costo_envio;
  return new;
end $$;
create trigger tg_10_pedidos before insert or update on public.pedidos
  for each row execute function app.tg_pedidos();

create or replace function app.tg_pedidos_nuevo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform app.notificar(array['admin', 'produccion', 'ventas'], 'pedido_nuevo',
                        'Nuevo pedido #' || new.numero, null, 'pedidos', new.id);
  return null;
end $$;
create trigger tg_20_pedidos_nuevo after insert on public.pedidos
  for each row execute function app.tg_pedidos_nuevo();

-- Ítems: solo editables mientras el pedido está pendiente. Fija snapshot y totales.
create or replace function app.tg_pedido_items_antes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_estado text; v_prod public.productos%rowtype;
begin
  select estado into v_estado from public.pedidos where id = coalesce(new.pedido_id, old.pedido_id) for update;
  if v_estado is distinct from 'pendiente' then
    raise exception 'Solo se pueden editar productos de pedidos pendientes (estado actual: %)', v_estado;
  end if;
  if tg_op = 'DELETE' then return old; end if;

  select * into v_prod from public.productos where id = new.producto_id and eliminado_en is null;
  if not found then raise exception 'Producto no existe o está archivado'; end if;
  if tg_op = 'INSERT' or new.producto_id is distinct from old.producto_id then
    new.nombre_snapshot := v_prod.nombre;
  else
    new.nombre_snapshot := old.nombre_snapshot;
  end if;
  new.precio_unitario := coalesce(new.precio_unitario, v_prod.precio);
  return new;
end $$;
create trigger tg_10_pedido_items_antes before insert or update or delete on public.pedido_items
  for each row execute function app.tg_pedido_items_antes();

create or replace function app.tg_pedido_items_despues()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.pedidos set updated_at = now() where id = coalesce(new.pedido_id, old.pedido_id);  -- recalcula totales
  return null;
end $$;
create trigger tg_20_pedido_items_despues after insert or update or delete on public.pedido_items
  for each row execute function app.tg_pedido_items_despues();

-- Cambio de estado vía RPC (producción no tiene acceso directo a pedidos).
create or replace function public.pedido_cambiar_estado(p_pedido uuid, p_estado text, p_motivo text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app.es_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  update public.pedidos
     set estado = p_estado, cancelado_motivo = coalesce(p_motivo, cancelado_motivo)
   where id = p_pedido and eliminado_en is null;
  if not found then raise exception 'Pedido no encontrado'; end if;
end $$;
