-- =====================================================================
-- Lanita · 0005 · Insumos, recetas, empaque, cajas y moldes (Temu)
-- =====================================================================

-- ---------------------------------------------------------------------
-- insumos. stock_actual SOLO cambia vía movimientos_insumo (0007).
-- Pinceles: alerta_activa=false, stock_minimo=0, rotacion='baja'.
-- Sellos: costo_unitario/proveedor_id se completan al cotizar/comprar.
-- ---------------------------------------------------------------------
create table public.insumos (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null check (char_length(nombre) between 2 and 100),
  sku                text unique check (sku is null or char_length(sku) between 2 and 40),
  categoria          text not null default 'materia_prima'
                       check (categoria in ('materia_prima', 'pintura', 'acabado', 'empaque', 'herramienta', 'marca', 'otro')),
  unidad_medida      text not null check (unidad_medida in ('kg', 'g', 'l', 'ml', 'unidad', 'plancha', 'pliego', 'metro')),
  color              text check (char_length(color) <= 40),            -- pinturas por color
  stock_actual       numeric(14,3) not null default 0 check (stock_actual >= 0),
  stock_minimo       numeric(14,3) not null default 0 check (stock_minimo >= 0),
  alerta_activa      boolean not null default true,
  rotacion           text not null default 'media' check (rotacion in ('alta', 'media', 'baja')),
  costo_unitario     numeric(14,4) check (costo_unitario is null or costo_unitario >= 0),  -- promedio ponderado
  proveedor_id       uuid references public.proveedores (id) on delete set null,
  categoria_gasto_id uuid references public.categorias_gasto (id) on delete set null,
  notas              text check (char_length(notas) <= 1000),
  activo             boolean not null default true,
  eliminado_en       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid,
  updated_by         uuid
);
create unique index insumos_nombre_uq on public.insumos (lower(nombre)) where eliminado_en is null;
create index insumos_alerta_idx on public.insumos (stock_actual, stock_minimo) where alerta_activa and eliminado_en is null;

-- El stock no se edita a mano: solo lo toca el trigger de movimientos.
create or replace function app.tg_insumos()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.stock_actual <> 0 then
    raise exception 'El stock inicial se carga con un movimiento de ajuste, no al crear el insumo';
  end if;
  if tg_op = 'UPDATE' and new.stock_actual is distinct from old.stock_actual
     and coalesce(current_setting('app.mov', true), 'off') <> 'on' then
    raise exception 'stock_actual solo cambia mediante movimientos_insumo' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger tg_10_insumos before insert or update on public.insumos
  for each row execute function app.tg_insumos();

-- Receta por unidad de producto (base de costo y descuento automático).
create table public.recetas (
  id           uuid primary key default gen_random_uuid(),
  producto_id  uuid not null references public.productos (id) on delete cascade,
  insumo_id    uuid not null references public.insumos (id) on delete restrict,
  cantidad     numeric(14,4) not null check (cantidad > 0),
  notas        text check (char_length(notas) <= 300),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid,
  updated_by   uuid,
  unique (producto_id, insumo_id)
);

-- Empaque por defecto: papel seda 2 pliegos y goma eva 0,5 plancha por producto.
create table public.empaque_default (
  id          uuid primary key default gen_random_uuid(),
  insumo_id   uuid not null references public.insumos (id) on delete restrict,
  cantidad    numeric(14,4) not null check (cantidad > 0),
  aplica_por  text not null default 'producto' check (aplica_por in ('producto', 'pedido')),
  activo      boolean not null default true,
  notas       text check (char_length(notas) <= 300),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid,
  unique (insumo_id, aplica_por)
);

-- Tamaños de caja configurables (hoy solo "Mediana", medidas por definir).
create table public.cajas_envio (
  id                       uuid primary key default gen_random_uuid(),
  nombre                   text not null unique check (char_length(nombre) between 2 and 60),
  ancho_cm                 numeric(6,1) check (ancho_cm > 0),
  alto_cm                  numeric(6,1) check (alto_cm > 0),
  largo_cm                 numeric(6,1) check (largo_cm > 0),
  insumo_id                uuid references public.insumos (id) on delete set null,  -- cartón dúplex
  carton_por_caja          numeric(6,3) check (carton_por_caja > 0),                -- planchas por caja
  activa                   boolean not null default true,
  notas                    text check (char_length(notas) <= 300),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  created_by               uuid,
  updated_by               uuid
);
alter table public.config
  add constraint config_caja_defecto_fk foreign key (caja_defecto_id) references public.cajas_envio (id) on delete set null;

-- ---------------------------------------------------------------------
-- moldes (encargos a Temu, registro manual: no hay API)
-- ---------------------------------------------------------------------
create table public.moldes (
  id                       uuid primary key default gen_random_uuid(),
  nombre                   text not null check (char_length(nombre) between 2 and 120),
  descripcion              text check (char_length(descripcion) <= 1000),
  proveedor_id             uuid references public.proveedores (id) on delete set null,
  numero_pedido_externo    text check (char_length(numero_pedido_externo) <= 60),
  numero_seguimiento       text check (char_length(numero_seguimiento) <= 80),
  url_pedido               text check (url_pedido is null or url_pedido ~ '^https://[^\s]+$'),
  fecha_pedido             date not null default app.hoy(),
  fecha_envio              date,
  fecha_estimada_llegada   date,
  fecha_recepcion_real     date,
  estado                   text not null default 'pedido' check (estado in ('pedido', 'en_transito', 'recibido', 'cancelado')),
  costo                    numeric(12,2) check (costo is null or costo >= 0),
  cantidad                 int not null default 1 check (cantidad >= 1),
  notas                    text check (char_length(notas) <= 1000),
  eliminado_en             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  created_by               uuid,
  updated_by               uuid,
  check (fecha_estimada_llegada is null or fecha_estimada_llegada >= fecha_pedido),
  check (estado <> 'recibido' or fecha_recepcion_real is not null)
);
create index moldes_estado_idx on public.moldes (estado, fecha_estimada_llegada) where eliminado_en is null;

create table public.molde_producto (
  molde_id     uuid not null references public.moldes (id) on delete cascade,
  producto_id  uuid not null references public.productos (id) on delete cascade,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  primary key (molde_id, producto_id)
);
create index molde_producto_prod_idx on public.molde_producto (producto_id);

create or replace function app.tg_moldes()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    if not ((old.estado || '>' || new.estado) = any (array[
         'pedido>en_transito', 'pedido>recibido', 'pedido>cancelado',
         'en_transito>recibido', 'en_transito>cancelado'])) then
      raise exception 'Transición de molde no permitida: % -> %', old.estado, new.estado;
    end if;
    if new.estado = 'en_transito' then new.fecha_envio := coalesce(new.fecha_envio, app.hoy()); end if;
    if new.estado = 'recibido' then
      new.fecha_recepcion_real := coalesce(new.fecha_recepcion_real, app.hoy());
      perform app.notificar(array['admin', 'produccion'], 'molde_recibido',
                            'Molde recibido', new.nombre, 'moldes', new.id);
    end if;
  end if;
  return new;
end $$;
create trigger tg_10_moldes before insert or update on public.moldes
  for each row execute function app.tg_moldes();
