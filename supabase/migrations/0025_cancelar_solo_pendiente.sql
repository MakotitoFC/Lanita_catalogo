-- =====================================================================
-- Lanita · 0025 · Solo se cancela antes de pagar
-- Un pedido pagado ya no se puede cancelar. Transiciones permitidas:
--   pendiente -> pagado   y   pendiente -> cancelado
-- =====================================================================
create or replace function app.transicion_permitida(p_rol text, p_de text, p_a text)
returns boolean language sql immutable set search_path = '' as $$
  select case
    when p_de = p_a then true
    when p_rol is null or p_rol in ('admin', 'ventas') then (p_de || '>' || p_a) = any (array['pendiente>pagado', 'pendiente>cancelado'])
    else false
  end
$$;
