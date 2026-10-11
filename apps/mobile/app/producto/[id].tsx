import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, Plus, X } from 'lucide-react-native';
import { productoSchema, TEMA } from '@lanita/shared';
import { supabase, mensajeError, type Fila } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { money, revalidarWeb, subirImagen, tomarFoto, uuidv4 } from '@/lib/utils';
import { Boton, Campo, Chips, ErrorMsg, Fila as FilaUI, Interruptor, Nota, Subtitulo, Tarjeta, Texto, useDatos } from '@/ui';
import { Foto } from '@/ui/esqueleto';
import { HojaRuta } from '@/ui/hoja';
import { Selector } from '@/ui/selector';

type Foto = { id?: string; url: string; path: string | null };
const VACIO = { nombre: '', precio: '', descripcion: '', categoria_id: '', stock: '0', es_combo: false, destacado: false, publicado: true, disponible: true, bajo_pedido: true, motivo_cambio_precio: '' };

export default function ProductoForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const nuevo = id === 'nuevo';
  const router = useRouter();
  const { esAdmin } = useAuth();
  const [f, setF] = useState<typeof VACIO>(VACIO);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [materiales, setMateriales] = useState<string[]>([]);
  const [material, setMaterial] = useState('');
  const [precioOriginal, setPrecioOriginal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const set = <K extends keyof typeof VACIO>(k: K) => (v: (typeof VACIO)[K]) => setF((x) => ({ ...x, [k]: v }));

  const { data, recargar } = useDatos<Fila>(async () => {
    const [cats, prods] = await Promise.all([
      supabase.from('categorias').select('id, nombre').is('eliminado_en', null).order('orden'),
      supabase.from('productos').select('id, nombre, es_combo').is('eliminado_en', null).eq('es_combo', false).order('nombre'),
    ]);
    let producto: Fila | null = null, items: Fila[] = [], fotosDb: Fila[] = [], historial: Fila[] = [];
    if (!nuevo) {
      const [p, ci, pf, h] = await Promise.all([
        supabase.from('productos').select('*').eq('id', id).single(),
        supabase.from('combo_items').select('id, producto_id, cantidad').eq('combo_id', id),
        supabase.from('producto_fotos').select('id, imagen_url, imagen_path, orden').eq('producto_id', id).order('orden'),
        esAdmin ? supabase.from('precios_historico').select('precio_anterior, precio_nuevo, motivo, fecha').eq('producto_id', id).order('fecha', { ascending: false }).limit(10) : Promise.resolve({ data: [] as Fila[] }),
      ]);
      if (p.error) throw p.error;
      producto = p.data; items = ci.data ?? []; fotosDb = pf.data ?? []; historial = h.data ?? [];
    }
    return { cats: cats.data ?? [], prods: prods.data ?? [], producto, items, fotosDb, historial };
  });

  useEffect(() => {
    const p = data?.producto;
    if (p) {
      setF({ ...VACIO, ...p, precio: String(p.precio), stock: String(p.stock), descripcion: p.descripcion ?? p.descripcion_corta ?? '', motivo_cambio_precio: '' });
      setPrecioOriginal(Number(p.precio));
      setMateriales(p.materiales ?? []);
      const lista: Foto[] = (data!.fotosDb ?? []).map((x: Fila) => ({ id: x.id, url: x.imagen_url, path: x.imagen_path }));
      // Producto antiguo con una sola foto (sin filas en la galería): se muestra como primera foto.
      setFotos(lista.length === 0 && p.imagen_url ? [{ url: p.imagen_url, path: null }] : lista);
    } else if (data && nuevo && !f.categoria_id) {
      setF((x) => ({ ...x, categoria_id: data.cats[0]?.id ?? '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const estado = f.disponible ? 'disponible' : 'agotado';
  const precioCambio = !nuevo && precioOriginal != null && Number(f.precio) !== precioOriginal;

  /** La primera foto es la portada: se guarda también en productos.imagen_url (lo que ve la web en la tarjeta). */
  async function sincronizarPortada(lista: Foto[]) {
    if (nuevo) return;
    await supabase.from('productos').update({ imagen_url: lista[0]?.url ?? null }).eq('id', id);
  }

  async function agregarFoto(origen: 'camara' | 'galeria') {
    setError(null);
    const r = await tomarFoto(origen);
    if (!r) return;
    try {
      const { url, path } = await subirImagen('productos', `${uuidv4()}.jpg`, r.base64);
      let fila: Foto = { url: url!, path };
      if (!nuevo) {
        const ins = await supabase.from('producto_fotos').insert({ producto_id: id, imagen_url: url, imagen_path: path, orden: fotos.length }).select('id').single();
        if (ins.error) throw ins.error;
        fila = { ...fila, id: ins.data.id };
      }
      const lista = [...fotos, fila];
      setFotos(lista);
      if (fotos.length === 0) await sincronizarPortada(lista);
      revalidarWeb();
    } catch (e) { setError(mensajeError(e)); }
  }

  function elegirOrigen() {
    Alert.alert('Agregar foto', 'Elige de dónde tomarla', [
      { text: 'Cámara', onPress: () => agregarFoto('camara') },
      { text: 'Galería', onPress: () => agregarFoto('galeria') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function quitarFoto(i: number) {
    const foto = fotos[i]!;
    const lista = fotos.filter((_, k) => k !== i);
    setFotos(lista);
    if (foto.id) await supabase.from('producto_fotos').delete().eq('id', foto.id);
    if (foto.path) supabase.storage.from('productos').remove([foto.path]).catch(() => {});
    await sincronizarPortada(lista);
    revalidarWeb();
  }

  async function hacerPortada(i: number) {
    if (i === 0) return;
    const lista = [fotos[i]!, ...fotos.filter((_, k) => k !== i)];
    setFotos(lista);
    if (!nuevo) {
      await Promise.all(lista.filter((x) => x.id).map((x, orden) => supabase.from('producto_fotos').update({ orden }).eq('id', x.id)));
      await sincronizarPortada(lista);
      revalidarWeb();
    }
  }

  function agregarMaterial() {
    const m = material.trim();
    if (m.length < 2 || materiales.includes(m)) return;
    setMateriales([...materiales, m.slice(0, 60)]); setMaterial('');
  }

  async function guardar() {
    setError(null);
    if (fotos.length === 0) return setError('Agrega al menos una foto del producto.');
    const v = productoSchema.safeParse({
      nombre: f.nombre, precio: f.precio, categoria_id: f.categoria_id, stock: f.stock, es_combo: f.es_combo, destacado: f.destacado,
      publicado: true, disponible: f.disponible, bajo_pedido: f.bajo_pedido,
      descripcion: f.descripcion.trim() || null, descripcion_corta: f.descripcion.trim().slice(0, 140) || null,   // una sola descripción
      imagen_url: fotos[0]!.url, materiales,
      motivo_cambio_precio: precioCambio ? f.motivo_cambio_precio || null : null,
    });
    if (!v.success) return setError(v.error.issues[0]?.message ?? 'Revisa los datos');
    if (precioCambio && !f.motivo_cambio_precio.trim()) return setError('Indica el motivo del cambio de precio.');
    setOcupado(true);
    const { id: _omit, ...fila } = v.data as Fila;
    const res = nuevo ? await supabase.from('productos').insert(fila).select('id').single()
                      : await supabase.from('productos').update(fila).eq('id', id).select('id').single();
    if (res.error) { setOcupado(false); return setError(mensajeError(res.error)); }
    if (nuevo) {
      const ins = await supabase.from('producto_fotos').insert(fotos.map((x, orden) => ({ producto_id: res.data.id, imagen_url: x.url, imagen_path: x.path, orden })));
      if (ins.error) { setOcupado(false); return setError(mensajeError(ins.error)); }
    }
    setOcupado(false);
    revalidarWeb();
    if (nuevo) router.back(); else recargar();
  }

  function eliminar() {
    Alert.alert('Eliminar producto', `¿Eliminar "${f.nombre}"? Dejará de verse en la web y en la app. Los pedidos anteriores se conservan.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        const { error: e } = await supabase.from('productos').update({ eliminado_en: new Date().toISOString(), publicado: false }).eq('id', id);
        if (e) setError(mensajeError(e)); else { revalidarWeb(); router.back(); }
      } },
    ]);
  }

  async function alternarItem(productoId: string) {
    const existente = data?.items.find((i: Fila) => i.producto_id === productoId);
    const { error: e } = existente
      ? await supabase.from('combo_items').delete().eq('id', existente.id)
      : await supabase.from('combo_items').insert({ combo_id: id, producto_id: productoId, cantidad: 1 });
    if (e) setError(mensajeError(e)); else { revalidarWeb(); recargar(); }
  }

  return (
    <HojaRuta titulo={nuevo ? 'Nuevo producto' : f.nombre || 'Producto'}>
      {/* Foto principal con botón de cámara al pie */}
      <View className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-[#f2f2f2]">
        {fotos[0] ? <Foto uri={fotos[0].url} className="h-full w-full" resizeMode="cover" accessibilityLabel="Foto principal" /> : (
          <View className="h-full w-full items-center justify-center"><Text className="text-base text-lana-500">Sin fotos todavía</Text></View>
        )}
        <Pressable onPress={elegirOrigen} accessibilityRole="button" accessibilityLabel="Agregar foto"
                   className="absolute bottom-3 right-3 h-12 w-12 items-center justify-center rounded-full bg-white" style={{ elevation: 3 }}>
          <Camera size={22} color={TEMA.lana['700']} />
        </Pressable>
      </View>
      {fotos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {fotos.map((x, i) => (
            <View key={x.url + i}>
              <Pressable onPress={() => hacerPortada(i)} accessibilityLabel={i === 0 ? 'Foto de portada' : 'Usar como portada'}>
                <Foto uri={x.url} className={`h-16 w-16 rounded-xl bg-[#f2f2f2] ${i === 0 ? 'border-2 border-lana-700' : ''}`} />
              </Pressable>
              <Pressable onPress={() => quitarFoto(i)} hitSlop={6} accessibilityLabel="Eliminar foto" className="absolute -right-1.5 -top-1.5 h-6 w-6 items-center justify-center rounded-full bg-white" style={{ elevation: 2 }}>
                <X size={14} color="#b3261e" />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
      {fotos.length > 1 && <Nota>Toca una foto para usarla como portada. La “X” la elimina.</Nota>}

      <Campo etiqueta="Nombre *" value={f.nombre} onChangeText={set('nombre')} />
      <Campo etiqueta="Precio *" value={f.precio} onChangeText={set('precio')} keyboardType="decimal-pad" />
      {precioCambio && <Campo etiqueta="Motivo del cambio de precio *" value={f.motivo_cambio_precio} onChangeText={set('motivo_cambio_precio')} placeholder="Ej.: subió el cemento" />}
      <Campo etiqueta="Descripción" value={f.descripcion} onChangeText={set('descripcion')} multiline style={{ minHeight: 100, textAlignVertical: 'top' }} />

      {/* Categoría y stock en la misma fila */}
      <View className="flex-row items-end gap-2">
        <View className="flex-1 gap-1">
          <Text className="text-sm font-medium text-lana-800">Categoría</Text>
          <Selector valor={f.categoria_id} onChange={set('categoria_id')} opciones={(data?.cats ?? []).map((c: Fila) => ({ id: c.id as string, texto: c.nombre as string }))} />
        </View>
        <View className="w-28"><Campo etiqueta="Stock" value={f.stock} onChangeText={set('stock')} keyboardType="number-pad" /></View>
      </View>

      <Subtitulo>Materiales usados</Subtitulo>
      <View className="flex-row items-center gap-2">
        <TextInput value={material} onChangeText={setMaterial} onSubmitEditing={agregarMaterial} placeholder="Ej.: Cemento gris" placeholderTextColor={TEMA.lana['400']}
                   style={{ fontFamily: 'Poppins_400Regular' }} className="min-h-[52px] flex-1 rounded-xl border border-neutral-300 bg-white px-4 text-lg text-lana-900" />
        <Pressable onPress={agregarMaterial} accessibilityRole="button" accessibilityLabel="Agregar material" className="h-[52px] w-[52px] items-center justify-center rounded-xl bg-lana-200"><Plus size={22} color={TEMA.lana['700']} /></Pressable>
      </View>
      {materiales.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {materiales.map((m) => (
            <View key={m} className="flex-row items-center gap-1 rounded-xl border border-neutral-300 bg-white py-1 pl-3 pr-1">
              <Text className="text-sm text-lana-900">{m}</Text>
              <Pressable onPress={() => setMateriales(materiales.filter((x) => x !== m))} hitSlop={6} accessibilityLabel={`Quitar ${m}`} className="h-8 w-8 items-center justify-center"><X size={16} color={TEMA.lana['500']} /></Pressable>
            </View>
          ))}
        </View>
      )}

      <Subtitulo>Estado</Subtitulo>
      <Chips valor={estado} onChange={(e) => setF((x) => ({ ...x, publicado: true, disponible: e === 'disponible' }))}
             opciones={[{ id: 'disponible', texto: 'Disponible' }, { id: 'agotado', texto: 'Agotado' }]} />
      <Nota>{estado === 'agotado' ? 'En la web se muestra con la etiqueta Agotado.' : 'En la web se muestra con la etiqueta Disponible.'}</Nota>
      <Interruptor etiqueta="Se elabora bajo pedido" valor={f.bajo_pedido} onChange={set('bajo_pedido')} />
      <Interruptor etiqueta="Es combo" valor={f.es_combo} onChange={set('es_combo')} />
      <Interruptor etiqueta="Destacado en la web" valor={f.destacado} onChange={set('destacado')} />
      <ErrorMsg texto={error} />

      {/* Guardar y eliminar en la misma fila */}
      <View className="flex-row gap-2">
        <View className="flex-1"><Boton titulo={nuevo ? 'Crear' : 'Guardar'} onPress={guardar} cargando={ocupado} /></View>
        {!nuevo && <View className="flex-1"><Boton titulo="Eliminar" variante="suave" onPress={eliminar} /></View>}
      </View>

      {!nuevo && f.es_combo && esAdmin && (
        <>
          <Subtitulo>Productos incluidos</Subtitulo>
          <Chips valor={null} onChange={alternarItem}
                 opciones={(data?.prods ?? []).map((p: Fila) => ({ id: p.id as string, texto: p.nombre as string, marcado: data?.items.some((i: Fila) => i.producto_id === p.id) }))} />
        </>
      )}

      {!nuevo && esAdmin && data && data.historial.length > 0 && (
        <>
          <Subtitulo>Historial de precios</Subtitulo>
          <Tarjeta>
            {data.historial.map((h: Fila, i: number) => (
              <FilaUI key={i} a={new Date(h.fecha).toLocaleDateString()} b={`${money(h.precio_anterior)} → ${money(h.precio_nuevo)}`} />
            ))}
            <Texto>{data.historial[0]?.motivo ? `Último motivo: ${data.historial[0].motivo}` : ''}</Texto>
          </Tarjeta>
        </>
      )}
    </HojaRuta>
  );
}
