-- =====================================================================
-- Lanita · 0008 · Triggers comunes, vistas y RPC
-- =====================================================================

-- Sellos created_*/updated_* en todas las tablas "editables".
do $$
declare t text;
begin
  foreach t in array array[
    'perfiles', 'config', 'proveedores', 'categorias_gasto', 'categorias', 'productos', 'combo_items',
    'combos_fotos', 'insumos', 'recetas', 'empaque_default', 'cajas_envio', 'moldes', 'clientes',
    'pedidos', 'pedido_items', 'gastos']
  loop
    execute format('create trigger tg_00_sellos before insert or update on public.%I
                    for each row execute function app.tg_sellos()', t);
  end loop;

  -- Auditoría automática de todo lo sensible.
  foreach t in array array[
    'perfiles', 'config', 'proveedores', 'categorias_gasto', 'categorias', 'productos', 'combo_items',
    'combos_fotos', 'precios_historico', 'insumos', 'recetas', 'empaque_default', 'cajas_envio', 'moldes',
    'molde_producto', 'clientes', 'pedidos', 'pedido_items', 'pagos', 'gastos', 'movimientos_insumo']
  loop
    execute format('create trigger tg_99_auditar after insert or update or delete on public.%I
                    for each row execute function app.tg_auditar()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- VISTAS PÚBLICAS (anon). security_invoker => se aplica RLS + GRANT por
-- columna de anon: jamás exponen stock, costos, SKU ni datos internos.
-- ---------------------------------------------------------------------
create view public.v_catalogo_categorias with (security_invoker = true) as
  select id, nombre, slug, descripcion, imagen_url, orden from public.categorias;

create view public.v_catalogo_productos with (security_invoker = true) as
  select id, nombre, slug, descripcion_corta, descripcion, precio, categoria_id, imagen_url, es_combo,
         destacado, disponible, bajo_pedido, tiempo_elaboracion_dias, dimensiones, material,
         seo_titulo, seo_descripcion, updated_at
    from public.productos;

create view public.v_catalogo_combo_items with (security_invoker = true) as
  select ci.combo_id, ci.producto_id, ci.cantidad, p.nombre as producto_nombre, p.slug as producto_slug
    from public.combo_items ci join public.productos p on p.id = ci.producto_id;

create view public.v_catalogo_combo_fotos with (security_invoker = true) as
  select id, combo_id, imagen_url, tematica, alt_text, es_portada, orden from public.combos_fotos;

create view public.v_catalogo_config with (security_invoker = true) as
  select nombre_negocio, eslogan, descripcion_corta, sobre_nosotros, horarios, logo_url, whatsapp_numero,
         instagram_url, facebook_url, tiktok_url, moneda, moneda_simbolo, mensaje_whatsapp_default
    from public.config;

-- ---------------------------------------------------------------------
-- VISTAS INTERNAS (security_invoker: heredan RLS por rol)
-- ---------------------------------------------------------------------
create view public.v_insumos_estado with (security_invoker = true) as
select i.id, i.nombre, i.categoria, i.unidad_medida, i.color, i.stock_actual, i.stock_minimo,
       i.alerta_activa, i.rotacion, i.costo_unitario, i.proveedor_id, i.notas,
       case
         when not i.alerta_activa or i.stock_minimo = 0 then 'sin_alerta'
         when i.stock_actual <= i.stock_minimo            then 'rojo'
         when i.stock_actual <= i.stock_minimo * 1.5      then 'amarillo'
         else 'verde'
       end as semaforo
  from public.insumos i
 where i.eliminado_en is null and i.activo;

create view public.v_moldes_estado with (security_invoker = true) as
select m.id, m.nombre, m.estado, m.proveedor_id, m.fecha_pedido, m.fecha_envio,
       m.fecha_estimada_llegada, m.fecha_recepcion_real, m.costo, m.cantidad, m.numero_seguimiento, m.notas,
       (app.hoy() - coalesce(m.fecha_envio, m.fecha_pedido)) as dias_desde_envio,
       (m.estado in ('pedido', 'en_transito') and (
          app.hoy() - coalesce(m.fecha_envio, m.fecha_pedido) > (select dias_alerta_molde from public.config)
          or m.fecha_estimada_llegada < app.hoy())) as demorado,
       (select count(*) from public.molde_producto mp where mp.molde_id = m.id) as productos_vinculados
  from public.moldes m
 where m.eliminado_en is null;

create view public.v_pedidos_saldo with (security_invoker = true) as
select p.id, p.numero, p.estado, p.total,
       coalesce(sum(case g.tipo when 'reembolso' then -g.monto else g.monto end), 0) as pagado,
       p.total - coalesce(sum(case g.tipo when 'reembolso' then -g.monto else g.monto end), 0) as saldo
  from public.pedidos p left join public.pagos g on g.pedido_id = p.id
 where p.eliminado_en is null
 group by p.id;

create view public.v_gastos_mensual with (security_invoker = true) as
select date_trunc('month', g.fecha)::date as mes, c.id as categoria_gasto_id, c.nombre as categoria,
       sum(g.monto) as total, count(*) as cantidad
  from public.gastos g join public.categorias_gasto c on c.id = g.categoria_gasto_id
 where g.eliminado_en is null
 group by 1, 2, 3;

create view public.v_producto_costos with (security_invoker = true) as
select p.id as producto_id, p.nombre, p.precio,
       coalesce(sum(r.cantidad * i.costo_unitario), 0) as costo_insumos,
       p.precio - coalesce(sum(r.cantidad * i.costo_unitario), 0) as margen,
       case when p.precio > 0
            then round((p.precio - coalesce(sum(r.cantidad * i.costo_unitario), 0)) / p.precio * 100, 1) end as margen_pct,
       bool_or(i.costo_unitario is null) filter (where r.id is not null) as costo_incompleto
  from public.productos p
  left join public.recetas r on r.producto_id = p.id
  left join public.insumos i on i.id = r.insumo_id
 where p.eliminado_en is null
 group by p.id;

-- Producción ve pedidos SIN datos personales (solo primer nombre como alias).
create view public.v_pedidos_produccion with (security_barrier = true) as
select p.id, p.numero, p.estado, p.fecha_pedido, p.fecha_entrega, p.tematica, p.personalizacion,
       p.notas_produccion, p.requiere_envio, p.caja_envio_id,
       split_part(p.cliente_nombre, ' ', 1) as cliente_alias
  from public.pedidos p
 where p.eliminado_en is null and app.tiene_rol(array['admin', 'produccion']);

create view public.v_pedido_items_produccion with (security_barrier = true) as
select i.id, i.pedido_id, i.producto_id, i.nombre_snapshot, i.cantidad, i.notas
  from public.pedido_items i join public.pedidos p on p.id = i.pedido_id
 where p.eliminado_en is null and app.tiene_rol(array['admin', 'produccion']);

-- ---------------------------------------------------------------------
-- Dashboard: un solo RPC, cada rol recibe solo lo que le corresponde.
-- ---------------------------------------------------------------------
create or replace function public.dashboard_resumen()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_rol text; v_hoy date := app.hoy();
  v_sem date := date_trunc('week',  app.hoy())::date;
  v_mes date := date_trunc('month', app.hoy())::date;
  r jsonb := '{}'::jsonb;
begin
  if not app.es_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  v_rol := app.rol_actual();

  if v_rol in ('admin', 'ventas') then
    r := r || jsonb_build_object('ventas', (
      select jsonb_build_object(
        'hoy',    coalesce(sum(total) filter (where fecha_pedido = v_hoy), 0),
        'semana', coalesce(sum(total) filter (where fecha_pedido >= v_sem), 0),
        'mes',    coalesce(sum(total), 0))
      from public.pedidos
      where estado <> 'cancelado' and eliminado_en is null and fecha_pedido >= least(v_mes, v_sem)));
    r := r || jsonb_build_object('saldo_por_cobrar', (
      select coalesce(sum(saldo), 0) from public.v_pedidos_saldo
       where estado not in ('cancelado') and saldo > 0));
  end if;

  if v_rol = 'admin' then
    r := r || jsonb_build_object('gastos_mes', (
      select coalesce(sum(monto), 0) from public.gastos where eliminado_en is null and fecha >= v_mes));
  end if;

  if v_rol in ('admin', 'produccion') then
    r := r || jsonb_build_object(
      'insumos_bajos', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', id, 'nombre', nombre, 'stock_actual', stock_actual, 'stock_minimo', stock_minimo,
          'unidad', unidad_medida) order by nombre), '[]'::jsonb)
        from public.insumos
       where eliminado_en is null and activo and alerta_activa and stock_minimo > 0 and stock_actual <= stock_minimo),
      'moldes_en_transito', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', id, 'nombre', nombre, 'estado', estado, 'fecha_estimada_llegada', fecha_estimada_llegada,
          'demorado', demorado) order by fecha_estimada_llegada nulls last), '[]'::jsonb)
        from public.v_moldes_estado where estado in ('pedido', 'en_transito')));
  end if;

  r := r || jsonb_build_object(
    'pedidos_pendientes', (select count(*) from public.pedidos
                            where eliminado_en is null and estado in ('pendiente', 'en_produccion')),
    'proximas_entregas', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', id, 'numero', numero, 'estado', estado, 'fecha_entrega', fecha_entrega)
          order by fecha_entrega), '[]'::jsonb)
        from (select id, numero, estado, fecha_entrega from public.pedidos
               where eliminado_en is null and estado in ('pendiente', 'en_produccion', 'listo')
                 and fecha_entrega is not null order by fecha_entrega limit 5) q));
  return r;
end $$;
