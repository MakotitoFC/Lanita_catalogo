import { z } from 'zod';
import {
  CANALES, CATEGORIAS_INSUMO, ESTADOS_MOLDE, ESTADOS_PEDIDO, METODOS_PAGO, ROLES, ROTACION_INSUMO,
  TIPOS_MOVIMIENTO, TIPOS_PAGO, UNIDADES_MEDIDA,
} from './constantes';

const uuid = z.string().uuid();
const urlHttps = z.string().url().regex(/^https:\/\//, 'Debe ser https');
const dinero = z.coerce.number().min(0).max(9_999_999.99).transform((n) => Math.round(n * 100) / 100);
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato AAAA-MM-DD');
const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const whatsapp = z.string().transform((s) => s.replace(/\D/g, '')).pipe(z.string().regex(/^[0-9]{8,15}$/, 'Incluya código de país'));

export const perfilSchema = z.object({
  id: uuid,
  nombre: z.string().min(2).max(80),
  rol: z.enum(ROLES),
  telefono: z.string().regex(/^\+?[0-9]{7,15}$/).nullish(),
  activo: z.boolean().default(true),
});

export const productoSchema = z.object({
  id: uuid.optional(),
  nombre: z.string().trim().min(2).max(120),
  slug: slug.optional(),
  descripcion_corta: z.string().max(200).nullish(),
  descripcion: z.string().max(4000).nullish(),
  precio: dinero,
  categoria_id: uuid,
  imagen_url: urlHttps.nullish(),
  es_combo: z.boolean().default(false),
  destacado: z.boolean().default(false),
  publicado: z.boolean().default(false),
  disponible: z.boolean().default(true),
  bajo_pedido: z.boolean().default(true),
  stock: z.coerce.number().int().min(0).default(0),
  tiempo_elaboracion_dias: z.coerce.number().int().min(0).max(90).nullish(),
  materiales: z.array(z.string().trim().min(2).max(60)).max(20).default([]),   // materiales usados (lista)
  motivo_cambio_precio: z.string().max(200).nullish(),
});
export type Producto = z.infer<typeof productoSchema>;

export const comboItemSchema = z.object({
  combo_id: uuid,
  producto_id: uuid,
  cantidad: z.coerce.number().int().min(1).max(999).default(1),
});

export const comboFotoSchema = z.object({
  combo_id: uuid,
  imagen_url: urlHttps,
  tematica: z.string().max(60).nullish(),
  alt_text: z.string().max(200).nullish(),
  es_portada: z.boolean().default(false),
  orden: z.coerce.number().int().default(0),
});

export const insumoSchema = z.object({
  id: uuid.optional(),
  nombre: z.string().trim().min(2).max(100),
  categoria: z.enum(CATEGORIAS_INSUMO).default('materia_prima'),
  unidad_medida: z.enum(UNIDADES_MEDIDA),
  color: z.string().max(40).nullish(),
  stock_minimo: z.coerce.number().min(0).default(0),
  alerta_activa: z.boolean().default(true),
  rotacion: z.enum(ROTACION_INSUMO).default('media'),
  costo_unitario: z.coerce.number().min(0).nullish(),
  proveedor_id: uuid.nullish(),
  notas: z.string().max(1000).nullish(),
});
export type Insumo = z.infer<typeof insumoSchema>;

export const movimientoInsumoSchema = z
  .object({
    insumo_id: uuid,
    tipo: z.enum(TIPOS_MOVIMIENTO),
    cantidad: z.coerce.number().refine((n) => n !== 0, 'No puede ser 0'),
    motivo: z.string().trim().min(3).max(200),
    costo_unitario: z.coerce.number().min(0).nullish(),
  })
  .refine((m) => m.tipo === 'ajuste' || m.cantidad > 0, { message: 'Entrada/salida requieren cantidad positiva', path: ['cantidad'] });

export const compraInsumoSchema = z.object({
  insumo_id: uuid,
  cantidad: z.coerce.number().positive(),
  monto_total: z.coerce.number().positive(),
  proveedor_id: uuid.nullish(),
  fecha: fecha.nullish(),
  metodo_pago: z.enum(METODOS_PAGO).default('efectivo'),
  descripcion: z.string().max(300).nullish(),
});

export const gastoSchema = z.object({
  id: uuid.optional(),
  fecha: fecha,
  monto: z.coerce.number().positive().max(9_999_999.99),
  categoria_gasto_id: uuid,
  descripcion: z.string().trim().min(3).max(300),
  metodo_pago: z.enum(METODOS_PAGO).default('efectivo'),
  proveedor_id: uuid.nullish(),
  comprobante_path: z.string().regex(/^[0-9a-f-]{36}\/[A-Za-z0-9._/-]+$/).refine((p) => !p.includes('..')).nullish(),
  insumo_id: uuid.nullish(),
  cantidad: z.number().positive().max(9_999_999).nullish(),   // compra de insumo: cuánto
  unidad: z.string().trim().min(1).max(20).nullish(),
});
export type Gasto = z.infer<typeof gastoSchema>;

export const pedidoItemSchema = z.object({
  producto_id: uuid,
  cantidad: z.coerce.number().int().min(1).max(9999),
  precio_unitario: dinero.optional(),   // si falta, la base usa el precio vigente
  notas: z.string().max(300).nullish(),
});

export const pedidoSchema = z.object({
  id: uuid.optional(),             // el cliente puede generarlo (offline) => upsert idempotente
  cliente_nombre: z.string().trim().min(2).max(100),
  cliente_whatsapp: whatsapp.nullish(),
  direccion_entrega: z.string().max(300).nullish(),
  punto_encuentro: z.string().max(200).nullish(),
  requiere_envio: z.boolean().default(false),
  canal: z.enum(CANALES).default('whatsapp'),
  medio_pago: z.enum(['yape', 'efectivo']).default('efectivo'),
  fecha_entrega: fecha.nullish(),
  tematica: z.string().max(60).nullish(),
  personalizacion: z.string().max(1000).nullish(),
  notas: z.string().max(2000).nullish(),
  notas_produccion: z.string().max(1000).nullish(),
  descuento: dinero.default(0),
  costo_envio: dinero.default(0),
  items: z.array(pedidoItemSchema).min(1, 'Agregue al menos un producto'),
});
export type PedidoInput = z.infer<typeof pedidoSchema>;
export const estadoPedidoSchema = z.enum(ESTADOS_PEDIDO);

export const pagoSchema = z.object({
  pedido_id: uuid,
  tipo: z.enum(TIPOS_PAGO).default('anticipo'),
  monto: z.coerce.number().positive(),
  metodo_pago: z.enum(METODOS_PAGO).default('efectivo'),
  referencia: z.string().max(100).nullish(),
});

export const moldeSchema = z
  .object({
    id: uuid.optional(),
    nombre: z.string().trim().min(2).max(120),
    descripcion: z.string().max(1000).nullish(),
    proveedor_id: uuid.nullish(),
    numero_pedido_externo: z.string().max(60).nullish(),
    numero_seguimiento: z.string().max(80).nullish(),
    url_pedido: urlHttps.nullish(),
    fecha_pedido: fecha,
    fecha_estimada_llegada: fecha.nullish(),
    estado: z.enum(ESTADOS_MOLDE).default('pedido'),
    costo: z.coerce.number().min(0).nullish(),
    cantidad: z.coerce.number().int().min(1).default(1),
    notas: z.string().max(1000).nullish(),
  })
  .refine((m) => !m.fecha_estimada_llegada || m.fecha_estimada_llegada >= m.fecha_pedido, {
    message: 'La llegada estimada no puede ser anterior al pedido',
    path: ['fecha_estimada_llegada'],
  });

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});
