import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { NotebookPen, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { TEMA } from '@lanita/shared';
import { supabase, mensajeError, type Fila } from '@/lib/supabase';
import { hoyISO, money } from '@/lib/utils';
import { Boton, Buscador, Campo, Chips, Encabezado, ErrorMsg, Nota, Pantalla, useDatos, Vacio } from '@/ui';
import { ListaEsqueleto } from '@/ui/esqueleto';
import { Hoja } from '@/ui/hoja';
import { Paginador } from '@/ui/paginador';
import { SelectorFecha } from '@/ui/fecha';
import { CompraInsumo } from '@/componentes/RegistroInsumo';

const POR_PAGINA = 5;
const UNIDADES = ['kg', 'g', 'l', 'ml', 'unidad', 'plancha', 'pliego', 'metro'] as const;
const corta = (f?: string | null) => (f ? new Date(f + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export default function Insumos() {
  const [compra, setCompra] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);   // insumo que se está editando aquí mismo
  const [nombre, setNombre] = useState('');
  const [unidad, setUnidad] = useState<string>('unidad');
  const [fecha, setFecha] = useState(hoyISO());
  const [texto, setTexto] = useState('');
  const [errAccion, setErrAccion] = useState<string | null>(null);

  const { data, cargando, error, offline, recargar } = useDatos<{ insumos: Fila[]; compras: Fila[]; notas: Fila[] }>(async () => {
    const [i, c, n] = await Promise.all([
      supabase.from('insumos').select('id, nombre, unidad_medida').is('eliminado_en', null).order('nombre'),
      supabase.from('gastos').select('insumo_id, fecha, monto, cantidad, unidad').not('insumo_id', 'is', null).is('eliminado_en', null).order('fecha', { ascending: false }).limit(300),
      supabase.from('insumo_notas').select('id, insumo_id, fecha, texto').is('eliminado_en', null).order('fecha', { ascending: false }).limit(300),
    ]);
    if (i.error) throw i.error;
    return { insumos: i.data ?? [], compras: c.data ?? [], notas: n.data ?? [] };
  }, 'insumos_simple');

  const insumos = (data?.insumos ?? []).filter((i) => !q || i.nombre.toLowerCase().includes(q.toLowerCase()));
  const paginas = Math.max(1, Math.ceil(insumos.length / POR_PAGINA));
  const actual = Math.min(pagina, paginas);
  const visibles = insumos.slice((actual - 1) * POR_PAGINA, actual * POR_PAGINA);

  function editar(i: Fila) {
    if (abierto === i.id) return setAbierto(null);
    setAbierto(i.id); setNombre(i.nombre); setUnidad(i.unidad_medida); setTexto(''); setFecha(hoyISO()); setErrAccion(null);
  }
  async function guardarInsumo(id: string) {
    setErrAccion(null);
    if (nombre.trim().length < 2) return setErrAccion('Escribe el nombre del insumo.');
    const { error: e } = await supabase.from('insumos').update({ nombre: nombre.trim(), unidad_medida: unidad }).eq('id', id);
    if (e) setErrAccion(mensajeError(e)); else { setAbierto(null); recargar(); }
  }
  async function guardarNota(id: string) {
    setErrAccion(null);
    if (texto.trim().length < 3) return setErrAccion('Escribe tu observación.');
    const { error: e } = await supabase.from('insumo_notas').insert({ insumo_id: id, fecha, texto: texto.trim() });
    if (e) setErrAccion(mensajeError(e)); else { setTexto(''); recargar(); }
  }
  function eliminar(i: Fila) {
    Alert.alert('Eliminar insumo', `¿Eliminar "${i.nombre}"? Sus compras ya registradas siguen contando como gastos.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        const { error: e } = await supabase.from('insumos').update({ eliminado_en: new Date().toISOString(), activo: false }).eq('id', i.id);
        if (e) setErrAccion(mensajeError(e)); else { setAbierto(null); recargar(); }
      } },
    ]);
  }

  return (
    <Pantalla arriba onRefresh={recargar} refrescando={cargando}>
      <Encabezado titulo="Insumos" descripcion="Anota lo que compras y cómo te fue con cada insumo." />
      <View className="flex-row items-center gap-2">
        <Buscador value={q} onChangeText={(v) => { setQ(v); setPagina(1); }} placeholder="Buscar insumo…" />
        <Pressable onPress={() => setCompra(true)} accessibilityRole="button" className="min-h-[48px] flex-row items-center gap-1.5 rounded-xl bg-lana-200 px-4">
          <Text className="text-base font-semibold text-lana-900">Compra</Text><Plus size={18} color={TEMA.lana['700']} />
        </Pressable>
      </View>

      {offline && <Nota>Sin conexión: mostrando la última copia guardada.</Nota>}
      <ErrorMsg texto={error ?? errAccion} />
      {cargando && !data && <ListaEsqueleto n={4} />}
      {insumos.length === 0 && !cargando && !!data && <Vacio texto="Aún no hay insumos. Registra tu primera compra." />}

      <View className="gap-3">
        {visibles.map((i) => {
          const c = data?.compras.find((x) => x.insumo_id === i.id);
          const notas = (data?.notas ?? []).filter((n) => n.insumo_id === i.id);
          const edit = abierto === i.id;
          return (
            <View key={i.id} className="overflow-hidden rounded-3xl border border-neutral-300 bg-white">
              <View className="flex-row items-center justify-between border-b border-neutral-200 px-4 py-1">
                <Text className="flex-1 text-sm font-semibold text-lana-500">Insumo · {i.unidad_medida}</Text>
                <View className="flex-row">
                  <Pressable onPress={() => editar(i)} accessibilityLabel={`Editar ${i.nombre}`} className="h-11 w-11 items-center justify-center"><Pencil size={19} color={TEMA.lana['700']} /></Pressable>
                  <Pressable onPress={() => eliminar(i)} accessibilityLabel={`Eliminar ${i.nombre}`} className="h-11 w-11 items-center justify-center"><Trash2 size={19} color="#b3261e" /></Pressable>
                </View>
              </View>
              <View className="px-4 py-3">
                <Text className="text-lg font-bold text-lana-900">{i.nombre}</Text>
                <Text className="mt-0.5 text-sm text-lana-800">{c ? `Última compra: ${corta(c.fecha)} · ${Number(c.cantidad)} ${c.unidad ?? i.unidad_medida}` : 'Sin compras registradas'}</Text>
              </View>
              <View className="mx-4 flex-row items-center justify-between border-t border-neutral-200 py-3">
                <Text className="text-xs font-bold uppercase text-lana-500">Pagaste</Text>
                <Text className="text-lg font-semibold text-[#74784a]">{c ? money(c.monto) : 'Sin compra'}</Text>
              </View>

              {edit && (
                <View className="gap-3 border-t border-neutral-200 bg-neutral-50 p-4">
                  <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} />
                  <Chips valor={unidad} onChange={setUnidad} opciones={UNIDADES.map((u) => ({ id: u as string, texto: u }))} />
                  <View className="flex-row gap-2">
                    <View className="flex-1"><Boton titulo="Guardar" onPress={() => guardarInsumo(i.id)} /></View>
                    <View className="flex-1"><Boton titulo="Cancelar" variante="suave" onPress={() => setAbierto(null)} /></View>
                  </View>

                  <View className="mt-1 flex-row items-center gap-2"><NotebookPen size={18} color={TEMA.lana['700']} /><Text className="text-base font-semibold text-lana-900">Notas del insumo</Text></View>
                  <SelectorFecha etiqueta="Fecha" valor={fecha} onChange={(v) => setFecha(v || hoyISO())} limite="pasado" />
                  <Campo etiqueta="¿Qué tal te fue con este insumo?" value={texto} onChangeText={setTexto} multiline placeholder="Pruebas, mezclas, resultados…" style={{ minHeight: 90, textAlignVertical: 'top' }} />
                  <Boton titulo="Guardar nota" variante="secundario" onPress={() => guardarNota(i.id)} />
                  {notas.length === 0 && <Nota>Aún no hay notas.</Nota>}
                  {notas.map((n) => (
                    <View key={n.id} className="rounded-2xl border border-neutral-300 bg-white p-3">
                      <Text className="text-xs font-semibold text-lana-500">{corta(n.fecha)}</Text>
                      <Text className="mt-0.5 text-base text-lana-900">{n.texto}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>
      <Paginador pagina={actual} total={paginas} onChange={setPagina} />

      <Hoja visible={compra} onClose={() => setCompra(false)} titulo="Registrar compra">
        <CompraInsumo insumos={data?.insumos ?? []} onListo={() => { setCompra(false); recargar(); }} />
      </Hoja>
    </Pantalla>
  );
}
