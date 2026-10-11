-- =====================================================================
-- Lanita · 0015 · Yape, punto de encuentro y comprobantes de pago
--
-- Decisión de producto: la consulta del cliente sale de la web directo al WhatsApp personal del negocio.
-- El chat propio se descarta, así que se elimina cualquier rastro (si se hubiera aplicado).
-- El pedido lo arma el administrador en el APK y le envía al cliente los datos de pago por Yape y el punto de encuentro.
-- =====================================================================

-- ---- Quitar el chat propio (idempotente) ------------------------------
drop function if exists public.chat_iniciar(text, text, text, jsonb, text);
drop function if exists public.chat_enviar(uuid, text, text, jsonb);
drop function if exists public.chat_leer(uuid, text, timestamptz);
drop function if exists public.chat_responder(uuid, text);
drop function if exists public.chat_marcar_leido(uuid);
drop function if exists public.chat_cambiar_estado(uuid, boolean);
drop function if exists public.chat_purgar(int);
drop function if exists app.chat_conversacion_valida(uuid, text);
drop function if exists app.chat_items(jsonb);
drop function if exists app.chat_ip_hash();
drop function if exists app.chat_hash(text);
drop function if exists app.chat_limpiar(text);
drop table if exists public.chat_mensajes;
drop table if exists public.chat_conversaciones;

-- ---- Datos de cobro (solo los lee/escribe el admin; NO están en las columnas públicas) ----
alter table public.config
  add column if not exists yape_numero text check (yape_numero is null or yape_numero ~ '^[0-9]{9}$'),
  add column if not exists yape_titular text check (char_length(yape_titular) <= 80),
  add column if not exists punto_encuentro_defecto text check (char_length(punto_encuentro_defecto) <= 200);

-- ---- Punto de encuentro del pedido ----------------------------------
alter table public.pedidos
  add column if not exists punto_encuentro text check (char_length(punto_encuentro) <= 200);

-- ---- Yape / Plin como medios de pago y comprobante del pago -------------
alter table public.pagos drop constraint if exists pagos_metodo_pago_check;
alter table public.pagos add constraint pagos_metodo_pago_check
  check (metodo_pago in ('efectivo', 'yape', 'plin', 'transferencia', 'tarjeta', 'otro'));
alter table public.gastos drop constraint if exists gastos_metodo_pago_check;
alter table public.gastos add constraint gastos_metodo_pago_check
  check (metodo_pago in ('efectivo', 'yape', 'plin', 'transferencia', 'tarjeta', 'otro'));
alter table public.pagos
  add column if not exists comprobante_path text
    check (comprobante_path is null or (comprobante_path !~ '\.\.' and comprobante_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._/-]+$'));

-- ---- crear_pedido con punto de encuentro (por defecto, el configurado) ------
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

  insert into public.pedidos (id, cliente_id, cliente_nombre, cliente_whatsapp, direccion_entrega, punto_encuentro, requiere_envio,
                              canal, fecha_entrega, tematica, personalizacion, notas, notas_produccion,
                              descuento, costo_envio, caja_envio_id)
  values (v_id, v_cli, v_nom, v_wa, nullif(p ->> 'direccion_entrega', ''),
          coalesce(nullif(p ->> 'punto_encuentro', ''), (select punto_encuentro_defecto from public.config limit 1)),
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
