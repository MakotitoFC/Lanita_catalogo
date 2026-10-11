# Lanita · decoración artesanal en cemento

Monorepo con dos clientes sobre un mismo backend Supabase:

| Pieza | Tecnología | Carpeta |
|---|---|---|
| APK interno (panel del dueño) | React Native + Expo (EAS) + NativeWind, paleta **lavanda** (#32293F · #554D74 · #796EA8 · #A6A9C8 · #D3D9E9) | `apps/mobile` |
| Web pública de catálogo | Next.js 15 (App Router, ISR) + Tailwind, paleta **lavanda** (#32293F · #554D74 · #796EA8 · #A6A9C8 · #D3D9E9) | `apps/web` |
| Lógica compartida | TypeScript + Zod (sin componentes React) | `packages/shared` |
| Base de datos, RLS, Storage | Supabase (Postgres) | `supabase/` |

> Detalle completo de tablas, permisos y flujos: [`docs/BASE_DE_DATOS.md`](docs/BASE_DE_DATOS.md).
> Modelo de seguridad: [`docs/SEGURIDAD.md`](docs/SEGURIDAD.md).

## 1. Correr el monorepo localmente

Requisitos: Node 20+, npm 10+, [Supabase CLI](https://supabase.com/docs/guides/cli) y Docker (para Supabase local).

```bash
npm install
cp .env.example apps/web/.env.local      # y dejar solo las variables NEXT_PUBLIC_*
cp .env.example apps/mobile/.env         # y dejar solo las variables EXPO_PUBLIC_*

supabase start                           # Postgres + Auth + Storage locales (aplica migraciones y seed)
npm run dev:web                          # http://localhost:3000
npm run dev:mobile                       # Expo (escanear con Expo Go / dev build)
```

`supabase start` imprime la `API URL` y la `anon key`: úsalas en los `.env`. **Nunca** uses la `service_role key` en
ningún `.env` de los clientes.

**Velocidad de la web:** `npm run dev:web` es el modo de desarrollo y es lento a propósito: Next compila cada página la primera vez
que la abres (a veces 10 a 20 segundos) y los cambios tardan hasta 15 segundos en reflejarse. Para ver la velocidad REAL que tendrá el
cliente usa `npm run preview:web` (compila y sirve la versión de producción: abrir un producto tarda entre 20 y 130 milisegundos).
En producción (Vercel) cada producto ya está preparado de antemano y, cuando guardas algo en el APK, la web se actualiza al instante porque
el APK le avisa: `EXPO_PUBLIC_WEB_URL` debe apuntar a tu dominio, no a `localhost`.

Pruebas:

```bash
npm run test --workspace @lanita/shared  # reglas de negocio y esquemas Zod
npm run test:db                          # 91 pruebas de RLS, triggers y flujos contra Postgres (PGlite, sin Docker)
npm run typecheck
```

## 2. Aplicar migraciones (Supabase en la nube)

```bash
supabase login
supabase link --project-ref <ref-del-proyecto>
supabase db push                         # aplica supabase/migrations/0001…0018
```

El seed (`supabase/seed.sql`: categorías, categorías de gasto, insumos base, empaque por defecto, caja Mediana,
proveedor Temu) se aplica solo en local con `supabase db reset`. En la nube, pégalo una vez en el SQL Editor.

### Crear el primer administrador (una sola vez)

El registro público está **desactivado**. Crea el usuario en *Authentication → Add user* (contraseña de 12+ caracteres
con mayúsculas, minúsculas, números y símbolos) y asígnale el rol en el SQL Editor:

```sql
insert into public.perfiles (id, nombre, rol)
select id, 'Nombre del dueño', 'admin' from auth.users where email = 'dueno@ejemplo.com';
```

Existe **un solo rol: administrador** (el dueño). La base de datos rechaza cualquier otro rol (migración `0014`).
Para que un desarrollador revise problemas técnicos no se le crea usuario en la app: se le invita a la organización
de Supabase (*Organization → Team → Invite*, permiso Developer) y se le retira al terminar.
Un usuario sin fila activa en `perfiles` no puede leer ni escribir nada.

### Configurar el negocio

Desde el APK (**Ajustes**) o con SQL: `whatsapp_numero` (solo dígitos con código de país, ej. `51999888777`), redes,
`moneda`/`moneda_simbolo` (por defecto `PEN` / `S/`) y `zona_horaria` (`America/Lima`, la de Trujillo
para que "hoy" y los reportes diarios cuadren).

### Flujo de venta (consulta por WhatsApp, pedido registrado en el APK)

1. **Web:** el cliente ve el catálogo (productos y combos, con filtros por tipo), toca **Agregar** en lo que le interesa y, en la burbuja,
   pulsa **Enviar a WhatsApp**. Se abre tu WhatsApp personal con un mensaje con formato (negritas y emojis) y un enlace por producto.
   WhatsApp solo admite texto por enlace: no se pueden adjuntar PDF ni imágenes de forma automática.
2. **WhatsApp:** conversas con el cliente y le indicas cómo pagar. El cliente **te envía la captura del Yape** por ahí
   (la conversación se queda en tu WhatsApp; con un WhatsApp personal no puede vivir dentro del APK).
3. **APK (todo lo registras tú, no se envía nada al cliente):** creas el **pedido** (nombre, teléfono, punto de encuentro) y registras el
   **pago** con la foto de la captura.
4. **Stock automático:** al registrar el pedido, el stock de los productos que NO son "bajo pedido" baja solo; si se cancela, vuelve.
   Con stock 0 el producto aparece **Agotado** en la web. El APK avisa a la web al instante (y la web también se refresca sola cada 5 min).
   No se puede registrar una venta mayor al stock disponible.

**Personalizar la web desde el APK (sin tocar código):** en **Más → Ajustes**:
logo, número de WhatsApp, redes, punto de encuentro, **colores** (5 colores en formato #RRGGBB o una paleta predefinida; el sistema genera el resto
de tonos y cuida el contraste), interruptores para **mostrar u ocultar** la sección de promociones y la burbuja de consulta, y en la pestaña **Productos** el
interruptor **"Visible en la web"** de cada producto. Cada cambio avisa a la web al instante.

**Promociones:** al inicio de la web hay una sección de promociones. Se crean en el APK (**Más → Promociones**) con título, descripción,
foto, fechas de inicio y fin y, si quieres, un producto enlazado. Aparecen solas al llegar la fecha de inicio y desaparecen al pasar la fecha de fin.
Si no hay ninguna vigente, la web muestra "Por ahora no hay promociones".

El logo del encabezado se sube en **Más → Ajustes → Logo**. Punto de encuentro por defecto: **Más → Ajustes → Datos del negocio**.
En producción define `NEXT_PUBLIC_SITE_URL` con tu dominio: los enlaces de los productos que viajan en el mensaje usan esa dirección.

### Notificaciones push (opcional pero recomendado)

1. `supabase functions deploy enviar-push --no-verify-jwt`
2. `supabase secrets set PUSH_WEBHOOK_SECRET=<cadena-larga-aleatoria>`
3. Dashboard → Database → Webhooks → crear webhook en `public.notificaciones` (INSERT) hacia la función, con el header
   `x-webhook-secret: <la misma cadena>`.
4. Poner el `projectId` real de EAS en `apps/mobile/app.json` (`extra.eas.projectId`).

## 3. Compilar el APK

```bash
cd apps/mobile
npm i -g eas-cli && eas login
eas init                                   # genera el projectId y complétalo en app.json
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value https://TU-PROYECTO.supabase.co
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon-key>
eas secret:create --name EXPO_PUBLIC_WEB_URL --value https://tu-dominio.com
eas build -p android --profile preview     # APK instalable (distribución interna)
```

`--profile production` genera un `.aab` para Play Store. Para iOS más adelante basta `eas build -p ios`: no cambia la
arquitectura (el `bundleIdentifier` ya está definido).

## 4. Desplegar la web (Vercel)

1. Importar el repo en Vercel con **Root Directory = `apps/web`** (Vercel detecta el monorepo npm workspaces).
2. Variables de entorno: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`.
3. Desplegar. Las páginas se regeneran cada 5 min (ISR) y **al instante** cuando el APK publica cambios.

**Revalidación bajo demanda:** tras crear/editar un producto, el APK llama a `POST /api/revalidate` enviando el token
de sesión del usuario. El servidor verifica ese token con Supabase y exige un perfil `admin` activo; **no hay ningún
secreto compartido dentro del APK**.

## 5. Rol

Hay un único rol: **administrador** (el dueño). Ve y gestiona todo: catálogo, insumos, moldes, pedidos, gastos,
usuarios, ajustes y auditoría. Las políticas de la base de datos para otros roles quedaron inertes (no se pueden asignar).

## 6. Estado del proyecto

Hecho y verificado: migraciones (11 + `crear_pedido`), RLS, grants, storage, seed, 91 pruebas de base de datos,
11 pruebas de `shared`, typecheck de los 3 paquetes, `next build` correcto y bundle Android de Expo correcto.

Pendiente / para validar en tu entorno: la compilación real del APK (`eas build`, necesita tu cuenta Expo),
el despliegue en Vercel y probar el APK en un teléfono. Mejoras futuras: edición de recetas desde el APK
(hoy se cargan por SQL o desde el panel de Supabase), vista de costos/márgenes por producto en el APK
(la vista `v_producto_costos` ya existe) y bloqueo biométrico de la app.
