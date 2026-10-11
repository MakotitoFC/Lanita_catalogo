-- =====================================================================
-- Lanita · 0012 · crear_pedido: atómico e idempotente
-- El APK genera el uuid del pedido al crear el borrador offline; si el
-- envío se repite (reintento tras cortarse la red) NO se duplica.
-- =====================================================================

create or replace function public.crear_pedido(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id  uuid := coalesce(nullif(p ->> 'id', '')::uuid, gen_random_uuid());
  v_wa  text := nullif(regexp_replace(coalesce(p ->> 'cliente_whatsapp', ''), '\D', '', 'g'), '');
  v_nom text := btrim(coalesce(p ->> 'cliente_nombre', ''));
  v_cli uuid;
  it    jsonb;
begin
  if not app.tiene_rol(array['admin', 'ventas']) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if exists (select 1 from public.pedidos where id = v_id) then return v_id; end if;   -- idempotente
  if jsonb_typeof(p -> 'items') is distinct from 'array' or jsonb_array_length(p -> 'items') = 0 then
    raise exception 'Agregue al menos un producto';
  end if;

  if v_wa is not null then
    select id into v_cli from public.clientes where whatsapp = v_wa and eliminado_en is null;
    if v_cli is null then
      insert into public.clientes (nombre, whatsapp, canal_preferido)
      values (v_nom, v_wa, coalesce(p ->> 'canal', 'whatsapp')) returning id into v_cli;
    end if;
  end if;

  insert into public.pedidos (id, cliente_id, cliente_nombre, cliente_whatsapp, direccion_entrega, requiere_envio,
                              canal, fecha_entrega, tematica, personalizacion, notas, notas_produccion,
                              descuento, costo_envio, caja_envio_id)
  values (v_id, v_cli, v_nom, v_wa, nullif(p ->> 'direccion_entrega', ''),
          coalesce((p ->> 'requiere_envio')::boolean, false), coalesce(p ->> 'canal', 'whatsapp'),
          nullif(p ->> 'fecha_entrega', '')::date, nullif(p ->> 'tematica', ''), nullif(p ->> 'personalizacion', ''),
          nullif(p ->> 'notas', ''), nullif(p ->> 'notas_produccion', ''),
          coalesce((p ->> 'descuento')::numeric, 0), coalesce((p ->> 'costo_envio')::numeric, 0),
          (select caja_defecto_id from public.config limit 1));

  for it in select * from jsonb_array_elements(p -> 'items') loop
    insert into public.pedido_items (pedido_id, producto_id, cantidad, precio_unitario, notas)
    values (v_id, (it ->> 'producto_id')::uuid, (it ->> 'cantidad')::int,
            nullif(it ->> 'precio_unitario', '')::numeric, nullif(it ->> 'notas', ''));
  end loop;
  return v_id;
end $$;

revoke all on function public.crear_pedido(jsonb) from public, anon, authenticated;
grant execute on function public.crear_pedido(jsonb) to authenticated;
