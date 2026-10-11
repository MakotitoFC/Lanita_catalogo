-- =====================================================================
-- Lanita · 0002 · Perfiles (roles) y configuración del negocio
-- =====================================================================

-- ---------------------------------------------------------------------
-- perfiles: 1-1 con auth.users. Sin perfil activo => sin acceso a NADA.
-- El registro público está deshabilitado (config.toml): los usuarios los
-- crea el admin. Roles: admin | produccion | ventas.
-- ---------------------------------------------------------------------
create table public.perfiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  nombre        text not null check (char_length(nombre) between 2 and 80),
  rol           text not null check (rol in ('admin', 'produccion', 'ventas')),
  telefono      text check (telefono is null or telefono ~ '^\+?[0-9]{7,15}$'),
  activo        boolean not null default true,
  eliminado_en  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid
);
comment on table public.perfiles is 'Perfil y rol de cada usuario interno. Un usuario sin fila activa no puede leer ni escribir nada.';

-- ---------------------------------------------------------------------
-- config: fila única. Parte pública (columnas con GRANT a anon) y parte
-- interna (umbrales y flags de seguridad que jamás se exponen).
-- ---------------------------------------------------------------------
create table public.config (
  id                          boolean primary key default true check (id),

  -- Parte pública (leída por la web)
  nombre_negocio              text not null default 'Lanita' check (char_length(nombre_negocio) between 1 and 80),
  eslogan                     text check (char_length(eslogan) <= 160),
  descripcion_corta           text check (char_length(descripcion_corta) <= 300),
  sobre_nosotros              text check (char_length(sobre_nosotros) <= 8000),
  horarios                    text check (char_length(horarios) <= 500),
  logo_url                    text check (logo_url is null or logo_url ~ '^https://[^\s]+$'),
  whatsapp_numero             text not null default '' check (whatsapp_numero = '' or whatsapp_numero ~ '^[0-9]{8,15}$'),
  instagram_url               text check (instagram_url is null or instagram_url ~ '^https://[^\s]+$'),
  facebook_url                text check (facebook_url  is null or facebook_url  ~ '^https://[^\s]+$'),
  tiktok_url                  text check (tiktok_url    is null or tiktok_url    ~ '^https://[^\s]+$'),
  moneda                      text not null default 'PEN' check (moneda ~ '^[A-Z]{3}$'),
  moneda_simbolo              text not null default 'S/' check (char_length(moneda_simbolo) between 1 and 4),
  mensaje_whatsapp_default    text not null default 'Hola Lanita, me gustaría consultar por este producto:' check (char_length(mensaje_whatsapp_default) <= 500),

  -- Parte interna (NUNCA expuesta a anon)
  zona_horaria                text not null default 'America/Lima',
  plantilla_resumen_pedido    text check (char_length(plantilla_resumen_pedido) <= 1000),
  dias_alerta_molde           int  not null default 30 check (dias_alerta_molde between 1 and 365),
  dias_alerta_entrega         int  not null default 2  check (dias_alerta_entrega between 0 and 60),
  bloquear_sin_stock          boolean not null default false,  -- true: no se inicia producción sin insumos suficientes
  exigir_mfa_admin            boolean not null default false,  -- true: acciones de admin exigen sesión aal2 (TOTP)
  caja_defecto_id             uuid,                            -- FK se agrega en 0005 (cajas_envio)

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  created_by                  uuid,
  updated_by                  uuid
);
comment on table public.config is 'Fila única. Solo las columnas públicas tienen GRANT a anon; las internas son privadas.';

insert into public.config (id) values (true);

-- Zona horaria del negocio para "hoy" (evita fechas corridas por UTC).
create or replace function app.hoy()
returns date language sql stable security definer set search_path = '' as $$
  select (now() at time zone coalesce((select zona_horaria from public.config limit 1), 'UTC'))::date
$$;
