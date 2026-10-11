-- =====================================================================
-- Lanita · 0018 · Personalización de la web desde el APK (low-code)
--   tema_colores              : los 5 colores del sitio (se validan como #RRGGBB; no admite nada más)
--   web_mostrar_promociones   : interruptor de la sección de promociones
--   web_mostrar_burbuja       : interruptor de la burbuja de consulta
-- Son datos PÚBLICOS (la web los necesita para pintarse). Solo el admin puede cambiarlos.
-- =====================================================================

alter table public.config
  add column if not exists tema_colores jsonb,
  add column if not exists web_mostrar_promociones boolean not null default true,
  add column if not exists web_mostrar_burbuja boolean not null default true;

alter table public.config drop constraint if exists config_tema_colores_check;
alter table public.config add constraint config_tema_colores_check check (
  tema_colores is null or (
    jsonb_typeof(tema_colores) = 'object'
    and tema_colores ?& array['principal', 'acento', 'base', 'claro', 'secundario']
    and (tema_colores - array['principal', 'acento', 'base', 'claro', 'secundario']) = '{}'::jsonb
    and (tema_colores ->> 'principal')  ~ '^#[0-9a-fA-F]{6}$'
    and (tema_colores ->> 'acento')     ~ '^#[0-9a-fA-F]{6}$'
    and (tema_colores ->> 'base')       ~ '^#[0-9a-fA-F]{6}$'
    and (tema_colores ->> 'claro')      ~ '^#[0-9a-fA-F]{6}$'
    and (tema_colores ->> 'secundario') ~ '^#[0-9a-fA-F]{6}$'
  )
);

-- Lectura pública de estas columnas (el resto de config sigue privado)
grant select (tema_colores, web_mostrar_promociones, web_mostrar_burbuja) on public.config to anon;

create or replace view public.v_catalogo_config with (security_invoker = true) as
  select nombre_negocio, eslogan, descripcion_corta, sobre_nosotros, horarios, logo_url, whatsapp_numero,
         instagram_url, facebook_url, tiktok_url, moneda, moneda_simbolo, mensaje_whatsapp_default,
         tema_colores, web_mostrar_promociones, web_mostrar_burbuja
    from public.config;
