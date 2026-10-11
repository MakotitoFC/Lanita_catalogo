-- =====================================================================
-- Lanita · 0010 · GRANTs explícitos (primera capa; RLS es la segunda)
-- Se revoca TODO y se concede lo mínimo. Sin DELETE salvo tablas de
-- relación. Sin TRUNCATE/REFERENCES/TRIGGER para nadie de la API.
-- =====================================================================

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema app    from public, anon;

-- ---- anon: SOLO columnas públicas de filas publicadas -----------------
grant select (id, nombre, slug, descripcion, imagen_url, orden, activa, eliminado_en)
  on public.categorias to anon;
grant select (id, nombre, slug, descripcion_corta, descripcion, precio, categoria_id, imagen_url,
              es_combo, destacado, publicado, disponible, bajo_pedido, tiempo_elaboracion_dias,
              dimensiones, material, seo_titulo, seo_descripcion, updated_at, eliminado_en)
  on public.productos to anon;
grant select (id, combo_id, producto_id, cantidad) on public.combo_items to anon;
grant select (id, combo_id, imagen_url, tematica, alt_text, es_portada, orden) on public.combos_fotos to anon;
grant select (nombre_negocio, eslogan, descripcion_corta, sobre_nosotros, horarios, logo_url,
              whatsapp_numero, instagram_url, facebook_url, tiktok_url, moneda, moneda_simbolo,
              mensaje_whatsapp_default)
  on public.config to anon;
grant select on public.v_catalogo_categorias, public.v_catalogo_productos, public.v_catalogo_combo_items,
                public.v_catalogo_combo_fotos, public.v_catalogo_config to anon;

-- ---- authenticated (RLS decide por rol) -------------------------------
grant select, insert, update on public.perfiles, public.proveedores, public.categorias_gasto,
  public.categorias, public.productos, public.insumos, public.cajas_envio, public.moldes,
  public.clientes, public.pedidos, public.gastos, public.recetas, public.empaque_default,
  public.combo_items, public.combos_fotos, public.pedido_items to authenticated;
grant select, update on public.config, public.notificaciones to authenticated;
grant select, insert on public.movimientos_insumo, public.pagos to authenticated;
grant select on public.precios_historico, public.auditoria, public.dispositivos_push to authenticated;
grant select, insert, delete on public.molde_producto to authenticated;

-- DELETE: solo relaciones puras y datos propios
grant delete on public.combo_items, public.combos_fotos, public.recetas, public.empaque_default,
  public.pedido_items, public.notificaciones, public.dispositivos_push to authenticated;

-- Vistas internas
grant select on public.v_catalogo_categorias, public.v_catalogo_productos, public.v_catalogo_combo_items,
  public.v_catalogo_combo_fotos, public.v_catalogo_config,
  public.v_insumos_estado, public.v_moldes_estado, public.v_pedidos_saldo, public.v_gastos_mensual,
  public.v_producto_costos, public.v_pedidos_produccion, public.v_pedido_items_produccion to authenticated;

-- RPC (cada una valida el rol internamente)
grant execute on function public.dashboard_resumen()                              to authenticated;
grant execute on function public.pedido_cambiar_estado(uuid, text, text)          to authenticated;
grant execute on function public.registrar_compra_insumo(uuid, numeric, numeric, uuid, date, text, text, text) to authenticated;
grant execute on function public.producto_ajustar_stock(uuid, int, boolean)       to authenticated;
grant execute on function public.registrar_dispositivo_push(text, text)           to authenticated;

-- Helpers de RLS y defaults (esquema app, sin uso para anon)
grant execute on function app.rol_actual(), app.es_admin(), app.tiene_rol(text[]), app.es_staff(),
  app.hoy() to authenticated;
