# Base de datos de Lanita (Supabase / Postgres)

Convenciones: PK `uuid`; `created_at/updated_at/created_by/updated_by` en todas las tablas editables (los pone un
trigger, el cliente no puede falsificarlos); borrado lógico con `eliminado_en`; textos con límites de longitud; URLs solo
`https://`; dinero `numeric(12,2)`; cantidades de insumos `numeric(14,3)`.

## Migraciones (`supabase/migrations`)

| Archivo | Contenido |
|---|---|
| `0001_fundamentos` | Esquema privado `app`, privilegios por defecto cerrados, `slugify`, triggers de sellos e inmutabilidad |
| `0002_perfiles_config` | `perfiles` (roles) y `config` (fila única, parte pública + interna), `app.hoy()` con zona horaria |
| `0003_seguridad_base` | Funciones de autorización, protección anti-escalada, `auditoria`, `notificaciones`, `dispositivos_push` |
| `0004_catalogo` | `proveedores`, `categorias_gasto`, `categorias`, `productos`, `combo_items`, `combos_fotos`, `precios_historico` |
| `0005_insumos_moldes` | `insumos`, `recetas`, `empaque_default`, `cajas_envio`, `moldes`, `molde_producto` |
| `0006_pedidos` | `clientes`, `pedidos`, `pedido_items`, `pagos`, máquina de estados |
| `0007_finanzas_movimientos` | `gastos`, `movimientos_insumo`, compra de insumo, consumo automático por pedido |
| `0019_pedido_entrega_directa` | Transición directa Pendiente → Entregado (sin etapas de producción) |
| `0020_insumos_simples` | Insumos sin stock: compras = `gastos` con `insumo_id`, `cantidad`, `unidad`; observaciones por fecha en `insumo_notas` (solo admin); categorías de gasto más claras |
| `0021_pedido_simple` | `pedidos.medio_pago` (yape/efectivo); cancelar sin motivo; se elimina el comprobante de los pagos |
| `0022_fotos_materiales` | `producto_fotos` (varias fotos por producto, portada = primera) y `productos.materiales` (lista) |
| `0023_estados_pedido` | Estados del pedido: `pendiente`, `pagado`, `cancelado`; pagar exige saldo 0; `dashboard_resumen` solo con lo que usa la app |
| `0008_triggers_vistas_rpc` | Sellos y auditoría en bloque, vistas públicas e internas, `dashboard_resumen()` |
| `0009_rls` | Políticas RLS de todas las tablas |
| `0010_grants` | GRANT explícitos (por tabla, por columna para `anon`, por función) |
| `0011_storage` | Buckets `productos`, `combos` (públicos) y `comprobantes` (privado) y sus políticas |
| `0012_crear_pedido` | `crear_pedido(jsonb)` atómico e idempotente (pedidos creados sin conexión) |
| `0013_produccion_rpc` | Reemplaza las vistas de producción por funciones (el linter marca las vistas SECURITY DEFINER como ERROR) |
| `0014_solo_admin` | Un solo rol: administrador |
| `0015_yape_punto_encuentro` | Yape/titular/punto de encuentro en `config` (privados), `pedidos.punto_encuentro`, `pagos.comprobante_path`, Yape/Plin como medios de pago; elimina el chat propio |
| `0016_stock_automatico` | El stock de productos (no bajo pedido) baja al registrar un pedido y vuelve al cancelarlo; stock 0 ⇒ agotado en la web |
| `0017_promociones` | Promociones con fechas: la web solo ve las activas y vigentes (según la zona horaria del negocio); vista pública `v_catalogo_promociones` |
| `0018_personalizacion_web` | `config.tema_colores` (5 colores #RRGGBB validados), interruptores de promociones y burbuja; todo público y solo editable por el admin |

## Tablas

**Acceso y configuración**
* `perfiles` — usuario interno: `nombre`, `rol` (admin/produccion/ventas), `activo`.
* `config` — fila única. Pública: nombre, eslogan, horarios, WhatsApp, redes, moneda, mensaje por defecto.
  Interna: `zona_horaria`, `dias_alerta_molde`, `bloquear_sin_stock`, `exigir_mfa_admin`, `caja_defecto_id`.
* `auditoria` — bitácora inmutable. · `notificaciones` / `dispositivos_push` — avisos push por usuario.

**Catálogo**
* `categorias`, `productos` (`es_combo`, `publicado`, `disponible`, `bajo_pedido`, `stock`, SEO, búsqueda full-text),
  `combo_items` (un combo no contiene combos), `combos_fotos` (temática, portada única, orden),
  `precios_historico` (se llena solo al cambiar el precio; el APK envía el *motivo*).

**Producción e insumos**
* `insumos` — unidad, color (pinturas), `stock_minimo`, `alerta_activa`, `rotacion`, `costo_unitario` (promedio ponderado),
  proveedor, notas. Pinceles y sellos: `alerta_activa=false`, `stock_minimo=0`, rotación baja.
* `movimientos_insumo` — entrada/salida/ajuste con `stock_antes/stock_despues`, vínculo a pedido y gasto. Única vía de cambio de stock.
* `recetas` (insumos por unidad de producto) · `empaque_default` (2 pliegos de papel seda y 0,5 plancha de goma eva por
  producto; caja por pedido, si se configura) · `cajas_envio` (medidas editables; hoy "Mediana" sin medidas).
* `moldes` (estado pedido→en_tránsito→recibido|cancelado, fechas, costo, seguimiento) · `molde_producto`.

**Ventas y finanzas**
* `clientes` · `pedidos` (número correlativo, canal, estado, entrega prometida/real, importes) · `pedido_items`
  (nombre y precio congelados al vender) · `pagos` (anticipo/saldo/reembolso) · `gastos` (comprobante en bucket privado) ·
  `categorias_gasto` · `proveedores`.

## Automatismos (todo transaccional)

| Evento | Resultado |
|---|---|
| Cambiar `precio` de un producto | Fila en `precios_historico` con el motivo |
| Publicar producto | Exige precio > 0 e imagen (o foto de combo) |
| Entrada/salida/ajuste de insumo | Recalcula stock y costo promedio; impide stock negativo; avisa si cruza el mínimo |
| `registrar_compra_insumo()` | Crea el **gasto** y la **entrada** de stock a la vez |
| Insertar/editar ítems | Recalcula subtotal y total; solo con pedido `pendiente`; congela nombre y precio |
| Pedido → `en_produccion` | Descuenta insumos (recetas + empaque); si falta stock: bloquea o descuenta lo disponible y avisa (`bloquear_sin_stock`) |
| Pedido → `enviado/entregado` | Descuenta stock de productos no "bajo pedido"; fija `fecha_entrega_real` |
| Pedido nuevo | Notificación a todos los roles (sin datos del cliente) |
| Molde → `recibido` | Fija fecha real y notifica |
| Cualquier cambio sensible | Fila en `auditoria` |

## Vistas y RPC

Públicas (`anon`): `v_catalogo_categorias`, `v_catalogo_productos`, `v_catalogo_combo_items`, `v_catalogo_combo_fotos`, `v_catalogo_config`.
Internas: `v_insumos_estado` (semáforo), `v_moldes_estado` (días y alerta de demora), `v_pedidos_saldo`, `v_gastos_mensual`,
`v_producto_costos` (costo, margen y % por producto), las funciones `pedidos_produccion()` y `pedido_items_produccion()` (sin datos personales).
RPC: `dashboard_resumen()` (cada rol recibe solo lo suyo), `crear_pedido()`, `pedido_cambiar_estado()`,
`registrar_compra_insumo()`, `producto_ajustar_stock()`, `registrar_dispositivo_push()`.

## Decisiones respecto al enunciado original

* `comprobante_url` → **`comprobante_path`**: el bucket es privado, se guarda la ruta y se abre con URL firmada.
* "Lectura pública (anon)" de productos/categorías/fotos/config se cumple con **permisos por columna + RLS de filas
  publicadas**, de modo que `anon` jamás ve stock, costos ni datos internos.
* `pedido_items.producto_id` sirve para productos **y** combos (un combo es un producto con `es_combo`).
* Se añadieron: `proveedores`, `clientes`, `pagos`, `recetas`, `empaque_default`, `cajas_envio`, `auditoria`,
  `notificaciones`, `dispositivos_push` para cubrir costos, saldos, empaque, privacidad y avisos.
