-- =====================================================================
-- Lanita · 0017 · Promociones con fechas de vigencia
-- El administrador las publica desde el APK. En la web pública solo se ven las que están ACTIVAS y
-- dentro de su rango de fechas (fecha de hoy según la zona horaria del negocio). Si no hay ninguna,
-- la web muestra "Por ahora no hay promociones".
-- =====================================================================

create table public.promociones (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null check (char_length(titulo) between 2 and 80),
  descripcion   text check (char_length(descripcion) <= 500),
  imagen_url    text check (imagen_url is null or imagen_url ~ '^https://[^\s]+$'),
  producto_id   uuid references public.productos (id) on delete set null,   -- opcional: enlaza a un producto o combo
  fecha_inicio  date not null,
  fecha_fin     date not null,
  activa        boolean not null default true,
  orden         int not null default 0,
  eliminado_en  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid,
  check (fecha_fin >= fecha_inicio)
);
create index promociones_vigencia_idx on public.promociones (fecha_inicio, fecha_fin) where activa and eliminado_en is null;

create trigger tg_00_sellos  before insert or update on public.promociones for each row execute function app.tg_sellos();
create trigger tg_99_auditar after insert or update or delete on public.promociones for each row execute function app.tg_auditar();

-- "Hoy" según la zona horaria del negocio, accesible para las políticas públicas (solo devuelve una fecha).
create or replace function public.hoy_negocio()
returns date language sql stable security definer set search_path = '' as $$ select app.hoy() $$;
revoke all on function public.hoy_negocio() from public, anon, authenticated;
grant execute on function public.hoy_negocio() to anon, authenticated;

alter table public.promociones enable row level security;
create policy promociones_select_admin on public.promociones for select to authenticated using ((select app.es_admin()));
create policy promociones_select_anon  on public.promociones for select to anon
  using (activa and eliminado_en is null and (select public.hoy_negocio()) between fecha_inicio and fecha_fin);
create policy promociones_insert on public.promociones for insert to authenticated with check ((select app.es_admin()));
create policy promociones_update on public.promociones for update to authenticated
  using ((select app.es_admin())) with check ((select app.es_admin()));

revoke all on public.promociones from anon, authenticated;
grant select, insert, update on public.promociones to authenticated;     -- sin DELETE: se archiva
grant select (id, titulo, descripcion, imagen_url, producto_id, fecha_inicio, fecha_fin, activa, orden, eliminado_en)
  on public.promociones to anon;

create view public.v_catalogo_promociones with (security_invoker = true) as
select pr.id, pr.titulo, pr.descripcion, pr.imagen_url, pr.fecha_inicio, pr.fecha_fin, pr.orden,
       p.slug as producto_slug, p.es_combo as producto_es_combo
  from public.promociones pr
  left join public.productos p on p.id = pr.producto_id;
grant select on public.v_catalogo_promociones to anon, authenticated;
