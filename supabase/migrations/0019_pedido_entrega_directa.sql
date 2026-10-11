-- =====================================================================
-- 0019 · Pedidos sin etapas de producción
-- El negocio ya no maneja "en producción / listo / enviado": el pedido pasa de
-- Pendiente a Entregado (o Cancelado). Se permite esa transición directa para
-- administración y ventas. Los estados antiguos siguen existiendo en la base
-- (pedidos históricos) y también pueden cerrarse como entregados.
-- =====================================================================
create or replace function app.transicion_permitida(p_rol text, p_de text, p_a text)
returns boolean language sql immutable set search_path = '' as $$
  select case
    when p_de = p_a then true
    when p_rol is null or p_rol = 'admin' then (p_de || '>' || p_a) = any (array[
      'pendiente>en_produccion', 'pendiente>cancelado', 'pendiente>entregado',
      'en_produccion>listo', 'en_produccion>cancelado', 'en_produccion>pendiente', 'en_produccion>entregado',
      'listo>enviado', 'listo>entregado', 'listo>cancelado', 'listo>en_produccion',
      'enviado>entregado'])
    when p_rol = 'produccion' then (p_de || '>' || p_a) = any (array[
      'pendiente>en_produccion', 'en_produccion>listo'])
    when p_rol = 'ventas' then (p_de || '>' || p_a) = any (array[
      'pendiente>cancelado', 'en_produccion>cancelado', 'listo>cancelado',
      'pendiente>entregado', 'en_produccion>entregado',
      'listo>enviado', 'listo>entregado', 'enviado>entregado'])
    else false
  end
$$;
