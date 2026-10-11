-- =====================================================================
-- Lanita · 0003 · Autorización, auditoría y notificaciones
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funciones de autorización (usadas por RLS)
-- ---------------------------------------------------------------------
create or replace function app.rol_actual()
returns text language sql stable security definer set search_path = '' as $$
  select p.rol from public.perfiles p
  where p.id = auth.uid() and p.activo and p.eliminado_en is null
$$;

-- Admin válido. Si config.exigir_mfa_admin está activo, exige sesión aal2 (TOTP).
create or replace function app.es_admin()
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_mfa boolean;
begin
  if app.rol_actual() is distinct from 'admin' then return false; end if;
  select c.exigir_mfa_admin into v_mfa from public.config c limit 1;
  if coalesce(v_mfa, false) and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    return false;
  end if;
  return true;
end $$;

create or replace function app.tiene_rol(p_roles text[])
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_rol text := app.rol_actual();
begin
  if v_rol is null then return false; end if;
  if v_rol = 'admin' then return app.es_admin(); end if;
  return v_rol = any (p_roles);
end $$;

create or replace function app.es_staff()
returns boolean language sql stable set search_path = '' as $$
  select app.tiene_rol(array['admin', 'produccion', 'ventas'])
$$;

-- ---------------------------------------------------------------------
-- perfiles: protección contra escalada de privilegios
-- ---------------------------------------------------------------------
create or replace function app.tg_proteger_perfil()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    -- Un no-admin solo puede cambiar nombre/teléfono propios.
    if auth.uid() is not null and not app.es_admin() then
      if new.rol is distinct from old.rol
         or new.activo is distinct from old.activo
         or new.eliminado_en is distinct from old.eliminado_en
         or new.id is distinct from old.id then
        raise exception 'No autorizado a cambiar rol o estado del perfil' using errcode = '42501';
      end if;
    end if;
    -- Nunca dejar el sistema sin administrador activo.
    if old.rol = 'admin' and old.activo and old.eliminado_en is null
       and (new.rol <> 'admin' or not new.activo or new.eliminado_en is not null) then
      if not exists (select 1 from public.perfiles
                     where rol = 'admin' and activo and eliminado_en is null and id <> old.id) then
        raise exception 'No se puede quitar o desactivar al último administrador';
      end if;
    end if;
  end if;
  return new;
end $$;

create trigger tg_10_proteger_perfil before insert or update on public.perfiles
  for each row execute function app.tg_proteger_perfil();

-- ---------------------------------------------------------------------
-- auditoria: bitácora append-only. Solo la escribe el trigger (definer).
-- ---------------------------------------------------------------------
create table public.auditoria (
  id               bigint generated always as identity primary key,
  fecha            timestamptz not null default now(),
  tabla            text not null,
  operacion        text not null check (operacion in ('INSERT', 'UPDATE', 'DELETE')),
  registro_id      text,
  usuario_id       uuid,
  rol              text,
  ip               text,
  campos_cambiados text[],
  datos_antes      jsonb,
  datos_despues    jsonb
);
create index auditoria_tabla_fecha_idx on public.auditoria (tabla, fecha desc);
create index auditoria_usuario_idx     on public.auditoria (usuario_id, fecha desc);
comment on table public.auditoria is 'Bitácora inmutable de cambios. Solo lectura para admin.';

create trigger tg_00_inmutable before update or delete on public.auditoria
  for each row execute function app.tg_inmutable();
create trigger tg_01_inmutable_truncate before truncate on public.auditoria
  for each statement execute function app.tg_inmutable();

create or replace function app.tg_auditar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb; v_new jsonb; v_campos text[]; v_ip text;
  v_ruido text[] := array['updated_at', 'updated_by'];
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := to_jsonb(new); end if;

  if tg_op = 'UPDATE' then
    select array_agg(k) into v_campos
    from jsonb_object_keys(v_new) k
    where k <> all (v_ruido) and (v_old -> k) is distinct from (v_new -> k);
    if v_campos is null then return null; end if;   -- sin cambios reales
  end if;

  begin
    v_ip := split_part(coalesce((nullif(current_setting('request.headers', true), '')::jsonb) ->> 'x-forwarded-for', ''), ',', 1);
  exception when others then v_ip := null;
  end;

  insert into public.auditoria (tabla, operacion, registro_id, usuario_id, rol, ip, campos_cambiados, datos_antes, datos_despues)
  values (tg_table_name, tg_op,
          coalesce(v_new ->> 'id', v_old ->> 'id', coalesce(v_new, v_old) ->> 'molde_id'),
          auth.uid(), app.rol_actual(), nullif(v_ip, ''), v_campos, v_old, v_new);
  return null;
end $$;

-- ---------------------------------------------------------------------
-- notificaciones (cola) y dispositivos push
-- Texto SIN datos personales de clientes: la notificación viaja por
-- servidores de terceros (Expo/FCM).
-- ---------------------------------------------------------------------
create table public.notificaciones (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references public.perfiles (id) on delete cascade,
  tipo           text not null check (tipo in ('stock_bajo', 'stock_insuficiente', 'molde_recibido', 'molde_demorado', 'pedido_nuevo', 'sistema')),
  titulo         text not null check (char_length(titulo) <= 120),
  cuerpo         text check (char_length(cuerpo) <= 300),
  ref_tabla      text,
  ref_id         uuid,
  leida          boolean not null default false,
  leida_en       timestamptz,
  push_enviado   boolean not null default false,
  push_enviado_en timestamptz,
  created_at     timestamptz not null default now()
);
create index notificaciones_usuario_idx on public.notificaciones (usuario_id, leida, created_at desc);
create index notificaciones_push_pend_idx on public.notificaciones (created_at) where not push_enviado;

-- Un usuario solo puede marcar como leída; nada más.
create or replace function app.tg_notificacion_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and
     (to_jsonb(new) - 'leida' - 'leida_en') is distinct from (to_jsonb(old) - 'leida' - 'leida_en') then
    raise exception 'Solo se puede marcar la notificación como leída' using errcode = '42501';
  end if;
  if new.leida and not old.leida then new.leida_en := now(); end if;
  return new;
end $$;
create trigger tg_10_notificacion_update before update on public.notificaciones
  for each row execute function app.tg_notificacion_update();

create or replace function app.notificar(
  p_roles text[], p_tipo text, p_titulo text, p_cuerpo text default null,
  p_ref_tabla text default null, p_ref_id uuid default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo, ref_tabla, ref_id)
  select p.id, p_tipo, p_titulo, p_cuerpo, p_ref_tabla, p_ref_id
  from public.perfiles p
  where p.activo and p.eliminado_en is null and p.rol = any (p_roles)
$$;

create table public.dispositivos_push (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  expo_token  text not null unique check (expo_token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$'),
  plataforma  text not null check (plataforma in ('android', 'ios')),
  activo      boolean not null default true,
  ultimo_uso  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index dispositivos_usuario_idx on public.dispositivos_push (usuario_id) where activo;
comment on table public.dispositivos_push is 'Tokens push. Cada usuario ve solo los suyos; ni el admin los lee.';

-- Registro/transferencia de token (si el dispositivo cambia de usuario).
create or replace function public.registrar_dispositivo_push(p_token text, p_plataforma text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app.es_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  insert into public.dispositivos_push (usuario_id, expo_token, plataforma)
  values (auth.uid(), p_token, p_plataforma)
  on conflict (expo_token) do update
    set usuario_id = auth.uid(), plataforma = excluded.plataforma, activo = true, ultimo_uso = now();
end $$;
