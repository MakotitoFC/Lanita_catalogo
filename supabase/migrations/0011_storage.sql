-- =====================================================================
-- Lanita · 0011 · Storage
--   productos, combos : públicos (lectura por URL), escritura solo admin.
--   comprobantes      : PRIVADO. Ruta = <uid>/<yyyy>/<archivo>. Acceso por URL firmada.
-- Sin política SELECT para anon => nadie puede LISTAR los buckets públicos.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('productos',    'productos',    true,  5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('combos',       'combos',       true,  5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('comprobantes', 'comprobantes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Lectura (para gestionar) y escritura de imágenes del catálogo: admin
create policy "catalogo_select_staff" on storage.objects for select to authenticated
  using (bucket_id in ('productos', 'combos') and (select app.es_staff()));
create policy "catalogo_insert_admin" on storage.objects for insert to authenticated
  with check (bucket_id in ('productos', 'combos') and (select app.es_admin()));
create policy "catalogo_update_admin" on storage.objects for update to authenticated
  using (bucket_id in ('productos', 'combos') and (select app.es_admin()))
  with check (bucket_id in ('productos', 'combos') and (select app.es_admin()));
create policy "catalogo_delete_admin" on storage.objects for delete to authenticated
  using (bucket_id in ('productos', 'combos') and (select app.es_admin()));

-- Comprobantes: admin y producción suben a SU carpeta; leen: admin todo, cada quien lo suyo.
create policy "comprobantes_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes'
              and (select app.tiene_rol(array['admin', 'produccion']))
              and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "comprobantes_select" on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes'
         and ((select app.es_admin())
              or ((select app.tiene_rol(array['produccion']))
                  and (storage.foldername(name))[1] = (select auth.uid())::text)));
create policy "comprobantes_delete_admin" on storage.objects for delete to authenticated
  using (bucket_id = 'comprobantes' and (select app.es_admin()));
-- Sin UPDATE en comprobantes: son evidencia; se reemplazan subiendo otro archivo.
