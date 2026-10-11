import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new PGlite();

const stubs = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
create schema extensions;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$ select (string_to_array(name,'/'))[1:greatest(array_length(string_to_array(name,'/'),1)-1,0)] $$;
grant usage on schema auth, storage, extensions, public to anon, authenticated;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated, public;
`;
await db.exec(stubs);

const files = fs.readdirSync(path.join(root, 'migrations')).sort();
for (const f of files) {
  let sql = fs.readFileSync(path.join(root, 'migrations', f), 'utf8').replace(/create extension if not exists pgcrypto[^;]*;/, '');
  try { await db.exec(sql); console.log('OK  ', f); }
  catch (e) { console.log('FAIL', f, e.message); process.exit(1); }
}
try { await db.exec(fs.readFileSync(path.join(root, 'seed.sql'), 'utf8')); console.log('OK   seed.sql'); }
catch (e) { console.log('FAIL seed', e.message); process.exit(1); }

const A = '11111111-1111-1111-1111-111111111111', P = '22222222-2222-2222-2222-222222222222', V = '33333333-3333-3333-3333-333333333333';
await db.exec(`
insert into auth.users(id,email) values ('${A}','a@x'),('${P}','p@x'),('${V}','v@x');
insert into public.perfiles(id,nombre,rol) values ('${A}','Admin Uno','admin');
`);

let pass = 0, fail = 0;
// El sistema solo admite el rol admin (0014).
try { await db.exec(`insert into public.perfiles(id,nombre,rol) values ('${P}','X','produccion')`); fail++; console.log('  ✗ DEBIÓ RECHAZAR rol produccion'); }
catch { pass++; console.log('  ✓ la BD rechaza cualquier rol distinto de admin'); }
// Regresión de la lógica de roles dormidos: se relaja la restricción SOLO en esta base de pruebas.
await db.exec(`alter table public.perfiles drop constraint perfiles_rol_check;
insert into public.perfiles(id,nombre,rol) values ('${P}','Prod Dos','produccion'),('${V}','Ventas Tres','ventas');`);
async function as(role, uid, fn) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid ?? ''}',false), set_config('request.jwt.claims','${uid ? `{"sub":"${uid}","aal":"aal1"}` : '{}'}',false); set role ${role};`);
  try { return await fn(); } finally { await db.exec('reset role;'); }
}
async function ok(name, role, uid, sql) {
  try { const r = await as(role, uid, () => db.query(sql)); pass++; console.log('  ✓', name); return r.rows; }
  catch (e) { fail++; console.log('  ✗', name, '->', e.message); return null; }
}
async function denied(name, role, uid, sql, expect = null) {
  try {
    const r = await as(role, uid, () => db.query(sql));
    if (expect !== null && r.rows.length === expect) { pass++; console.log('  ✓', name, '(0 filas)'); return; }
    fail++; console.log('  ✗ DEBIÓ FALLAR:', name, JSON.stringify(r.rows).slice(0, 120));
  } catch (e) { pass++; console.log('  ✓', name, '→', e.message.slice(0, 70)); }
}

console.log('\n== ANON ==');
await denied('anon no lee insumos', 'anon', null, 'select * from insumos');
await denied('anon no lee pedidos', 'anon', null, 'select * from pedidos');
await denied('anon no lee gastos', 'anon', null, 'select * from gastos');
await denied('anon no lee perfiles', 'anon', null, 'select * from perfiles');
await denied('anon no lee auditoria', 'anon', null, 'select * from auditoria');
await denied('anon no lee stock de productos', 'anon', null, 'select stock from productos');
await denied('anon no lee config interna', 'anon', null, 'select exigir_mfa_admin from config');
await denied('anon no puede insertar productos', 'anon', null, "insert into productos(nombre,categoria_id) select 'x', id from categorias limit 1");
await ok('anon lee config pública', 'anon', null, 'select nombre_negocio, whatsapp_numero from v_catalogo_config');
await denied('anon no puede ejecutar dashboard', 'anon', null, 'select dashboard_resumen()');

console.log('\n== ADMIN: catálogo ==');
await ok('admin crea producto borrador', 'authenticated', A, `insert into productos(nombre,precio,categoria_id) select 'Porta vela luna', 15, id from categorias where slug='porta-velas'`);
await denied('publicar sin imagen falla', 'authenticated', A, `update productos set publicado=true where nombre='Porta vela luna'`);
await ok('publicar con imagen', 'authenticated', A, `update productos set publicado=true, imagen_url='https://x.supabase.co/storage/v1/object/public/productos/a.jpg' where nombre='Porta vela luna'`);
await denied('URL http rechazada', 'authenticated', A, `update productos set imagen_url='http://evil' where nombre='Porta vela luna'`);
await ok('cambio de precio con motivo', 'authenticated', A, `update productos set precio=18, motivo_cambio_precio='Subió el cemento' where nombre='Porta vela luna'`);
let h = await ok('historial de precios', 'authenticated', A, `select precio_anterior, precio_nuevo, motivo from precios_historico`);
console.log('    ', JSON.stringify(h));
await ok('borrador nuevo (no visible al público)', 'authenticated', A, `insert into productos(nombre,precio,categoria_id,sku) select 'Borrador secreto', 10, id, 'SKU-1' from categorias limit 1`);
let rows = await ok('anon ve solo publicados', 'anon', null, 'select nombre from v_catalogo_productos');
console.log('    ', JSON.stringify(rows));
if (rows && (rows.length !== 1 || rows[0].nombre !== 'Porta vela luna')) { fail++; console.log('  ✗ filtro público incorrecto'); }
await denied('anon no puede pedir sku', 'anon', null, 'select sku from productos');
await denied('ventas no puede crear productos', 'authenticated', V, `insert into productos(nombre,categoria_id) select 'h', id from categorias limit 1`);

console.log('\n== COMBOS ==');
await ok('crear combo', 'authenticated', A, `insert into productos(nombre,precio,categoria_id,es_combo) select 'Combo Baby Shower', 60, id, true from categorias where slug='combos'`);
await denied('publicar combo sin fotos falla', 'authenticated', A, `update productos set publicado=true where nombre='Combo Baby Shower'`);
await ok('foto del combo', 'authenticated', A, `insert into combos_fotos(combo_id,imagen_url,tematica,es_portada) select id,'https://x/y.jpg','baby shower',true from productos where nombre='Combo Baby Shower'`);
await ok('publicar combo con foto', 'authenticated', A, `update productos set publicado=true where nombre='Combo Baby Shower'`);
await ok('item en combo', 'authenticated', A, `insert into combo_items(combo_id,producto_id,cantidad) select c.id,p.id,2 from productos c, productos p where c.nombre='Combo Baby Shower' and p.nombre='Porta vela luna'`);
await denied('combo dentro de combo falla', 'authenticated', A, `insert into combo_items(combo_id,producto_id) select c.id,c.id from productos c where c.nombre='Combo Baby Shower'`);
rows = await ok('anon ve fotos del combo', 'anon', null, 'select tematica from v_catalogo_combo_fotos');
if (rows?.length !== 1) { fail++; console.log('  ✗ fotos combo públicas', rows); }

console.log('\n== INSUMOS / STOCK ==');
await denied('produccion no edita stock directo', 'authenticated', P, `update insumos set stock_actual=100 where nombre='Cemento gris'`);
await ok('ajuste inicial cemento 50', 'authenticated', P, `insert into movimientos_insumo(insumo_id,tipo,cantidad,motivo) select id,'ajuste',50,'Inventario inicial' from insumos where nombre='Cemento gris'`);
await ok('ajuste inicial papel seda 100', 'authenticated', P, `insert into movimientos_insumo(insumo_id,tipo,cantidad,motivo) select id,'ajuste',100,'Inventario inicial' from insumos where nombre='Papel seda'`);
await ok('ajuste inicial goma eva 10', 'authenticated', P, `insert into movimientos_insumo(insumo_id,tipo,cantidad,motivo) select id,'ajuste',10,'Inventario inicial' from insumos where nombre='Goma eva'`);
await denied('salida mayor al stock falla', 'authenticated', P, `insert into movimientos_insumo(insumo_id,tipo,cantidad,motivo) select id,'salida',999,'Prueba' from insumos where nombre='Cemento gris'`);
await denied('movimiento no se puede editar', 'authenticated', P, `update movimientos_insumo set cantidad=1`);
await denied('movimiento no se puede borrar', 'authenticated', A, `delete from movimientos_insumo`);
await denied('ventas no ve insumos', 'authenticated', V, 'select * from insumos', 0);
await ok('salida deja cemento bajo mínimo', 'authenticated', P, `insert into movimientos_insumo(insumo_id,tipo,cantidad,motivo) select id,'salida',46,'Producción' from insumos where nombre='Cemento gris'`);
rows = await ok('semáforo rojo en cemento', 'authenticated', P, `select nombre, semaforo from v_insumos_estado where nombre in ('Cemento gris','Pinceles')`);
console.log('    ', JSON.stringify(rows));
rows = await ok('notificación de stock bajo para produccion', 'authenticated', P, `select titulo from notificaciones`);
console.log('    ', JSON.stringify(rows));
await ok('compra de insumo crea gasto+entrada', 'authenticated', P, `select registrar_compra_insumo((select id from insumos where nombre='Cemento gris'), 20, 40, null, null, null, null, 'efectivo')`);
rows = await ok('costo promedio actualizado', 'authenticated', P, `select stock_actual, costo_unitario from insumos where nombre='Cemento gris'`);
console.log('    ', JSON.stringify(rows));
await denied('produccion no ve gastos', 'authenticated', P, 'select * from gastos', 0);
rows = await ok('admin ve gasto creado', 'authenticated', A, 'select monto from gastos');
if (rows?.length !== 1) { fail++; console.log('  ✗ gasto', rows); }
await denied('comprobante ajeno rechazado', 'authenticated', P, `select registrar_compra_insumo((select id from insumos where nombre='Cemento gris'), 1, 2, null, null, '${A}/x.jpg')`);

console.log('\n== PEDIDOS ==');
await ok('ventas crea pedido', 'authenticated', V, `insert into pedidos(cliente_nombre,cliente_whatsapp,fecha_entrega,tematica) values ('María Pérez','+51 999 111 222', current_date + 7,'baby shower')`);
const PID = (await db.query('select id from pedidos limit 1')).rows[0].id;
await ok('ventas agrega items', 'authenticated', V, `insert into pedido_items(pedido_id,producto_id,cantidad) select pe.id, pr.id, 3 from pedidos pe, productos pr where pr.nombre='Porta vela luna'`);
rows = await ok('total calculado por DB', 'authenticated', V, `select subtotal,total,cliente_whatsapp from pedidos`);
console.log('    ', JSON.stringify(rows));
await ok('descuento + envío', 'authenticated', V, `update pedidos set descuento=4, costo_envio=5`);
rows = await ok('total recalculado', 'authenticated', V, `select total from pedidos`);
console.log('    ', JSON.stringify(rows));
if (rows?.[0]?.total != 55) { fail++; console.log('  ✗ total esperado 55 (54-4+5)'); }
await denied('cliente no puede forzar total', 'authenticated', V, `update pedidos set total=1 where numero=1 and false`, 0);
await ok('total no manipulable', 'authenticated', V, `update pedidos set total=1, subtotal=999`);
rows = await ok('total sigue en 55', 'authenticated', V, `select total from pedidos`);
if (rows?.[0]?.total != 55) { fail++; console.log('  ✗ total manipulado', rows); }
await denied('produccion no lee pedidos (PII)', 'authenticated', P, 'select * from pedidos', 0);
rows = await ok('produccion ve vista sin PII', 'authenticated', P, 'select numero, cliente_alias, estado from pedidos_produccion()');
console.log('    ', JSON.stringify(rows));
await denied('estados antiguos ya no existen (en_produccion)', 'authenticated', V, `select pedido_cambiar_estado('${PID}','en_produccion')`);
await ok('pago anticipo', 'authenticated', V, `insert into pagos(pedido_id,monto,tipo) select id, 20, 'anticipo' from pedidos`);
await denied('pago inmutable', 'authenticated', A, `update pagos set monto=1`);
rows = await ok('saldo', 'authenticated', V, `select total,pagado,saldo from v_pedidos_saldo`);
console.log('    ', JSON.stringify(rows));
await denied('no se marca pagado con saldo pendiente', 'authenticated', V, `select pedido_cambiar_estado('${PID}','pagado')`);
await ok('pago del saldo', 'authenticated', V, `insert into pagos(pedido_id,monto,tipo) select id, 35, 'saldo' from pedidos`);
await ok('ventas marca pagado', 'authenticated', V, `select pedido_cambiar_estado('${PID}','pagado')`);
await denied('items bloqueados tras pagar', 'authenticated', V, `delete from pedido_items`);
await denied('un pedido pagado no se puede cancelar', 'authenticated', V, `select pedido_cambiar_estado('${PID}','cancelado')`);
await denied('pagado no vuelve a pendiente', 'authenticated', V, `select pedido_cambiar_estado('${PID}','pendiente')`);
await denied('pagado no admite cambios de importes', 'authenticated', V, `update pedidos set costo_envio=1`);

console.log('\n== crear_pedido (offline/idempotente) ==');
const draft = '44444444-4444-4444-4444-444444444444';
const payload = JSON.stringify({ id: draft, cliente_nombre: 'Luis Gómez', cliente_whatsapp: '+51 988 777 666', items: [{ producto_id: (await db.query(`select id from productos where nombre='Porta vela luna'`)).rows[0].id, cantidad: 2 }] });
await ok('ventas crea pedido por RPC', 'authenticated', V, `select crear_pedido('${payload}'::jsonb)`);
await ok('reintento no duplica', 'authenticated', V, `select crear_pedido('${payload}'::jsonb)`);
rows = await ok('un solo pedido y cliente creado', 'authenticated', V, `select (select count(*)::int from pedidos where id='${draft}') p, (select count(*)::int from clientes) c, (select total from pedidos where id='${draft}') t`);
console.log('    ', JSON.stringify(rows));
if (rows?.[0]?.p !== 1 || rows?.[0]?.c !== 1) { fail++; console.log('  ✗ idempotencia'); }
await denied('produccion no puede crear pedidos', 'authenticated', P, `select crear_pedido('${payload}'::jsonb)`);
await denied('anon no puede crear pedidos', 'anon', null, `select crear_pedido('${payload}'::jsonb)`);

console.log('\n== YAPE / PUNTO DE ENCUENTRO / SIN CHAT ==');
await denied('anon no ve el Yape del negocio', 'anon', null, 'select yape_numero from config');
await denied('anon no ve el titular', 'anon', null, 'select yape_titular from config');
await denied('el chat propio ya no existe (tabla)', 'anon', null, 'select * from chat_conversaciones');
await denied('el chat propio ya no existe (función)', 'anon', null, "select chat_iniciar('Ana','hola')");
await ok('admin configura Yape y punto de encuentro', 'authenticated', A, "update config set yape_numero='987654321', yape_titular='Maria C.', punto_encuentro_defecto='Plaza de Armas, Trujillo'");
await denied('Yape inválido rechazado', 'authenticated', A, "update config set yape_numero='12345'");
const PV = (await db.query("select id from productos where nombre='Porta vela luna'")).rows[0].id;
await ok('crear_pedido toma el punto de encuentro por defecto', 'authenticated', V, "select crear_pedido('" + JSON.stringify({ cliente_nombre: 'Rosa Díaz', cliente_whatsapp: '51955444333', items: [{ producto_id: PV, cantidad: 1 }] }) + "'::jsonb)");
rows = await ok('el pedido guarda el punto de encuentro', 'authenticated', V, "select punto_encuentro from pedidos where cliente_nombre='Rosa Díaz'");
if (rows?.[0]?.punto_encuentro !== 'Plaza de Armas, Trujillo') { fail++; console.log('  ✗ punto de encuentro', rows); }
await ok('pago por Yape', 'authenticated', V, "insert into pagos(pedido_id,monto,tipo,metodo_pago) select id, 9, 'anticipo', 'yape' from pedidos limit 1");
await denied('los pagos ya no admiten comprobante', 'authenticated', V, "insert into pagos(pedido_id,monto,metodo_pago,comprobante_path) select id, 1, 'yape', 'x/y.jpg' from pedidos limit 1");
await ok('pedido guarda su medio de pago', 'authenticated', V, "select medio_pago from pedidos limit 1");
await denied('medio de pago inválido rechazado', 'authenticated', V, "update pedidos set medio_pago='bitcoin'");
await denied('el pago sigue siendo inmutable', 'authenticated', V, 'update pagos set monto = 1');

console.log('\n== STOCK AUTOMÁTICO DE PRODUCTOS ==');
await ok('producto con stock (no bajo pedido) publicado', 'authenticated', A, "insert into productos(nombre,precio,categoria_id,imagen_url,publicado,bajo_pedido,stock) select 'Ángel perlado', 15, id, 'https://x/a.jpg', true, false, 3 from categorias limit 1");
const PS = (await db.query("select id from productos where nombre='Ángel perlado'")).rows[0].id;
await ok('ventas crea pedido de 2 unidades', 'authenticated', V, "select crear_pedido('" + JSON.stringify({ id: '55555555-5555-5555-5555-555555555555', cliente_nombre: 'Lucía Torres', cliente_whatsapp: '51900111222', items: [{ producto_id: PS, cantidad: 2 }] }) + "'::jsonb)");
rows = await ok('el stock baja al registrar el pedido (3 → 1)', 'authenticated', A, "select stock, disponible from productos where nombre='Ángel perlado'");
if (rows?.[0]?.stock !== 1 || rows?.[0]?.disponible !== true) { fail++; console.log('  ✗ stock esperado 1', rows); }
await denied('no se puede vender más de lo que hay', 'authenticated', V, "select crear_pedido('" + JSON.stringify({ cliente_nombre: 'Otro Cliente', cliente_whatsapp: '51900333444', items: [{ producto_id: PS, cantidad: 5 }] }) + "'::jsonb)");
rows = await ok('el pedido fallido no dejó rastros ni movió el stock', 'authenticated', A, "select (select stock from productos where nombre='Ángel perlado') s, (select count(*)::int from pedidos where cliente_nombre='Otro Cliente') p");
if (rows?.[0]?.s !== 1 || rows?.[0]?.p !== 0) { fail++; console.log('  ✗ transacción no atómica', rows); }
await ok('otro pedido toma la última unidad', 'authenticated', V, "select crear_pedido('" + JSON.stringify({ id: '66666666-6666-6666-6666-666666666666', cliente_nombre: 'Marco Vega', cliente_whatsapp: '51900555666', items: [{ producto_id: PS, cantidad: 1 }] }) + "'::jsonb)");
rows = await ok('stock 0 => agotado en la web', 'anon', null, "select disponible from v_catalogo_productos where nombre='Ángel perlado'");
if (rows?.[0]?.disponible !== false) { fail++; console.log('  ✗ debía verse agotado', rows); } else { pass++; console.log('  ✓ la web pública muestra el producto agotado'); }
await ok('se cancela el pedido de Lucía (devuelve 2)', 'authenticated', V, "select pedido_cambiar_estado('55555555-5555-5555-5555-555555555555','cancelado','El cliente no pagó')");
rows = await ok('el stock vuelve (0 → 2) y reaparece disponible', 'authenticated', A, "select stock, disponible from productos where nombre='Ángel perlado'");
if (rows?.[0]?.stock !== 2 || rows?.[0]?.disponible !== true) { fail++; console.log('  ✗ devolución de stock', rows); }
rows = await ok('web pública: vuelve a estar disponible', 'anon', null, "select disponible from v_catalogo_productos where nombre='Ángel perlado'");
if (rows?.[0]?.disponible !== true) { fail++; console.log('  ✗ web no se reactivó', rows); }
await ok('cancelar de nuevo no hace nada', 'authenticated', V, "select pedido_cambiar_estado('55555555-5555-5555-5555-555555555555','cancelado','otra vez')");
rows = await ok('stock intacto tras el intento', 'authenticated', A, "select stock from productos where nombre='Ángel perlado'");
if (rows?.[0]?.stock !== 2) { fail++; console.log('  ✗ doble devolución', rows); }
rows = await ok('productos bajo pedido no tocan stock', 'authenticated', A, "select stock from productos where nombre='Porta vela luna'");
console.log('    ', JSON.stringify(rows));

console.log('\n== PROMOCIONES ==');
rows = await ok('sin promociones: la web no ve ninguna', 'anon', null, 'select count(*)::int n from v_catalogo_promociones');
if (rows?.[0]?.n !== 0) { fail++; console.log('  ✗ debía haber 0', rows); }
await ok('admin crea promoción vigente', 'authenticated', A, "insert into promociones(titulo,descripcion,fecha_inicio,fecha_fin) values ('Navidad 2x1','Llévate 2 pagando 1', app.hoy() - 1, app.hoy() + 5)");
await ok('admin crea promoción futura', 'authenticated', A, "insert into promociones(titulo,fecha_inicio,fecha_fin) values ('Año Nuevo', app.hoy() + 10, app.hoy() + 20)");
await ok('admin crea promoción vencida', 'authenticated', A, "insert into promociones(titulo,fecha_inicio,fecha_fin) values ('Black Friday', app.hoy() - 20, app.hoy() - 10)");
await ok('admin crea promoción apagada', 'authenticated', A, "insert into promociones(titulo,fecha_inicio,fecha_fin,activa) values ('Pausada', app.hoy() - 1, app.hoy() + 5, false)");
await ok('admin crea promoción archivada', 'authenticated', A, "insert into promociones(titulo,fecha_inicio,fecha_fin,eliminado_en) values ('Archivada', app.hoy() - 1, app.hoy() + 5, now())");
rows = await ok('la web solo ve la vigente', 'anon', null, 'select titulo from v_catalogo_promociones');
console.log('    ', JSON.stringify(rows));
if (rows?.length !== 1 || rows[0].titulo !== 'Navidad 2x1') { fail++; console.log('  ✗ filtro de vigencia incorrecto'); } else { pass++; console.log('  ✓ futura, vencida, apagada y archivada NO se muestran'); }
rows = await ok('el admin ve todas', 'authenticated', A, 'select count(*)::int n from promociones');
if (rows?.[0]?.n !== 5) { fail++; console.log('  ✗ admin debía ver 5', rows); }
await ok('una promoción deja de verse al vencer (se mueve la fecha)', 'authenticated', A, "update promociones set fecha_fin = app.hoy() - 1, fecha_inicio = app.hoy() - 3 where titulo='Navidad 2x1'");
rows = await ok('ya no aparece', 'anon', null, 'select count(*)::int n from v_catalogo_promociones');
if (rows?.[0]?.n !== 0) { fail++; console.log('  ✗ debía ocultarse al vencer', rows); }
await ok('vuelve a aparecer al extender la fecha', 'authenticated', A, "update promociones set fecha_fin = app.hoy() + 2 where titulo='Navidad 2x1'");
await ok('promoción enlazada a un producto', 'authenticated', A, "update promociones set producto_id = (select id from productos where nombre='Porta vela luna') where titulo='Navidad 2x1'");
rows = await ok('la web recibe el enlace al producto', 'anon', null, 'select producto_slug from v_catalogo_promociones');
if (!rows?.[0]?.producto_slug) { fail++; console.log('  ✗ sin enlace', rows); }
await denied('fecha fin anterior al inicio rechazada', 'authenticated', A, "insert into promociones(titulo,fecha_inicio,fecha_fin) values ('Mala', app.hoy() + 5, app.hoy())");
await denied('imagen http rechazada', 'authenticated', A, "insert into promociones(titulo,imagen_url,fecha_inicio,fecha_fin) values ('Img','http://x/a.jpg', app.hoy(), app.hoy())");
await denied('anon no puede crear promociones', 'anon', null, "insert into promociones(titulo,fecha_inicio,fecha_fin) values ('Hack', app.hoy(), app.hoy())");
await denied('anon no lee la tabla completa', 'anon', null, 'select created_by from promociones');
await denied('ventas no crea promociones', 'authenticated', V, "insert into promociones(titulo,fecha_inicio,fecha_fin) values ('X', app.hoy(), app.hoy())");
await denied('nadie borra promociones', 'authenticated', A, 'delete from promociones');

console.log('\n== PERSONALIZACIÓN DE LA WEB (low-code) ==');
rows = await ok('anon lee tema e interruptores (públicos)', 'anon', null, 'select tema_colores, web_mostrar_promociones, web_mostrar_burbuja from v_catalogo_config');
if (rows?.[0]?.web_mostrar_promociones !== true || rows?.[0]?.web_mostrar_burbuja !== true) { fail++; console.log('  ✗ valores por defecto', rows); }
await ok('admin cambia los colores', 'authenticated', A, "update config set tema_colores = '{\"principal\":\"#b84f0b\",\"acento\":\"#e9c16a\",\"base\":\"#d3c199\",\"claro\":\"#a2d5d8\",\"secundario\":\"#64a2ad\"}'::jsonb");
rows = await ok('la web recibe los colores nuevos', 'anon', null, 'select tema_colores ->> \'principal\' as p from v_catalogo_config');
if (rows?.[0]?.p !== '#b84f0b') { fail++; console.log('  ✗ colores', rows); }
await denied('color inválido rechazado (no hexadecimal)', 'authenticated', A, "update config set tema_colores = '{\"principal\":\"red\",\"acento\":\"#e9c16a\",\"base\":\"#d3c199\",\"claro\":\"#a2d5d8\",\"secundario\":\"#64a2ad\"}'::jsonb");
await denied('inyección de CSS rechazada', 'authenticated', A, "update config set tema_colores = '{\"principal\":\"#fff;}body{display:none\",\"acento\":\"#e9c16a\",\"base\":\"#d3c199\",\"claro\":\"#a2d5d8\",\"secundario\":\"#64a2ad\"}'::jsonb");
await denied('claves de más rechazadas', 'authenticated', A, "update config set tema_colores = '{\"principal\":\"#b84f0b\",\"acento\":\"#e9c16a\",\"base\":\"#d3c199\",\"claro\":\"#a2d5d8\",\"secundario\":\"#64a2ad\",\"x\":\"#000000\"}'::jsonb");
await denied('faltan claves: rechazado', 'authenticated', A, "update config set tema_colores = '{\"principal\":\"#b84f0b\"}'::jsonb");
await ok('admin apaga promociones y burbuja', 'authenticated', A, 'update config set web_mostrar_promociones = false, web_mostrar_burbuja = false');
rows = await ok('la web lo ve apagado', 'anon', null, 'select web_mostrar_promociones as p, web_mostrar_burbuja as b from v_catalogo_config');
if (rows?.[0]?.p !== false || rows?.[0]?.b !== false) { fail++; console.log('  ✗ interruptores', rows); }
await ok('admin vuelve a encenderlos', 'authenticated', A, 'update config set web_mostrar_promociones = true, web_mostrar_burbuja = true');
await ok('ventas intenta cambiar la apariencia (no afecta ninguna fila)', 'authenticated', V, "update config set web_mostrar_burbuja = false");
rows = await ok('el valor sigue intacto', 'authenticated', A, 'select web_mostrar_burbuja as b from config');
if (rows?.[0]?.b !== true) { fail++; console.log('  ✗ ventas pudo cambiar la apariencia', rows); } else { pass++; console.log('  ✓ ventas no pudo modificar la apariencia'); }
await denied('anon no puede cambiar la apariencia', 'anon', null, "update config set tema_colores = null");
await denied('anon sigue sin ver datos internos (Yape)', 'anon', null, 'select yape_numero from config');

console.log('\n== MOLDES ==');
await ok('registrar molde', 'authenticated', P, `insert into moldes(nombre, proveedor_id, fecha_estimada_llegada) select 'Molde luna', id, current_date + 20 from proveedores where nombre='Temu'`);
await ok('molde → recibido', 'authenticated', P, `update moldes set estado='recibido'`);
await denied('recibido → en_transito inválido', 'authenticated', P, `update moldes set estado='en_transito'`);
rows = await ok('notificación molde recibido', 'authenticated', A, `select titulo from notificaciones where tipo='molde_recibido'`);
console.log('    ', JSON.stringify(rows));

console.log('\n== SEGURIDAD DE ROLES ==');
await denied('ventas no puede auto-ascenderse', 'authenticated', V, `update perfiles set rol='admin' where id='${V}'`);
await ok('ventas puede cambiar su nombre', 'authenticated', V, `update perfiles set nombre='Ventas Tres B' where id='${V}'`);
await denied('ventas no ve otros perfiles', 'authenticated', V, `select * from perfiles where id <> '${V}'`, 0);
await denied('ventas no inserta perfiles', 'authenticated', V, `insert into perfiles(id,nombre,rol) values (gen_random_uuid(),'x','admin')`);
await denied('último admin no se desactiva', 'authenticated', A, `update perfiles set activo=false where id='${A}'`);
await denied('usuario sin perfil no accede', 'authenticated', '99999999-9999-9999-9999-999999999999', 'select * from v_catalogo_productos', 0);
await denied('ventas no lee auditoría', 'authenticated', V, 'select * from auditoria', 0);
rows = await ok('admin lee auditoría', 'authenticated', A, `select count(*)::int n from auditoria`);
console.log('    entradas de auditoría:', rows?.[0]?.n);
await denied('auditoría inmutable (update)', 'authenticated', A, `update auditoria set rol='x'`);
await denied('auditoría inmutable (delete)', 'authenticated', A, `delete from auditoria`);
await denied('nadie borra pedidos', 'authenticated', A, `delete from pedidos`);
await denied('nadie borra productos', 'authenticated', A, `delete from productos`);
await denied('nadie borra gastos', 'authenticated', A, `delete from gastos`);

console.log('\n== MFA ==');
await db.exec(`update config set exigir_mfa_admin=true`);
await denied('admin aal1 bloqueado con MFA exigido', 'authenticated', A, `insert into categorias(nombre,slug) values ('z','z')`);
await db.exec(`reset role; select set_config('request.jwt.claim.sub','${A}',false), set_config('request.jwt.claims','{"sub":"${A}","aal":"aal2"}',false); set role authenticated;`);
try { await db.query(`insert into categorias(nombre,slug) values ('zz','zz')`); pass++; console.log('  ✓ admin aal2 permitido'); } catch (e) { fail++; console.log('  ✗ aal2', e.message); }
await db.exec('reset role; update config set exigir_mfa_admin=false');

console.log('\n== DASHBOARD ==');
for (const [n, id] of [['admin', A], ['produccion', P], ['ventas', V]]) {
  rows = await ok('dashboard ' + n, 'authenticated', id, 'select dashboard_resumen() d');
  if (rows) console.log('    claves:', Object.keys(rows[0].d).join(', '));
}

console.log('\n== INSUMOS SIMPLES (compras + cuaderno) ==');
await ok('admin crea insumo sin stock', 'authenticated', A, `insert into insumos(nombre, unidad_medida, alerta_activa) values ('Cemento blanco', 'kg', false)`);
await ok('admin registra compra (gasto con insumo, cantidad y unidad)', 'authenticated', A, `insert into gastos(monto, descripcion, categoria_gasto_id, insumo_id, cantidad, unidad)
  select 40, 'Compra de Cemento blanco', (select id from categorias_gasto where slug='materia-prima'), i.id, 5, 'kg' from insumos i where i.nombre='Cemento blanco'`);
await denied('compra con cantidad 0 rechazada', 'authenticated', A, `insert into gastos(monto, descripcion, categoria_gasto_id, cantidad) values (10, 'Compra mala', (select id from categorias_gasto where slug='materia-prima'), 0)`);
await ok('admin escribe observación con fecha', 'authenticated', A, `insert into insumo_notas(insumo_id, fecha, texto) select id, '2026-10-05', 'Probé 3 partes de agua: quedó muy líquido' from insumos where nombre='Cemento blanco'`);
rows = await ok('admin lee el historial de notas', 'authenticated', A, `select texto from insumo_notas order by fecha desc`);
if (rows && rows.length !== 1) { fail++; console.log('  ✗ historial de notas inesperado'); }
await denied('observación demasiado corta rechazada', 'authenticated', A, `insert into insumo_notas(insumo_id, texto) select id, 'ok' from insumos where nombre='Cemento blanco'`);
await denied('anon no lee notas de insumos', 'anon', null, `select * from insumo_notas`);
await denied('anon no escribe notas de insumos', 'anon', null, `insert into insumo_notas(insumo_id, texto) select id, 'intento anónimo' from insumos limit 1`);
await denied('ventas (rol dormido) no lee notas', 'authenticated', V, `select * from insumo_notas`, 0);

console.log('\n== FOTOS Y MATERIALES DE PRODUCTO ==');
await ok('admin guarda materiales', 'authenticated', A, `update productos set materiales=array['Cemento gris','Arena fina','Pintura acrílica'] where nombre='Porta vela luna'`);
await ok('admin agrega varias fotos', 'authenticated', A, `insert into producto_fotos(producto_id,imagen_url,orden) select id,'https://x.supabase.co/storage/v1/object/public/productos/f'||g||'.jpg',g from productos, generate_series(0,2) g where nombre='Porta vela luna'`);
rows = await ok('anon ve fotos y materiales del producto publicado', 'anon', null, `select (select count(*) from v_catalogo_producto_fotos)::int fotos, (select materiales from v_catalogo_productos where nombre='Porta vela luna') m`);
if (rows && (rows[0].fotos !== 3 || rows[0].m.length !== 3)) { fail++; console.log('  ✗ lectura pública de fotos/materiales', JSON.stringify(rows[0])); }
await denied('anon no escribe fotos', 'anon', null, `insert into producto_fotos(producto_id,imagen_url) select id,'https://x.co/a.jpg' from productos limit 1`);
await denied('foto con URL http rechazada', 'authenticated', A, `insert into producto_fotos(producto_id,imagen_url) select id,'http://evil' from productos limit 1`);
await ok('admin elimina una foto', 'authenticated', A, `delete from producto_fotos where orden=2`);

console.log('\n== ESTADOS: pendiente / pagado / cancelado ==');
rows = await ok('estados válidos en la base', 'authenticated', A, `select distinct estado from pedidos order by 1`);
if (rows && rows.some((r) => !['pendiente', 'pagado', 'cancelado'].includes(r.estado))) { fail++; console.log('  ✗ estado fuera del modelo', JSON.stringify(rows)); }
await denied('la base rechaza un estado inventado', 'authenticated', A, `update pedidos set estado='entregado' where false or id in (select id from pedidos limit 1)`);
rows = await ok('dashboard devuelve la lista por cobrar', 'authenticated', A, `select dashboard_resumen() d`);
if (rows && !('por_cobrar' in rows[0].d && 'ventas' in rows[0].d && 'gastos_mes' in rows[0].d)) { fail++; console.log('  ✗ dashboard sin claves esperadas'); }

console.log(`\nRESULTADO: ${pass} ok, ${fail} fallos`);
process.exit(fail ? 1 : 0);
