-- =====================================================================
-- Lanita · 0020 · Insumos simples
-- Los insumos ya no llevan cuenta de stock. Se manejan como un cuaderno:
--   · COMPRAS: son gastos (public.gastos) enlazados a un insumo, con cantidad y unidad.
--     Así cada compra cuenta una sola vez en los gastos (sin doble registro).
--   · OBSERVACIONES: notas con fecha por insumo (public.insumo_notas), p. ej. el
--     resultado de una prueba. Forman un historial por fecha.
-- Las tablas de stock/recetas siguen existiendo (histórico) pero la app ya no las usa.
-- Solo el administrador puede ver y escribir.
-- =====================================================================

alter table public.gastos
  add column cantidad numeric(14,3) check (cantidad is null or cantidad > 0),
  add column unidad   text          check (unidad is null or char_length(unidad) between 1 and 20);

create table public.insumo_notas (
  id            uuid primary key default gen_random_uuid(),
  insumo_id     uuid not null references public.insumos (id) on delete cascade,
  fecha         date not null default app.hoy(),
  texto         text not null check (char_length(texto) between 3 and 2000),
  eliminado_en  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid
);
create index insumo_notas_idx on public.insumo_notas (insumo_id, fecha desc) where eliminado_en is null;
create index gastos_insumo_idx on public.gastos (insumo_id, fecha desc) where insumo_id is not null and eliminado_en is null;

-- Seguridad: nada para anon; solo el administrador (RLS) con permisos mínimos.
revoke all on public.insumo_notas from anon, authenticated, public;
alter table public.insumo_notas enable row level security;
alter table public.insumo_notas force row level security;
create policy insumo_notas_select on public.insumo_notas for select to authenticated
  using ((select app.es_admin()) and eliminado_en is null);
create policy insumo_notas_insert on public.insumo_notas for insert to authenticated
  with check ((select app.es_admin()));
create policy insumo_notas_update on public.insumo_notas for update to authenticated
  using ((select app.es_admin())) with check ((select app.es_admin()));
grant select, insert, update on public.insumo_notas to authenticated;

create trigger tg_00_sellos   before insert or update on public.insumo_notas
  for each row execute function app.tg_sellos();
create trigger tg_99_auditar  after insert or update or delete on public.insumo_notas
  for each row execute function app.tg_auditar();

-- Categorías de gasto más claras para el negocio (se conservan los slugs).
update public.categorias_gasto set nombre = 'Empaque y envoltorio', descripcion = 'Cartón, papel seda, goma eva, bolsas' where slug = 'empaque';
update public.categorias_gasto set nombre = 'Envío y paquetería',  descripcion = 'Courier, despachos y paquetería'      where slug = 'envio';
insert into public.categorias_gasto (nombre, slug, descripcion) values
  ('Sellos',             'sellos',             'Sellos y marca para empaques'),
  ('Fotos y contenido',  'fotos-y-contenido',  'Producción de fotos, videos y contenido para redes')
on conflict (slug) do nothing;
