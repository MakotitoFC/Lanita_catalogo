-- =====================================================================
-- Lanita · 0004 · Proveedores, categorías de gasto y catálogo
-- Regla: NO se borran filas de negocio; se archivan (eliminado_en).
-- =====================================================================

create table public.proveedores (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null check (char_length(nombre) between 2 and 100),
  contacto      text check (char_length(contacto) <= 120),
  telefono      text check (telefono is null or telefono ~ '^\+?[0-9 ()-]{6,20}$'),
  email         text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  sitio_web     text check (sitio_web is null or sitio_web ~ '^https://[^\s]+$'),
  notas         text check (char_length(notas) <= 1000),
  activo        boolean not null default true,
  eliminado_en  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid
);
create unique index proveedores_nombre_uq on public.proveedores (lower(nombre)) where eliminado_en is null;

create table public.categorias_gasto (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null check (char_length(nombre) between 2 and 60),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  descripcion  text check (char_length(descripcion) <= 300),
  activa       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid,
  updated_by   uuid
);

-- ---------------------------------------------------------------------
create table public.categorias (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null check (char_length(nombre) between 2 and 60),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  descripcion   text check (char_length(descripcion) <= 500),
  imagen_url    text check (imagen_url is null or imagen_url ~ '^https://[^\s]+$'),
  orden         int  not null default 0,
  activa        boolean not null default true,
  eliminado_en  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid
);
create index categorias_orden_idx on public.categorias (orden) where activa and eliminado_en is null;

-- ---------------------------------------------------------------------
-- productos (también combos: es_combo = true)
--   publicado  = visible en la web (por defecto false: nace como borrador)
--   disponible = se puede pedir ahora (false => "agotado" en la web)
--   bajo_pedido= se elabora al recibir pedido (no descuenta stock terminado)
--   stock      = unidades terminadas; NUNCA se expone a anon
-- ---------------------------------------------------------------------
create table public.productos (
  id                       uuid primary key default gen_random_uuid(),
  nombre                   text not null check (char_length(nombre) between 2 and 120),
  slug                     text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sku                      text unique check (sku is null or char_length(sku) between 2 and 40),
  descripcion_corta        text check (char_length(descripcion_corta) <= 200),
  descripcion              text check (char_length(descripcion) <= 4000),
  precio                   numeric(12,2) not null default 0 check (precio >= 0),
  categoria_id             uuid not null references public.categorias (id) on delete restrict,
  imagen_url               text check (imagen_url is null or imagen_url ~ '^https://[^\s]+$'),
  imagen_path              text check (imagen_path is null or (imagen_path !~ '\.\.' and imagen_path ~ '^[A-Za-z0-9._/-]+$')),
  es_combo                 boolean not null default false,
  destacado                boolean not null default false,
  publicado                boolean not null default false,
  disponible               boolean not null default true,
  bajo_pedido              boolean not null default true,
  stock                    int not null default 0 check (stock >= 0),
  tiempo_elaboracion_dias  int check (tiempo_elaboracion_dias is null or tiempo_elaboracion_dias between 0 and 90),
  dimensiones              text check (char_length(dimensiones) <= 100),
  material                 text not null default 'Cemento gris y arena fina' check (char_length(material) <= 120),
  seo_titulo               text check (char_length(seo_titulo) <= 70),
  seo_descripcion          text check (char_length(seo_descripcion) <= 170),
  motivo_cambio_precio     text check (char_length(motivo_cambio_precio) <= 200),  -- transitorio: lo consume el trigger
  busqueda                 tsvector generated always as (
                             to_tsvector('spanish', coalesce(nombre, '') || ' ' || coalesce(descripcion_corta, ''))) stored,
  eliminado_en             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  created_by               uuid,
  updated_by               uuid
);
create index productos_categoria_idx on public.productos (categoria_id);
create index productos_publico_idx   on public.productos (publicado, disponible) where eliminado_en is null;
create index productos_destacado_idx on public.productos (destacado) where publicado and eliminado_en is null;
create index productos_busqueda_idx  on public.productos using gin (busqueda);

create table public.combo_items (
  id           uuid primary key default gen_random_uuid(),
  combo_id     uuid not null references public.productos (id) on delete cascade,
  producto_id  uuid not null references public.productos (id) on delete restrict,
  cantidad     int not null default 1 check (cantidad between 1 and 999),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid,
  updated_by   uuid,
  unique (combo_id, producto_id),
  check (combo_id <> producto_id)
);
create index combo_items_producto_idx on public.combo_items (producto_id);

-- Fotos propias del combo (la web las prioriza sobre las individuales).
create table public.combos_fotos (
  id          uuid primary key default gen_random_uuid(),
  combo_id    uuid not null references public.productos (id) on delete cascade,
  imagen_url  text not null check (imagen_url ~ '^https://[^\s]+$'),
  imagen_path text check (imagen_path is null or (imagen_path !~ '\.\.' and imagen_path ~ '^[A-Za-z0-9._/-]+$')),
  tematica    text check (char_length(tematica) <= 60),   -- ej. "baby shower", "boda"
  alt_text    text check (char_length(alt_text) <= 200),
  es_portada  boolean not null default false,
  orden       int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);
create index combos_fotos_combo_idx on public.combos_fotos (combo_id, orden);
create unique index combos_fotos_portada_uq on public.combos_fotos (combo_id) where es_portada;

create table public.precios_historico (
  id               uuid primary key default gen_random_uuid(),
  producto_id      uuid not null references public.productos (id) on delete restrict,
  precio_anterior  numeric(12,2) not null,
  precio_nuevo     numeric(12,2) not null,
  motivo           text,
  cambiado_por     uuid default auth.uid(),
  fecha            timestamptz not null default now()
);
create index precios_historico_prod_idx on public.precios_historico (producto_id, fecha desc);
create trigger tg_00_inmutable before update or delete on public.precios_historico
  for each row execute function app.tg_inmutable();

-- ---------------------------------------------------------------------
-- Reglas de negocio de productos
-- ---------------------------------------------------------------------
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
create trigger tg_10_productos before insert or update on public.productos
  for each row execute function app.tg_productos();

create or replace function app.tg_combo_items()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.productos where id = new.combo_id and es_combo) then
    raise exception 'combo_id debe apuntar a un producto marcado como combo';
  end if;
  if exists (select 1 from public.productos where id = new.producto_id and es_combo) then
    raise exception 'Un combo no puede contener otro combo';
  end if;
  return new;
end $$;
create trigger tg_10_combo_items before insert or update on public.combo_items
  for each row execute function app.tg_combo_items();

create or replace function app.tg_combos_fotos()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.productos where id = new.combo_id and es_combo) then
    raise exception 'Las fotos temáticas solo aplican a combos';
  end if;
  return new;
end $$;
create trigger tg_10_combos_fotos before insert or update on public.combos_fotos
  for each row execute function app.tg_combos_fotos();

-- Ajuste de stock terminado para producción (sin darle UPDATE sobre productos).
create or replace function public.producto_ajustar_stock(p_producto uuid, p_stock int, p_disponible boolean default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app.tiene_rol(array['admin', 'produccion']) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_stock < 0 then raise exception 'El stock no puede ser negativo'; end if;
  update public.productos
     set stock = p_stock, disponible = coalesce(p_disponible, disponible)
   where id = p_producto and eliminado_en is null;
  if not found then raise exception 'Producto no encontrado'; end if;
end $$;
