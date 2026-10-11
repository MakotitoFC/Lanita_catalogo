import { useState } from 'react';
import { Alert, Image, Pressable, Text, TextInput, View } from 'react-native';
import { Minus, Pencil, Plus, X } from 'lucide-react-native';
import { pedidoSchema, TEMA } from '@lanita/shared';
import { supabase, mensajeError, type Fila } from '@/lib/supabase';
import { encolarPedido, esErrorDeRed } from '@/lib/cola';
import { money, revalidarWeb, uuidv4 } from '@/lib/utils';
import { Boton, Campo, ErrorMsg, Nota, Subtitulo } from '@/ui';
import { Foto } from '@/ui/esqueleto';
import { SelectorFecha } from '@/ui/fecha';

type Tipo = 'catalogo' | 'personalizado';
const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * Contenido del modal "Nuevo pedido". Los productos se eligen en la pantalla Pedidos (lista con fotos);
 * aquí se ven en un resumen (se pueden ajustar) y se completan los datos del cliente y el pago.
 */
export function NuevoPedido({ productos, cant, setCant, defectoPunto, onListo }: {
  productos: Fila[]; cant: Record<string, number>; setCant: (fn: (c: Record<string, number>) => Record<string, number>) => void;
  defectoPunto?: string | null; onListo: () => void;
}) {
  const [tipo, setTipo] = useState<Tipo>('catalogo');
  const [form, setForm] = useState({ cliente_nombre: '', fecha_entrega: '', punto_encuentro: defectoPunto ?? '', tematica: '', personalizacion: '', notas_produccion: '' });
  const [telefono, setTelefono] = useState('');
  const [medio, setMedio] = useState<'yape' | 'efectivo'>('yape');
  const [descTipo, setDescTipo] = useState<'monto' | 'porcentaje'>('monto');
  const [descValor, setDescValor] = useState('');
  const [editandoDesc, setEditandoDesc] = useState(false);
  const [previo, setPrevio] = useState<{ t: 'monto' | 'porcentaje'; v: string }>({ t: 'monto', v: '' });
  const [envio, setEnvio] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const elegidos = productos.filter((p) => (cant[p.id] ?? 0) > 0);
  const subtotal = redondear(elegidos.reduce((s, p) => s + Number(p.precio) * cant[p.id]!, 0));
  const descBruto = descTipo === 'porcentaje' ? subtotal * (Math.min(100, Number(descValor) || 0) / 100) : Number(descValor) || 0;
  const descuento = redondear(Math.min(subtotal, Math.max(0, descBruto)));
  const costoEnvio = Math.max(0, Number(envio) || 0);
  const total = redondear(subtotal - descuento + costoEnvio);

  const cambiar = (p: Fila, d: number) => setCant((c) => ({ ...c, [p.id]: Math.max(0, Math.min(p.bajo_pedido ? 999 : p.stock, (c[p.id] ?? 0) + d)) }));

  async function guardar() {
    const digitos = telefono.replace(/\D/g, '');
    if (elegidos.length === 0) return setError('Elige al menos un producto en la lista.');
    if (tipo === 'personalizado' && form.personalizacion.trim().length < 3) return setError('Describe el pedido personalizado.');
    const parsed = pedidoSchema.safeParse({
      id: uuidv4(),
      cliente_nombre: form.cliente_nombre,
      cliente_whatsapp: digitos ? `51${digitos}` : null,   // Perú por defecto
      fecha_entrega: form.fecha_entrega || null,
      punto_encuentro: tipo === 'personalizado' ? form.punto_encuentro || null : null,
      tematica: tipo === 'personalizado' ? form.tematica || null : null,
      personalizacion: tipo === 'personalizado' ? form.personalizacion : null,
      notas_produccion: tipo === 'personalizado' ? form.notas_produccion || null : null,
      medio_pago: medio, descuento, costo_envio: costoEnvio,
      items: elegidos.map((p) => ({ producto_id: p.id as string, cantidad: cant[p.id]! })),
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Revisa los datos');
    setEnviando(true); setError(null);
    const { error: e } = await supabase.rpc('crear_pedido', { p: parsed.data });
    setEnviando(false);
    if (!e) { revalidarWeb(); return onListo(); }
    if (esErrorDeRed(e)) {
      await encolarPedido(parsed.data);
      Alert.alert('Guardado sin conexión', 'El pedido se enviará solo cuando vuelva internet.');
      return onListo();
    }
    setError(mensajeError(e));
  }

  return (
    <>
      {/* 1. Productos elegidos */}
      <View className="flex-row items-center justify-between">
        <Subtitulo>Productos del pedido</Subtitulo>
        {elegidos.length > 0 && (
          <Pressable onPress={() => setCant(() => ({}))} accessibilityRole="button" accessibilityLabel="Limpiar todos los productos" hitSlop={8} className="min-h-[36px] flex-row items-center gap-1 rounded-xl px-2">
            <X size={16} color={TEMA.lana['500']} /><Text className="text-sm font-semibold text-lana-800">Limpiar todo</Text>
          </Pressable>
        )}
      </View>
      {elegidos.length === 0 ? (
        <Nota>Todavía no elegiste productos. Cierra esta ventana y toca “+” en los productos de la lista.</Nota>
      ) : (
        <View className="overflow-hidden rounded-2xl border border-neutral-300 bg-white">
          {elegidos.map((p, i) => (
            <View key={p.id} className={`flex-row items-center gap-3 px-3 py-2 ${i > 0 ? 'border-t border-neutral-200' : ''}`}>
              {p.imagen_url ? <Foto uri={p.imagen_url} className="h-12 w-12 rounded-xl bg-[#f2f2f2]" /> : <View className="h-12 w-12 rounded-xl bg-[#f2f2f2]" />}
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="text-sm font-semibold text-lana-900">{p.nombre}</Text>
                <Text className="text-sm text-[#74784a]">{money(Number(p.precio) * cant[p.id]!)}</Text>
              </View>
              <Pressable onPress={() => cambiar(p, -1)} accessibilityLabel={`Quitar ${p.nombre}`} className="h-10 w-10 items-center justify-center rounded-xl border border-neutral-300"><Minus size={16} color={TEMA.lana['800']} /></Pressable>
              <Text className="w-6 text-center text-base font-bold text-lana-900">{cant[p.id]}</Text>
              <Pressable onPress={() => cambiar(p, 1)} accessibilityLabel={`Agregar ${p.nombre}`} className="h-10 w-10 items-center justify-center rounded-xl bg-lana-700"><Plus size={16} color="#fff" /></Pressable>
              <Pressable onPress={() => setCant((c) => ({ ...c, [p.id]: 0 }))} hitSlop={6} accessibilityLabel={`Quitar ${p.nombre} del pedido`} className="h-8 w-8 items-center justify-center"><X size={18} color={TEMA.lana['500']} /></Pressable>
            </View>
          ))}
        </View>
      )}

      {/* 2. Tipo de pedido */}
      <Subtitulo>¿Qué pide el cliente?</Subtitulo>
      <View className="flex-row gap-2">
        {([['catalogo', 'De catálogo'], ['personalizado', 'Personalizado']] as const).map(([id, texto]) => (
          <Pressable key={id} onPress={() => setTipo(id)} accessibilityRole="button" className={`min-h-[48px] flex-1 items-center justify-center rounded-xl border px-3 ${tipo === id ? 'border-lana-700 bg-lana-700' : 'border-neutral-300 bg-white'}`}>
            <Text className={`text-base font-semibold ${tipo === id ? 'text-white' : 'text-lana-800'}`}>{texto}</Text>
          </Pressable>
        ))}
      </View>

      {/* 3. Cliente */}
      <Campo etiqueta="Cliente *" value={form.cliente_nombre} onChangeText={set('cliente_nombre')} />
      <View className="gap-1">
        <Text className="text-sm font-medium text-lana-800">Número</Text>
        <View className="min-h-[52px] flex-row items-center rounded-xl border border-neutral-300 bg-white px-4">
          <Text className="pr-2 text-lg text-lana-800">+51</Text>
          <View className="h-6 w-px bg-neutral-300" />
          <TextInput value={telefono} onChangeText={(v) => setTelefono(v.replace(/\D/g, '').slice(0, 9))} keyboardType="phone-pad" placeholder="999 999 999" placeholderTextColor={TEMA.lana['400']}
                     accessibilityLabel="Número" style={{ fontFamily: 'Poppins_400Regular' }} className="flex-1 pl-3 text-lg text-lana-900" />
        </View>
      </View>
      <SelectorFecha etiqueta="Fecha de entrega" valor={form.fecha_entrega} onChange={set('fecha_entrega')} limite="futuro" />

      {tipo === 'personalizado' && (
        <>
          <Campo etiqueta="Temática" value={form.tematica} onChangeText={set('tematica')} placeholder="baby shower, boda…" />
          <Campo etiqueta="¿Qué personalización quiere? *" value={form.personalizacion} onChangeText={set('personalizacion')} multiline placeholder="Colores, nombres, tamaño…" />
          <Campo etiqueta="Punto de encuentro" value={form.punto_encuentro} onChangeText={set('punto_encuentro')} placeholder="Ej.: Plaza de Armas" />
          <Campo etiqueta="Notas para producción" value={form.notas_produccion} onChangeText={set('notas_produccion')} multiline />
        </>
      )}

      {/* 4. Dinero */}
      <View className="rounded-2xl border border-neutral-300 bg-white p-4">
        <View className="flex-row items-center justify-between py-2">
          <Text className="text-base text-lana-800">Subtotal</Text>
          <Text className="text-base font-semibold text-lana-900">{money(subtotal)}</Text>
        </View>
        <View className="flex-row items-center justify-between py-2">
          <Text className="text-base text-lana-800">Descuento{descTipo === 'porcentaje' && descValor ? ` (${Number(descValor) || 0}%)` : ''}</Text>
          <View className="flex-row items-center gap-2">
            <Text className="text-base font-semibold text-lana-900">− {money(descuento)}</Text>
            <Pressable onPress={() => { if (!editandoDesc) setPrevio({ t: descTipo, v: descValor }); setEditandoDesc((v) => !v); }} accessibilityRole="button" accessibilityLabel="Editar descuento" className="h-10 w-10 items-center justify-center rounded-xl bg-lana-200">
              <Pencil size={16} color={TEMA.lana['800']} />
            </Pressable>
          </View>
        </View>
        {editandoDesc && (
          <View className="mb-2 gap-2 rounded-2xl border border-neutral-200 p-3">
            <Text className="text-sm font-medium text-lana-800">Tipo de descuento</Text>
            <View className="flex-row gap-2">
              {([['monto', 'Monto (S/)'], ['porcentaje', 'Porcentaje (%)']] as const).map(([id, texto]) => (
                <Pressable key={id} onPress={() => setDescTipo(id)} className={`min-h-[44px] flex-1 items-center justify-center rounded-xl border ${descTipo === id ? 'border-lana-700 bg-lana-700' : 'border-neutral-300'}`}>
                  <Text className={`text-sm font-semibold ${descTipo === id ? 'text-white' : 'text-lana-800'}`}>{texto}</Text>
                </Pressable>
              ))}
            </View>
            <Campo etiqueta={descTipo === 'monto' ? 'Monto a descontar' : 'Porcentaje a descontar'} value={descValor} onChangeText={setDescValor} keyboardType="decimal-pad" placeholder="0" />
            <View className="flex-row gap-2">
              <Pressable onPress={() => { setDescTipo(previo.t); setDescValor(previo.v); setEditandoDesc(false); }} accessibilityRole="button" className="min-h-[40px] flex-1 items-center justify-center rounded-xl border border-lana-700">
                <Text className="text-sm font-semibold text-lana-700">Cancelar</Text>
              </Pressable>
              <Pressable onPress={() => setEditandoDesc(false)} accessibilityRole="button" className="min-h-[40px] flex-1 items-center justify-center rounded-xl bg-lana-700">
                <Text className="text-sm font-semibold text-white">Listo</Text>
              </Pressable>
            </View>
          </View>
        )}
        <View className="flex-row items-center justify-between py-2">
          <Text className="text-base text-lana-800">Envío</Text>
          <TextInput value={envio} onChangeText={setEnvio} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={TEMA.lana['400']} accessibilityLabel="Costo de envío"
                     className="min-h-[44px] w-28 rounded-xl border border-neutral-300 bg-white px-4 text-right text-base text-lana-900" />
        </View>
        <View className="py-2">
          <Text className="mb-2 text-base text-lana-800">Medio de pago</Text>
          <View className="flex-row gap-2">
            {([['yape', 'Yape'], ['efectivo', 'Efectivo']] as const).map(([id, texto]) => (
              <Pressable key={id} onPress={() => setMedio(id)} accessibilityRole="button" className={`min-h-[44px] flex-1 items-center justify-center rounded-xl border ${medio === id ? 'border-lana-700 bg-lana-700' : 'border-neutral-300'}`}>
                <Text className={`text-base font-semibold ${medio === id ? 'text-white' : 'text-lana-800'}`}>{texto}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View className="mt-2 flex-row items-center justify-between border-t border-neutral-300 pt-3">
          <Text className="text-lg font-bold text-lana-900">Total</Text>
          <Text className="text-xl font-bold text-[#74784a]">{money(total)}</Text>
        </View>
      </View>

      <ErrorMsg texto={error} />
      <Boton titulo="Guardar pedido" onPress={guardar} cargando={enviando} />
    </>
  );
}
