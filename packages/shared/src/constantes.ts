import tema from './tema.json';

export const TEMA = tema;

export const ROLES = ['admin'] as const; // un solo rol: el dueño administra todo (ver migración 0014)
export const UNIDADES_MEDIDA = ['kg', 'g', 'l', 'ml', 'unidad', 'plancha', 'pliego', 'metro'] as const;
export const CATEGORIAS_INSUMO = ['materia_prima', 'pintura', 'acabado', 'empaque', 'herramienta', 'marca', 'otro'] as const;
export const ROTACION_INSUMO = ['alta', 'media', 'baja'] as const;
export const TIPOS_MOVIMIENTO = ['entrada', 'salida', 'ajuste'] as const;
export const ESTADOS_PEDIDO = ['pendiente', 'pagado', 'cancelado'] as const;
export const ESTADOS_MOLDE = ['pedido', 'en_transito', 'recibido', 'cancelado'] as const;
export const CANALES = ['whatsapp', 'instagram', 'tiktok', 'facebook', 'presencial'] as const;
export const METODOS_PAGO = ['efectivo', 'yape', 'plin', 'transferencia', 'tarjeta', 'otro'] as const;
export const TIPOS_PAGO = ['anticipo', 'saldo', 'reembolso'] as const;
export const SEMAFOROS = ['verde', 'amarillo', 'rojo', 'sin_alerta'] as const;

export const CATEGORIAS_BASE = ['Porta velas', 'Macetas', 'Bandejas', 'Combos', 'Decoración'] as const;
export const CATEGORIAS_GASTO_BASE = ['Materia prima', 'Empaque', 'Moldes', 'Herramientas', 'Envío', 'Publicidad', 'Otros'] as const;

export const ETIQUETA_ESTADO_PEDIDO: Record<(typeof ESTADOS_PEDIDO)[number], string> = {
  pendiente: 'Pendiente',
  pagado: 'Pagado',
  cancelado: 'Cancelado',
};

export const ETIQUETA_ESTADO_MOLDE: Record<(typeof ESTADOS_MOLDE)[number], string> = {
  pedido: 'Pedido',
  en_transito: 'En tránsito',
  recibido: 'Recibido',
  cancelado: 'Cancelado',
};

/** Siguiente estado "natural" de cada pedido (el servidor valida permisos por rol). */

/** Empaque por defecto del negocio (se persiste en la tabla empaque_default). */
export const EMPAQUE_DEFAULT = { papelSedaPliegosPorProducto: 2, gomaEvaPlanchaPorProducto: 0.5 } as const;
