# Modelo de seguridad de Lanita

Objetivo: **que ningún dato sensible salga por ningún medio**, y que ningún usuario pueda hacer más de lo que su rol permite,
aunque manipule la app o llame a la API directamente. Las reglas viven en la base de datos (no en el cliente), así que
valen igual para el APK, la web o un atacante con `curl`.

## 1. Capas de defensa

1. **Autenticación**: Supabase Auth, registro público desactivado, contraseña mínima de 12 caracteres con 4 tipos de
   carácter, rotación de refresh tokens, límites de intentos (`supabase/config.toml`). TOTP (2 pasos) disponible; con
   `config.exigir_mfa_admin = true` el servidor **rechaza** acciones de admin en sesiones sin 2 pasos (aal2).
2. **Autorización por rol** (`perfiles.rol`): sin perfil activo no hay acceso a nada. Funciones `app.rol_actual()`,
   `app.es_admin()`, `app.tiene_rol()` en un esquema (`app`) que **no** expone la API.
3. **GRANT mínimo**: se revoca todo a `anon`/`authenticated` y se concede solo lo necesario, incluso por **columna** (la web
   solo puede leer columnas públicas). Nadie tiene `DELETE` sobre datos de negocio ni `TRUNCATE`.
4. **RLS en las 24 tablas**, política por operación y por rol (matriz en `0009_rls.sql`).
5. **Triggers de integridad** que ni el admin puede saltarse desde el cliente: totales, stock, estados, snapshots.
6. **Auditoría inmutable** de todo cambio sensible (quién, cuándo, IP, campos, antes/después).

## 2. Qué NO sale nunca por la web pública

La web usa **solo** la clave `anon` y **solo** las vistas `v_catalogo_*`. `anon` no tiene permiso sobre:
stock, SKU, costos, recetas, proveedores, pedidos, clientes, gastos, perfiles, auditoría, ni los campos internos de
`config` (umbrales, flags de seguridad, zona horaria). Los borradores (`publicado = false`) y productos archivados no
son visibles. Los buckets públicos **no se pueden listar** (no hay política `SELECT` para `anon`).
Datos públicos por diseño: nombre, precio, fotos, descripción, WhatsApp del negocio y redes.

## 3. Datos personales (clientes)

* Nombre, WhatsApp y dirección solo los ven **admin y ventas**.
* **Producción** trabaja con `pedidos_produccion()` (primer nombre como alias, sin WhatsApp ni dirección).
* Las notificaciones push (viajan por Expo/Google) **no incluyen datos de clientes**: solo "Nuevo pedido #12".
* Los borradores sin conexión se guardan en el almacén **cifrado** del sistema (Keystore/Keychain), no en texto plano.
* El catálogo en caché local contiene solo datos no personales.
* Las fotos se re-codifican antes de subir: se elimina el EXIF (ubicación GPS del taller o domicilio).

## 4. Comprobantes y archivos

* Bucket `comprobantes` **privado**; se guarda la *ruta*, no una URL. Se abre con **URL firmada de 60 s**.
* Ruta obligatoria `<uid>/<año>/<archivo>`: cada usuario sube a su carpeta; solo admin lee todas.
* Tipos MIME y tamaño (5 MB) restringidos en el bucket; rutas validadas contra `..` y caracteres raros.
* Sin política `UPDATE` ni `DELETE` para producción: las evidencias no se reescriben.

## 5. Secretos

* Los clientes solo reciben `URL` + `anon key` (pública por diseño; protegida por RLS).
* `crearClienteSupabase` **lanza error** si detecta una `service_role key` (la rechaza antes de crear el cliente).
* `/api/revalidate` no usa secreto compartido: valida el JWT del usuario y exige `admin` activo; 10 llamadas/min por usuario.
* La Edge Function de push usa el `service_role` solo en el servidor (variable inyectada por Supabase) y exige un header
  secreto comparado en tiempo constante.
* `.gitignore` excluye `.env*`, keystores y certificados.

## 6. Web: cabeceras y superficie

CSP estricta (sin frames, `object-src 'none'`, imágenes solo de Supabase), HSTS 2 años con preload,
`X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (cámara/micro/geo desactivados),
COOP, `poweredByHeader` desactivado, `/api/*` sin caché. No hay formularios ni login en la web pública.
JSON-LD escapa `<` para evitar inyección. Todo el texto se renderiza con React (escapado automático).

## 7. APK

Sesión en `expo-secure-store` (cifrado por el sistema), `allowBackup=false`, permisos de audio y ubicación bloqueados,
mensaje de login genérico (no revela si un correo existe), errores traducidos sin exponer detalles de SQL.

## 8. Integridad de negocio (anti-fraude y anti-error)

* `stock_actual` **solo** cambia mediante `movimientos_insumo` (libro inmutable con stock antes/después).
* `pagos`, `movimientos_insumo`, `precios_historico` y `auditoria` son **append-only** (UPDATE/DELETE bloqueados).
* Totales del pedido calculados por la BD; el cliente no puede manipular `total`, `subtotal` ni banderas internas.
* Máquina de estados de pedidos y moldes con permisos por rol; cancelar exige motivo.
* No se puede dejar el sistema sin administrador ni auto-ascender un rol.
* Nada se borra: se archiva (`eliminado_en`). Solo el admin ve archivados.

## 8 bis. Consultas, pagos y stock

* Las consultas de la web **no se guardan en ningún servidor**: la lista vive en el navegador del visitante y sale directo al WhatsApp del negocio.
  No hay formularios ni funciones públicas que acepten datos de visitantes (superficie de ataque mínima).
* El APK **no envía nada al cliente**; el pedido y el pago los registra solo el administrador.
* Los comprobantes de pago (capturas de Yape) van al bucket **privado** `comprobantes` y se abren con URL firmada de 60 s.
* Yape no tiene API pública para cuentas personales: los pagos se registran a mano (cada pago es un registro inmutable; los errores se corrigen con un reembolso).
* El stock de productos terminados cambia **solo por triggers** al registrar o cancelar pedidos (bloqueo de fila, sin sobreventa, sin números negativos).

## 8 ter. Personalización de la web

* Los colores se guardan como 5 valores `#RRGGBB` con restricción en la base de datos (claves exactas, solo hexadecimal): **no se puede inyectar CSS**.
  Además la web nunca incrusta el texto guardado: recalcula la paleta y solo emite números.
* Solo el administrador puede cambiar colores, logo, número e interruptores (RLS + GRANT). Anon únicamente los lee.

## 9. Lista de verificación al publicar

- [ ] `enable_signup = false` en Auth (ya en `config.toml`; verificar en Dashboard → Auth → Providers).
- [ ] Cada admin registra TOTP y luego se activa `exigir_mfa_admin`.
- [ ] Activar *Leaked password protection* y *Point-in-time recovery/backups* en Supabase.
- [ ] Rotar `anon`/`service_role` si alguna vez se pegaron en un chat o repositorio.
- [ ] Revisar *Database → Advisors* (security) tras `db push`.
- [ ] Probar con un usuario `ventas` que no puede abrir Insumos, Gastos ni Ajustes.
