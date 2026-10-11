-- =====================================================================
-- Lanita · 0013 · Producción: de vistas SECURITY DEFINER a funciones
-- El linter de Supabase marca como ERROR las vistas que saltan RLS. Se
-- reemplazan por funciones que validan el rol DENTRO y devuelven solo
-- columnas sin datos personales (alias = primer nombre).
-- =====================================================================

drop view if exists public.v_pedidos_produccion;
drop view if exists public.v_pedido_items_produccion;

create or replace function public.pedidos_produccion()
returns table (
  id uuid, numero bigint, estado text, fecha_pedido date, fecha_entrega date, tematica text,
  personalizacion text, notas_produccion text, requiere_envio boolean, caja_envio_id uuid, cliente_alias text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.tiene_rol(array['admin', 'produccion']) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return query
    select p.id, p.numero, p.estado, p.fecha_pedido, p.fecha_entrega, p.tematica, p.personalizacion,
           p.notas_produccion, p.requiere_envio, p.caja_envio_id, split_part(p.cliente_nombre, ' ', 1)
      from public.pedidos p
     where p.eliminado_en is null;
end $$;

create or replace function public.pedido_items_produccion(p_pedido uuid default null)
returns table (id uuid, pedido_id uuid, producto_id uuid, nombre_snapshot text, cantidad int, notas text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.tiene_rol(array['admin', 'produccion']) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return query
    select i.id, i.pedido_id, i.producto_id, i.nombre_snapshot, i.cantidad, i.notas
      from public.pedido_items i join public.pedidos p on p.id = i.pedido_id
     where p.eliminado_en is null and (p_pedido is null or i.pedido_id = p_pedido);
end $$;

revoke all on function public.pedidos_produccion() from public, anon, authenticated;
revoke all on function public.pedido_items_produccion(uuid) from public, anon, authenticated;
grant execute on function public.pedidos_produccion() to authenticated;
grant execute on function public.pedido_items_produccion(uuid) to authenticated;
