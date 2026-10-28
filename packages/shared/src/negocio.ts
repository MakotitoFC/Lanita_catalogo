/** Reglas de negocio PURAS (sin I/O, sin React). */

export type LineaReceta = { insumo_id: string; cantidad: number };
export type PreciosInsumos = Record<string, number | null | undefined>;

/** Costo de materiales de UNA unidad de producto. */
export function calcularCostoProducto(
  _producto: { id?: string; nombre?: string },
  receta: LineaReceta[],
  preciosInsumos: PreciosInsumos,
): { costo: number; insumosSinPrecio: string[] } {
  let costo = 0;
  const insumosSinPrecio: string[] = [];
  for (const { insumo_id, cantidad } of receta) {
    const precio = preciosInsumos[insumo_id];
    if (precio == null) insumosSinPrecio.push(insumo_id);
    else costo += cantidad * precio;
  }
  return { costo: redondear(costo), insumosSinPrecio };
}

export function calcularMargen(precio: number, costo: number): { margen: number; porcentaje: number | null } {
  const margen = redondear(precio - costo);
  return { margen, porcentaje: precio > 0 ? redondear((margen / precio) * 100, 1) : null };
}

export type Requerimiento = { insumo_id: string; cantidad: number };
export type InsumoStock = { id: string; nombre?: string; stock_actual: number };

/** Total de insumos requeridos por un conjunto de ítems (recetas + empaque). */
export function calcularRequerimientos(
  items: { producto_id: string; cantidad: number }[],
  recetas: Record<string, LineaReceta[]>,
  empaque: { insumo_id: string; cantidad: number; aplica_por: 'producto' | 'pedido' }[] = [],
): Requerimiento[] {
  const acc = new Map<string, number>();
  const sumar = (id: string, c: number) => acc.set(id, (acc.get(id) ?? 0) + c);
  const unidades = items.reduce((s, i) => s + i.cantidad, 0);
  for (const it of items) for (const l of recetas[it.producto_id] ?? []) sumar(l.insumo_id, l.cantidad * it.cantidad);
  for (const e of empaque) sumar(e.insumo_id, e.aplica_por === 'producto' ? e.cantidad * unidades : e.cantidad);
  return [...acc].map(([insumo_id, cantidad]) => ({ insumo_id, cantidad: redondear(cantidad, 4) }));
}

export function validarStockSuficiente(
  requeridos: Requerimiento[],
  insumos: InsumoStock[],
): { ok: boolean; faltantes: { insumo_id: string; nombre?: string; requerido: number; disponible: number }[] } {
  const porId = new Map(insumos.map((i) => [i.id, i]));
  const faltantes = requeridos
    .map((r) => {
      const ins = porId.get(r.insumo_id);
      return { insumo_id: r.insumo_id, nombre: ins?.nombre, requerido: r.cantidad, disponible: ins?.stock_actual ?? 0 };
    })
    .filter((f) => f.requerido > f.disponible);
  return { ok: faltantes.length === 0, faltantes };
}

export type SemaforoStock = 'verde' | 'amarillo' | 'rojo' | 'sin_alerta';
export function semaforoInsumo(i: { stock_actual: number; stock_minimo: number; alerta_activa: boolean }): SemaforoStock {
  if (!i.alerta_activa || i.stock_minimo === 0) return 'sin_alerta';
  if (i.stock_actual <= i.stock_minimo) return 'rojo';
  if (i.stock_actual <= i.stock_minimo * 1.5) return 'amarillo';
  return 'verde';
}

// ---------------------------------------------------------------- WhatsApp
// Nota: WhatsApp solo admite TEXTO por enlace (wa.me). Para dar formato usa *negrita* y emojis Unicode;
// los iconos Lucide se usan en la interfaz (web y APK), no dentro del mensaje.
export type ConfigWhatsApp = {
  whatsapp_numero: string;
  nombre_negocio?: string;
  moneda_simbolo?: string;
  mensaje_whatsapp_default?: string;
  plantilla_resumen_pedido?: string | null;
  /** Datos de cobro (solo los conoce el administrador; se incluyen al enviar el pedido al cliente). */
  yape_numero?: string | null;
  yape_titular?: string | null;
};

export type EntidadWhatsApp =
  | { tipo: 'producto' | 'combo'; nombre: string; precio?: number; url?: string }
  // Consulta armada por el visitante en la web: se envía completa en un solo mensaje al negocio.
  | { tipo: 'lista'; items: { nombre: string; cantidad: number; precio?: number; url?: string }[]; nota?: string; cliente?: string; fecha?: string }
  | {
      tipo: 'pedido';
      numero: number | string;
      cliente_nombre: string;
      cliente_whatsapp?: string | null;
      items: { nombre: string; cantidad: number; precio_unitario: number }[];
      descuento?: number;
      costo_envio?: number;
      total: number;
      fecha_entrega?: string | null;
      punto_encuentro?: string | null;
      anticipo?: number | null;
      saldo?: number;
    };

export function normalizarNumero(n: string): string {
  return n.replace(/\D/g, '');
}

/** 987654321 -> "987 654 321" */
export function formatearCelular(n: string): string {
  const d = normalizarNumero(n).slice(-9);
  return d.length === 9 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : n;
}

/**
 * - producto/combo/lista: consulta DEL cliente HACIA el negocio (config.whatsapp_numero).
 * - pedido: resumen y datos de pago DEL negocio HACIA el cliente (cliente_whatsapp).
 * Devuelve el texto y el enlace wa.me (sin API de WhatsApp Business).
 */
export function generarMensajeWhatsApp(entidad: EntidadWhatsApp, config: ConfigWhatsApp): { texto: string; url: string | null } {
  const s = config.moneda_simbolo ?? 'S/';
  const money = (n: number) => `${s}${n.toFixed(2)}`;
  const negocio = config.nombre_negocio ?? 'Lanita';
  let texto: string;
  let destino: string;

  if (entidad.tipo === 'pedido') {
    const primerNombre = entidad.cliente_nombre.split(' ')[0] ?? entidad.cliente_nombre;
    const intro = (config.plantilla_resumen_pedido ?? 'Hola *{cliente}* 👋 Este es el resumen de tu pedido:')
      .replace('{cliente}', primerNombre)
      .replace('{numero}', String(entidad.numero));
    const yape = config.yape_numero ? normalizarNumero(config.yape_numero) : '';
    const bloquePago = yape
      ? [
          '',
          '📲 *Pago por Yape*',
          `Yapea a *${formatearCelular(yape)}*${config.yape_titular ? ` a nombre de *${config.yape_titular}*` : ''}.`,
          ...(entidad.anticipo ? [`Anticipo para reservar: *${money(entidad.anticipo)}*`] : []),
          'Cuando pagues, envíame la captura del comprobante por aquí 🙌',
        ]
      : [];
    texto = [
      `✅ *Pedido #${entidad.numero} — ${negocio}*`,
      intro,
      '',
      ...entidad.items.map((i) => `📌 ${i.cantidad} × ${i.nombre} — ${money(i.cantidad * i.precio_unitario)}`),
      ...(entidad.descuento ? [`🏷️ Descuento: -${money(entidad.descuento)}`] : []),
      ...(entidad.costo_envio ? [`🚚 Envío: ${money(entidad.costo_envio)}`] : []),
      `💰 *Total: ${money(entidad.total)}*`,
      ...(entidad.saldo != null && entidad.saldo !== entidad.total ? [`🧾 Saldo pendiente: ${money(entidad.saldo)}`] : []),
      ...bloquePago,
      ...(entidad.punto_encuentro ? ['', `📍 *Punto de encuentro:* ${entidad.punto_encuentro}`] : []),
      ...(entidad.fecha_entrega ? [`📅 *Fecha de entrega:* ${entidad.fecha_entrega}`] : []),
      '',
      '¡Gracias por tu compra! 💜',
    ].join('\n');
    destino = normalizarNumero(entidad.cliente_whatsapp ?? '');
  } else if (entidad.tipo === 'lista') {
    const conPrecio = entidad.items.length > 0 && entidad.items.every((i) => i.precio != null);
    const total = entidad.items.reduce((acc, i) => acc + (i.precio ?? 0) * i.cantidad, 0);
    const linea = '--------------------------------';
    const monto = (n: number) => `${s} ${n.toFixed(2)}`;
    texto = [
      `🚀 *NUEVO PEDIDO — ${negocio}* 🚀`,
      linea,
      ...(entidad.fecha ? [`📅 ${entidad.fecha}`, ''] : []),
      '👤 *CLIENTE*',
      `*Nombre:* ${entidad.cliente ?? 'No indicado'}`,
      '',
      ...(entidad.items.length > 0
        ? [
            '🛒 *DETALLE*',
            linea,
            ...entidad.items.flatMap((i) => [
              `🔸 *${i.cantidad}x ${i.nombre}*`,
              ...(i.url ? [`   └ 🔗 ${i.url}`] : []),
              ...(i.precio != null ? [`   💵 ${monto(i.precio * i.cantidad)}`] : []),
              '',
            ]),
            linea,
          ]
        : []),
      ...(conPrecio ? ['💵 *IMPORTE*', '', `🔥 *TOTAL ESTIMADO: ${monto(total)}* 🔥`, linea] : []),
      ...(entidad.nota ? ['💬 *NOTA*', entidad.nota, linea] : []),
      '💳 Pago: por coordinar contigo',
      '🙌 ¡Quedo atenta a tu confirmación de disponibilidad!',
    ].join('\n');
    destino = normalizarNumero(config.whatsapp_numero);
  } else {
    texto = [
      `🛍️ *${config.mensaje_whatsapp_default ?? 'Consulta de producto'}*`,
      `📌 *${entidad.tipo === 'combo' ? 'Combo' : 'Producto'}:* ${entidad.nombre}`,
      ...(entidad.precio != null ? [`💰 Precio: ${money(entidad.precio)}`] : []),
      ...(entidad.url ? [`🔗 ${entidad.url}`] : []),
    ].join('\n');
    destino = normalizarNumero(config.whatsapp_numero);
  }
  const url = destino ? `https://wa.me/${destino}?text=${encodeURIComponent(texto)}` : null;
  return { texto, url };
}

function redondear(n: number, dec = 2): number {
  const f = 10 ** dec;
  return Math.round(n * f) / f;
}
