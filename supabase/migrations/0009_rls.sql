-- =====================================================================
-- Lanita · 0009 · Row Level Security
-- Matriz de permisos (S=select I=insert U=update):
--   tabla               admin     produccion   ventas     anon
--   perfiles            SIU       S(propio)    S(propio)  -
--   config              SU        S            S          S(cols públicas)
--   categorias/prod.    SIU       S            S          S(publicados)
--   combo_items/fotos   SIUD      S            S          S(de combos publicados)
--   precios_historico   S         -            -          -
--   proveedores         SIU       SIU          -          -
--   insumos/moldes      SIU       SIU          -          -
--   movimientos_insumo  SI        SI           -          -
--   recetas             SIUD      S            -          -
--   empaque/cajas       SIU       S            S          -
--   gastos/cat_gasto    SIU       -            -          -
--   clientes            SIU       -            SIU        -
--   pedidos/items       SIU       vistas       SIU        -
--   pagos               SI        -            SI         -
--   auditoria           S         -            -          -
-- Nada se borra desde la app salvo tablas de relación (ver 0010).
-- Todas las llamadas a app.* van en (select ...) para cachearse por consulta.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'perfiles', 'config', 'proveedores', 'categorias_gasto', 'categorias', 'productos', 'combo_items',
    'combos_fotos', 'precios_historico', 'insumos', 'movimientos_insumo', 'recetas', 'empaque_default',
    'cajas_envio', 'moldes', 'molde_producto', 'clientes', 'pedidos', 'pedido_items', 'pagos', 'gastos',
    'notificaciones', 'dispositivos_push', 'auditoria']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---- perfiles --------------------------------------------------------
create policy perfiles_select on public.perfiles for select to authenticated
  using (id = (select auth.uid()) or (select app.es_admin()));
create policy perfiles_insert on public.perfiles for insert to authenticated
  with check ((select app.es_admin()));
create policy perfiles_update on public.perfiles for update to authenticated
  using (id = (select auth.uid()) or (select app.es_admin()))
  with check (id = (select auth.uid()) or (select app.es_admin()));

-- ---- config ----------------------------------------------------------
create policy config_select_staff on public.config for select to authenticated
  using ((select app.es_staff()));
create policy config_select_anon on public.config for select to anon using (true);
create policy config_update on public.config for update to authenticated
  using ((select app.es_admin())) with check ((select app.es_admin()));

-- ---- categorias ------------------------------------------------------
create policy categorias_select_staff on public.categorias for select to authenticated
  using ((select app.es_staff()) and (eliminado_en is null or (select app.es_admin())));
create policy categorias_select_anon on public.categorias for select to anon
  using (activa and eliminado_en is null);
create policy categorias_insert on public.categorias for insert to authenticated
  with check ((select app.es_admin()));
create policy categorias_update on public.categorias for update to authenticated
  using ((select app.es_admin())) with check ((select app.es_admin()));

-- ---- productos -------------------------------------------------------
create policy productos_select_staff on public.productos for select to authenticated
  using ((select app.es_staff()) and (eliminado_en is null or (select app.es_admin())));
create policy productos_select_anon on public.productos for select to anon
  using (publicado and eliminado_en is null);
create policy productos_insert on public.productos for insert to authenticated
  with check ((select app.es_admin()));
create policy productos_update on public.productos for update to authenticated
  using ((select app.es_admin())) with check ((select app.es_admin()));

-- ---- combo_items / combos_fotos --------------------------------------
create policy combo_items_select_staff on public.combo_items for select to authenticated
  using ((select app.es_staff()));
create policy combo_items_select_anon on public.combo_items for select to anon
  using (exists (select 1 from public.productos c where c.id = combo_id));   -- RLS de anon filtra publicados
create policy combo_items_insert on public.combo_items for insert to authenticated
  with check ((select app.es_admin()));
create policy combo_items_update on public.combo_items for update to authenticated
  using ((select app.es_admin())) with check ((select app.es_admin()));
create policy combo_items_delete on public.combo_items for delete to authenticated
  using ((select app.es_admin()));

create policy combos_fotos_select_staff on public.combos_fotos for select to authenticated
  using ((select app.es_staff()));
create policy combos_fotos_select_anon on public.combos_fotos for select to anon
  using (exists (select 1 from public.productos c where c.id = combo_id));
create policy combos_fotos_insert on public.combos_fotos for insert to authenticated
  with check ((select app.es_admin()));
create policy combos_fotos_update on public.combos_fotos for update to authenticated
  using ((select app.es_admin())) with check ((select app.es_admin()));
create policy combos_fotos_delete on public.combos_fotos for delete to authenticated
  using ((select app.es_admin()));

-- ---- precios_historico (solo lectura admin; lo escribe el trigger) -----
create policy precios_select on public.precios_historico for select to authenticated
  using ((select app.es_admin()));

-- ---- proveedores -----------------------------------------------------
create policy proveedores_select on public.proveedores for select to authenticated
  using ((select app.tiene_rol(array['admin', 'produccion'])) and (eliminado_en is null or (select app.es_admin())));
create policy proveedores_insert on public.proveedores for insert to authenticated
  with check ((select app.tiene_rol(array['admin', 'produccion'])));
create policy proveedores_update on public.proveedores for update to authenticated
  using ((select app.tiene_rol(array['admin', 'produccion'])))
  with check ((select app.tiene_rol(array['admin', 'produccion'])));

-- ---- insumos / movimientos / recetas / empaque / cajas ----------------
create policy insumos_select on public.insumos for select to authenticated
  using ((select app.tiene_rol(array['admin', 'produccion'])) and (eliminado_en is null or (select app.es_admin())));
create policy insumos_insert on public.insumos for insert to authenticated
  with check ((select app.tiene_rol(array['admin', 'produccion'])));
create policy insumos_update on public.insumos for update to authenticated
  using ((select app.tiene_rol(array['admin', 'produccion'])))
  with check ((select app.tiene_rol(array['admin', 'produccion'])));

create policy movimientos_select on public.movimientos_insumo for select to authenticated
  using ((select app.tiene_rol(array['admin', 'produccion'])));
create policy movimientos_insert on public.movimientos_insumo for insert to authenticated
  with check ((select app.tiene_rol(array['admin', 'produccion'])));

create policy recetas_select on public.recetas for select to authenticated
  using ((select app.tiene_rol(array['admin', 'produccion'])));
create policy recetas_insert on public.recetas for insert to authenticated
  with check ((select app.es_admin()));
create policy recetas_update on public.recetas for update to authenticated
  using ((select app.es_admin())) with check ((select app.es_admin()));
create policy recetas_delete on public.recetas for delete to authenticated
  using ((select app.es_admin()));

create policy empaque_select on public.empaque_default for select to authenticated
  using ((select app.es_staff()));
create policy empaque_insert on public.empaque_default for insert to authenticated
  with check ((select app.es_admin()));
create policy empaque_update on public.empaque_default for update to authenticated
  using ((select app.es_admin())) with check ((select app.es_admin()));
create policy empaque_delete on public.empaque_default for delete to authenticated
  using ((select app.es_admin()));

create policy cajas_select on public.cajas_envio for select to authenticated
  using ((select app.es_staff()));
create policy cajas_insert on public.cajas_envio for insert to authenticated
  with check ((select app.es_admin()));
create policy cajas_update on public.cajas_envio for update to authenticated
  using ((select app.es_admin())) with check ((select app.es_admin()));

-- ---- moldes ----------------------------------------------------------
create policy moldes_select on public.moldes for select to authenticated
  using ((select app.tiene_rol(array['admin', 'produccion'])) and (eliminado_en is null or (select app.es_admin())));
create policy moldes_insert on public.moldes for insert to authenticated
  with check ((select app.tiene_rol(array['admin', 'produccion'])));
create policy moldes_update on public.moldes for update to authenticated
  using ((select app.tiene_rol(array['admin', 'produccion'])))
  with check ((select app.tiene_rol(array['admin', 'produccion'])));

create policy molde_producto_select on public.molde_producto for select to authenticated
  using ((select app.tiene_rol(array['admin', 'produccion'])));
create policy molde_producto_insert on public.molde_producto for insert to authenticated
  with check ((select app.tiene_rol(array['admin', 'produccion'])));
create policy molde_producto_delete on public.molde_producto for delete to authenticated
  using ((select app.tiene_rol(array['admin', 'produccion'])));

-- ---- finanzas (solo admin; producción compra vía RPC) -----------------
create policy categorias_gasto_select on public.categorias_gasto for select to authenticated
  using ((select app.es_admin()));
create policy categorias_gasto_insert on public.categorias_gasto for insert to authenticated
  with check ((select app.es_admin()));
create policy categorias_gasto_update on public.categorias_gasto for update to authenticated
  using ((select app.es_admin())) with check ((select app.es_admin()));

create policy gastos_select on public.gastos for select to authenticated
  using ((select app.es_admin()));
create policy gastos_insert on public.gastos for insert to authenticated
  with check ((select app.es_admin()));
create policy gastos_update on public.gastos for update to authenticated
  using ((select app.es_admin())) with check ((select app.es_admin()));

-- ---- clientes / pedidos (datos personales: admin + ventas) -----------
create policy clientes_select on public.clientes for select to authenticated
  using ((select app.tiene_rol(array['admin', 'ventas'])) and (eliminado_en is null or (select app.es_admin())));
create policy clientes_insert on public.clientes for insert to authenticated
  with check ((select app.tiene_rol(array['admin', 'ventas'])));
create policy clientes_update on public.clientes for update to authenticated
  using ((select app.tiene_rol(array['admin', 'ventas'])))
  with check ((select app.tiene_rol(array['admin', 'ventas'])));

create policy pedidos_select on public.pedidos for select to authenticated
  using ((select app.tiene_rol(array['admin', 'ventas'])) and (eliminado_en is null or (select app.es_admin())));
create policy pedidos_insert on public.pedidos for insert to authenticated
  with check ((select app.tiene_rol(array['admin', 'ventas'])));
create policy pedidos_update on public.pedidos for update to authenticated
  using ((select app.tiene_rol(array['admin', 'ventas'])))
  with check ((select app.tiene_rol(array['admin', 'ventas'])));

create policy pedido_items_select on public.pedido_items for select to authenticated
  using ((select app.tiene_rol(array['admin', 'ventas'])));
create policy pedido_items_insert on public.pedido_items for insert to authenticated
  with check ((select app.tiene_rol(array['admin', 'ventas'])));
create policy pedido_items_update on public.pedido_items for update to authenticated
  using ((select app.tiene_rol(array['admin', 'ventas'])))
  with check ((select app.tiene_rol(array['admin', 'ventas'])));
create policy pedido_items_delete on public.pedido_items for delete to authenticated
  using ((select app.tiene_rol(array['admin', 'ventas'])));

create policy pagos_select on public.pagos for select to authenticated
  using ((select app.tiene_rol(array['admin', 'ventas'])));
create policy pagos_insert on public.pagos for insert to authenticated
  with check ((select app.tiene_rol(array['admin', 'ventas'])));

-- ---- notificaciones / dispositivos: estrictamente propios ------------
create policy notificaciones_select on public.notificaciones for select to authenticated
  using (usuario_id = (select auth.uid()) and (select app.es_staff()));
create policy notificaciones_update on public.notificaciones for update to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
create policy notificaciones_delete on public.notificaciones for delete to authenticated
  using (usuario_id = (select auth.uid()));

create policy dispositivos_select on public.dispositivos_push for select to authenticated
  using (usuario_id = (select auth.uid()));
create policy dispositivos_delete on public.dispositivos_push for delete to authenticated
  using (usuario_id = (select auth.uid()));

-- ---- auditoría: solo lectura admin -----------------------------------
create policy auditoria_select on public.auditoria for select to authenticated
  using ((select app.es_admin()));
