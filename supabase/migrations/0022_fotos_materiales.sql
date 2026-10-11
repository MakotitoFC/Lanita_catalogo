-- =====================================================================
-- Lanita · 0022 · Varias fotos por producto y lista de materiales
--   · producto_fotos: todas las fotos de un producto (la primera es la portada).
--   · productos.materiales: lista de materiales usados (se muestra en el detalle de la web).
-- =====================================================================

alter table public.productos
  add column materiales text[] not null default '{}'
    check (cardinality(materiales) <= 20 and char_length(array_to_string(materiales, '|')) <= 800);

create table public.producto_fotos (
  id          uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos (id) on delete cascade,
  imagen_url  text not null check (imagen_url ~ '^https://[^\s]+$'),
  imagen_path text check (imagen_path is null or (imagen_path !~ '\.\.' and imagen_path ~ '^[A-Za-z0-9._/-]+$')),
  orden       int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);
create index producto_fotos_idx on public.producto_fotos (producto_id, orden);

-- Seguridad: anon solo lee fotos de productos visibles (RLS de productos); escribir, solo el administrador.
revoke all on public.producto_fotos from anon, authenticated, public;
alter table public.producto_fotos enable row level security;
alter table public.producto_fotos force row level security;
create policy producto_fotos_select_staff on public.producto_fotos for select to authenticated
  using ((select app.es_staff()));
create policy producto_fotos_select_anon on public.producto_fotos for select to anon
  using (exists (select 1 from public.productos p where p.id = producto_id));   -- RLS de anon filtra publicados
create policy producto_fotos_insert on public.producto_fotos for insert to authenticated
  with check ((select app.es_admin()));
create policy producto_fotos_update on public.producto_fotos for update to authenticated
  using ((select app.es_admin())) with check ((select app.es_admin()));
create policy producto_fotos_delete on public.producto_fotos for delete to authenticated
  using ((select app.es_admin()));
grant select, insert, update, delete on public.producto_fotos to authenticated;
grant select (id, producto_id, imagen_url, orden) on public.producto_fotos to anon;

create trigger tg_00_sellos  before insert or update on public.producto_fotos
  for each row execute function app.tg_sellos();
create trigger tg_99_auditar after insert or update or delete on public.producto_fotos
  for each row execute function app.tg_auditar();

-- Lectura pública controlada (columnas permitidas) de materiales y fotos.
grant select (materiales) on public.productos to anon;

create or replace view public.v_catalogo_productos with (security_invoker = true) as
  select id, nombre, slug, descripcion_corta, descripcion, precio, categoria_id, imagen_url, es_combo,
         destacado, disponible, bajo_pedido, tiempo_elaboracion_dias, dimensiones, material,
         seo_titulo, seo_descripcion, updated_at, materiales
    from public.productos;

create view public.v_catalogo_producto_fotos with (security_invoker = true) as
  select id, producto_id, imagen_url, orden from public.producto_fotos;
grant select on public.v_catalogo_producto_fotos to anon;
