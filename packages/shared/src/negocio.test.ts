import { describe, expect, it } from 'vitest';
import {
  calcularCostoProducto, calcularMargen, calcularRequerimientos, generarMensajeWhatsApp,
  semaforoInsumo, validarStockSuficiente,
} from './negocio';
import { pedidoSchema, productoSchema } from './esquemas';
import { crearClienteSupabase } from './cliente';

describe('costos y margen', () => {
  it('suma receta y reporta insumos sin precio', () => {
    const r = calcularCostoProducto({}, [{ insumo_id: 'a', cantidad: 2 }, { insumo_id: 'b', cantidad: 1 }], { a: 1.5, b: null });
    expect(r).toEqual({ costo: 3, insumosSinPrecio: ['b'] });
  });
  it('margen', () => {
    expect(calcularMargen(20, 5)).toEqual({ margen: 15, porcentaje: 75 });
    expect(calcularMargen(0, 5).porcentaje).toBeNull();
  });
});

describe('stock', () => {
  it('requerimientos incluyen empaque por producto y por pedido', () => {
    const req = calcularRequerimientos(
      [{ producto_id: 'p', cantidad: 3 }],
      { p: [{ insumo_id: 'cemento', cantidad: 2 }] },
      [
        { insumo_id: 'seda', cantidad: 2, aplica_por: 'producto' },
        { insumo_id: 'caja', cantidad: 1, aplica_por: 'pedido' },
      ],
    );
    expect(Object.fromEntries(req.map((r) => [r.insumo_id, r.cantidad]))).toEqual({ cemento: 6, seda: 6, caja: 1 });
  });
  it('detecta faltantes', () => {
    const r = validarStockSuficiente([{ insumo_id: 'a', cantidad: 5 }], [{ id: 'a', nombre: 'Cemento', stock_actual: 2 }]);
    expect(r.ok).toBe(false);
    expect(r.faltantes[0]).toMatchObject({ nombre: 'Cemento', requerido: 5, disponible: 2 });
  });
  it('semáforo: pinceles sin alerta', () => {
    expect(semaforoInsumo({ stock_actual: 0, stock_minimo: 0, alerta_activa: false })).toBe('sin_alerta');
    expect(semaforoInsumo({ stock_actual: 4, stock_minimo: 5, alerta_activa: true })).toBe('rojo');
    expect(semaforoInsumo({ stock_actual: 7, stock_minimo: 5, alerta_activa: true })).toBe('amarillo');
    expect(semaforoInsumo({ stock_actual: 20, stock_minimo: 5, alerta_activa: true })).toBe('verde');
  });
});

describe('whatsapp', () => {
  const cfg = { whatsapp_numero: '+51 999 888 777', moneda_simbolo: 'S/' };
  it('consulta de producto va al negocio', () => {
    const { url, texto } = generarMensajeWhatsApp({ tipo: 'producto', nombre: 'Maceta luna', precio: 25 }, cfg);
    expect(url).toMatch(/^https:\/\/wa\.me\/51999888777\?text=/);
    expect(texto).toContain('Maceta luna');
  });
  it('resumen de pedido va al cliente', () => {
    const { url, texto } = generarMensajeWhatsApp(
      { tipo: 'pedido', numero: 7, cliente_nombre: 'María Pérez', cliente_whatsapp: '51 911 222 333',
        items: [{ nombre: 'Porta vela', cantidad: 2, precio_unitario: 10 }], total: 20 },
      cfg,
    );
    expect(url).toContain('wa.me/51911222333');
    expect(texto).toContain('#7');
    expect(texto).toContain('*Total: S/20.00*');
  });
  it('lista de productos: negritas, emojis, enlaces y total', () => {
    const { url, texto } = generarMensajeWhatsApp(
      { tipo: 'lista', cliente: 'Ana', items: [
        { nombre: 'Maceta luna', cantidad: 2, precio: 25, url: 'https://x.com/catalogo/maceta-luna' },
        { nombre: 'Combo baby shower', cantidad: 1, precio: 80 },
      ] },
      cfg,
    );
    expect(url).toMatch(/^https:\/\/wa\.me\/51999888777\?text=/);
    expect(texto).toContain('🛍️ *Consulta de productos*');
    expect(texto).toContain('Hola, soy *Ana*');
    expect(texto).toContain('📌 *2 × Maceta luna* · S/25.00 c/u');
    expect(texto).toContain('🔗 https://x.com/catalogo/maceta-luna');
    expect(texto).toContain('💰 *Total estimado: S/130.00*');
  });
  it('pedido para el cliente incluye Yape, titular y punto de encuentro', () => {
    const { texto, url } = generarMensajeWhatsApp(
      { tipo: 'pedido', numero: 25, cliente_nombre: 'María Pérez', cliente_whatsapp: '51 911 222 333',
        items: [{ nombre: 'Ángel', cantidad: 2, precio_unitario: 15 }], total: 30, anticipo: 15,
        punto_encuentro: 'Plaza de Armas, Trujillo', fecha_entrega: '2026-11-20' },
      { ...cfg, yape_numero: '987654321', yape_titular: 'Maria C.' },
    );
    expect(url).toContain('wa.me/51911222333');
    expect(texto).toContain('✅ *Pedido #25');
    expect(texto).toContain('Yapea a *987 654 321* a nombre de *Maria C.*');
    expect(texto).toContain('Anticipo para reservar: *S/15.00*');
    expect(texto).toContain('📍 *Punto de encuentro:* Plaza de Armas, Trujillo');
    expect(texto).toContain('📅 *Fecha de entrega:* 2026-11-20');
  });
  it('sin Yape configurado no inventa datos de pago', () => {
    const { texto } = generarMensajeWhatsApp(
      { tipo: 'pedido', numero: 1, cliente_nombre: 'Ana', cliente_whatsapp: '51900000000', items: [{ nombre: 'X', cantidad: 1, precio_unitario: 5 }], total: 5 }, cfg);
    expect(texto).not.toContain('Yape');
  });
  it('sin número devuelve url null', () => {
    expect(generarMensajeWhatsApp({ tipo: 'combo', nombre: 'X' }, { whatsapp_numero: '' }).url).toBeNull();
  });
});

describe('esquemas y seguridad', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  it('producto rechaza imagen http', () => {
    expect(productoSchema.safeParse({ nombre: 'Vela', precio: 5, categoria_id: id, imagen_url: 'http://x.com/a.jpg' }).success).toBe(false);
  });
  it('pedido normaliza whatsapp y exige items', () => {
    const ok = pedidoSchema.parse({ cliente_nombre: 'Ana', cliente_whatsapp: '+51 999 111 222', items: [{ producto_id: id, cantidad: 1 }] });
    expect(ok.cliente_whatsapp).toBe('51999111222');
    expect(pedidoSchema.safeParse({ cliente_nombre: 'Ana', items: [] }).success).toBe(false);
  });
  it('el cliente rechaza una service_role key', () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const fake = `${b64({ alg: 'HS256' })}.${b64({ role: 'service_role' })}.sig`;
    expect(() => crearClienteSupabase({ url: 'https://x.supabase.co', anonKey: fake })).toThrow(/service_role/);
  });
});
