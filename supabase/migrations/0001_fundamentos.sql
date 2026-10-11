-- =====================================================================
-- Lanita · 0001 · Fundamentos de seguridad y utilidades
-- Principios:
--   * Denegar por defecto: ningún rol (anon/authenticated) recibe permisos
--     que no se otorguen explícitamente en 0010_grants.sql.
--   * Toda lógica interna vive en el esquema `app` (NO expuesto por la API).
--   * Funciones SECURITY DEFINER siempre con search_path vacío.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create schema if not exists app;
comment on schema app is 'Funciones internas de Lanita. No se expone por PostgREST.';
revoke all on schema app from public, anon;
grant usage on schema app to authenticated;

-- Objetos futuros nacen cerrados (el migrador es el rol postgres).
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema app    revoke execute on functions from public, anon;

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------
create or replace function app.slugify(p text)
returns text language sql immutable set search_path = '' as $$
  select trim(both '-' from regexp_replace(
    translate(lower(coalesce(p, '')), 'áàäâéèëêíìïîóòöôúùüûñç', 'aaaaeeeeiiiioooouuuunc'),
    '[^a-z0-9]+', '-', 'g'))
$$;

-- Sellos de auditoría: created_*/updated_* no pueden falsificarse desde el cliente.
create or replace function app.tg_sellos()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := auth.uid();
  else
    new.id         := old.id;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

-- Registros contables inmutables (movimientos, pagos, historial, auditoría).
create or replace function app.tg_inmutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Registro inmutable: % no admite % (use un asiento compensatorio)', tg_table_name, tg_op
    using errcode = '42501';
end $$;
