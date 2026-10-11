import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Camera, ChevronLeft, ChevronRight, Paperclip, Plus } from 'lucide-react-native';
import { gastoSchema, TEMA } from '@lanita/shared';
import { supabase, mensajeError, type Fila } from '@/lib/supabase';
import { hoyISO, money, subirImagen, tomarFoto, uuidv4 } from '@/lib/utils';
import { Boton, Campo, Chips, Encabezado, ErrorMsg, Nota, Pantalla, useDatos } from '@/ui';
import { Hoja } from '@/ui/hoja';
import { Bloque, FilasEsqueleto } from '@/ui/esqueleto';
import { Paginador } from '@/ui/paginador';
import { Selector } from '@/ui/selector';
import { SelectorFecha } from '@/ui/fecha';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const POR_PAGINA = 6;
const mesActual = () => hoyISO().slice(0, 7);
const mover = (m: string, d: number) => { const [y, mm] = m.split('-').map(Number); const dt = new Date(y!, mm! - 1 + d, 1); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`; };
const fechaCorta = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' });

export default function Gastos() {
  const [mes, setMes] = useState(mesActual());
  const [catFiltro, setCatFiltro] = useState<string>('todas');
  const [pagina, setPagina] = useState(1);
  const [nuevo, setNuevo] = useState(false);
  const [f, setF] = useState({ monto: '', descripcion: '', categoria_gasto_id: '', metodo_pago: 'efectivo', fecha: hoyISO() });
  const [foto, setFoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Se trae desde 5 meses antes para el gráfico de los últimos 6 meses.
  const { data, recargar, cargando } = useDatos<Fila>(async () => {
    const desde = `${mover(mes, -5)}-01`, hasta = `${mover(mes, 1)}-01`;
    const [g, c, u] = await Promise.all([
      supabase.from('gastos').select('id, fecha, monto, descripcion, categoria_gasto_id, comprobante_path').is('eliminado_en', null).gte('fecha', desde).lt('fecha', hasta).order('fecha', { ascending: false }).limit(1000),
      supabase.from('categorias_gasto').select('id, nombre').eq('activa', true).order('nombre'),
      supabase.auth.getUser(),
    ]);
    if (g.error) throw g.error;
    return { gastos: g.data ?? [], cats: c.data ?? [], uid: u.data.user?.id };
  });

  const nombreCat = (id: string) => (data?.cats.find((c: Fila) => c.id === id)?.nombre as string | undefined) ?? '—';
  const todos: Fila[] = (data?.gastos ?? []).filter((g: Fila) => catFiltro === 'todas' || g.categoria_gasto_id === catFiltro);
  const delMes = todos.filter((g) => g.fecha.startsWith(mes));
  const total = delMes.reduce((s, g) => s + Number(g.monto), 0);

  // Gráfico 1: gasto por tipo en el mes
  const porTipo = new Map<string, number>();
  for (const g of delMes) porTipo.set(g.categoria_gasto_id, (porTipo.get(g.categoria_gasto_id) ?? 0) + Number(g.monto));
  const tipos = [...porTipo].sort((a, b) => b[1] - a[1]);

  // Gráfico 2: total de los últimos 6 meses
  const meses = Array.from({ length: 6 }, (_, i) => mover(mes, i - 5));
  const totalesMes = meses.map((m) => todos.filter((g) => g.fecha.startsWith(m)).reduce((s, g) => s + Number(g.monto), 0));
  const maxMes = Math.max(1, ...totalesMes);

  // Historial (lista del mes, de la fecha más reciente a la más antigua)
  const paginas = Math.max(1, Math.ceil(delMes.length / POR_PAGINA));
  const actual = Math.min(pagina, paginas);
  const visibles = delMes.slice((actual - 1) * POR_PAGINA, actual * POR_PAGINA);

  async function guardar() {
    setError(null);
    try {
      let comprobante_path: string | null = null;
      if (foto) comprobante_path = (await subirImagen('comprobantes', `${data!.uid}/${new Date().getFullYear()}/${uuidv4()}.jpg`, foto)).path;
      const v = gastoSchema.safeParse({ ...f, categoria_gasto_id: f.categoria_gasto_id || data?.cats[0]?.id, comprobante_path });
      if (!v.success) throw new Error(v.error.issues[0]?.message);
      setOcupado(true);
      const { id: _o, ...fila } = v.data as Fila;
      const { error: e } = await supabase.from('gastos').insert(fila);
      if (e) throw e;
      setF({ monto: '', descripcion: '', categoria_gasto_id: '', metodo_pago: 'efectivo', fecha: hoyISO() }); setFoto(null); setNuevo(false); recargar();
    } catch (e) { setError(mensajeError(e)); }
    setOcupado(false);
  }

  async function verComprobante(path: string) {
    // URL firmada y de vida corta: el bucket es privado.
    const { data: s, error: e } = await supabase.storage.from('comprobantes').createSignedUrl(path, 60);
    if (e || !s) return setError('No se pudo abrir el comprobante.');
    Linking.openURL(s.signedUrl);
  }

  const opcionesTipo = [{ id: 'todas', texto: 'Todos los tipos' }, ...(data?.cats ?? []).map((c: Fila) => ({ id: c.id as string, texto: c.nombre as string }))];

  return (
    <Pantalla arriba onRefresh={recargar} refrescando={cargando}>
      <Encabezado titulo="Gastos" descripcion="Historial de lo que gastas y en qué se va tu dinero." />
      <View className="flex-row items-center gap-2">
        <View className="flex-1"><Selector valor={catFiltro} onChange={(v) => { setCatFiltro(v); setPagina(1); }} opciones={opcionesTipo} /></View>
        <Pressable onPress={() => setNuevo(true)} accessibilityRole="button" className="min-h-[48px] flex-row items-center gap-1.5 rounded-xl bg-lana-200 px-4">
          <Text className="text-base font-semibold text-lana-900">Gasto</Text><Plus size={18} color={TEMA.lana['700']} />
        </Pressable>
      </View>

      {cargando && !data && (<><Bloque className="h-20 rounded-2xl" /><Bloque className="h-44 rounded-2xl" /><FilasEsqueleto n={4} /></>)}
      {/* Mes y total */}
      <View className="flex-row items-center justify-between rounded-2xl border border-neutral-300 bg-white p-3">
        <Pressable onPress={() => { setMes(mover(mes, -1)); setPagina(1); }} hitSlop={8} accessibilityLabel="Mes anterior" className="h-10 w-10 items-center justify-center rounded-full border border-neutral-300"><ChevronLeft size={18} color={TEMA.lana['700']} /></Pressable>
        <View className="items-center">
          <Text className="text-sm text-lana-800">{MESES[Number(mes.slice(5)) - 1]} {mes.slice(0, 4)}</Text>
          <Text className="text-2xl font-bold text-lana-900">{money(total)}</Text>
        </View>
        <Pressable onPress={() => { setMes(mover(mes, 1)); setPagina(1); }} hitSlop={8} accessibilityLabel="Mes siguiente" className="h-10 w-10 items-center justify-center rounded-full border border-neutral-300"><ChevronRight size={18} color={TEMA.lana['700']} /></Pressable>
      </View>

      {/* Gráfico: últimos 6 meses */}
      <View className="rounded-2xl border border-neutral-300 bg-white p-4">
        <Text className="mb-3 text-base font-semibold text-lana-900">Últimos 6 meses</Text>
        <View className="h-36 flex-row items-end justify-between gap-2">
          {meses.map((m, i) => (
            <View key={m} className="flex-1 items-center justify-end">
              <Text className="mb-1 text-[10px] text-lana-800" numberOfLines={1}>{totalesMes[i]! > 0 ? Math.round(totalesMes[i]!) : ''}</Text>
              <View style={{ height: Math.max(4, (totalesMes[i]! / maxMes) * 100) }} className={`w-full rounded-t-lg ${m === mes ? 'bg-lana-700' : 'bg-lana-300'}`} />
              <Text className="mt-1 text-xs text-lana-800">{MESES[Number(m.slice(5)) - 1]!.slice(0, 3)}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Gráfico: por tipo en el mes */}
      <View className="rounded-2xl border border-neutral-300 bg-white p-4">
        <Text className="mb-3 text-base font-semibold text-lana-900">En qué gastaste este mes</Text>
        {tipos.length === 0 && <Nota>Sin gastos en este mes.</Nota>}
        {tipos.map(([id, t]) => (
          <View key={id} className="mb-3">
            <View className="mb-1 flex-row justify-between">
              <Text className="flex-1 text-sm text-lana-800" numberOfLines={1}>{nombreCat(id)}</Text>
              <Text className="text-sm font-semibold text-lana-900">{money(t)} · {Math.round((t / (total || 1)) * 100)}%</Text>
            </View>
            <View className="h-3 overflow-hidden rounded-full bg-neutral-100"><View style={{ width: `${Math.max(3, (t / (tipos[0]![1] || 1)) * 100)}%` }} className="h-3 rounded-full bg-lana-700" /></View>
          </View>
        ))}
      </View>

      {/* Historial */}
      <Text className="mt-1 text-lg font-semibold text-lana-800">Historial</Text>
      <ErrorMsg texto={error} />
      {delMes.length === 0 && !cargando && <Nota>No hay gastos registrados en este mes.</Nota>}
      <View className="overflow-hidden rounded-2xl border border-neutral-300 bg-white">
        {visibles.map((g, i) => (
          <Pressable key={g.id} onPress={g.comprobante_path ? () => verComprobante(g.comprobante_path) : undefined} className={`flex-row items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-neutral-200' : ''}`}>
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="text-base font-semibold text-lana-900">{g.descripcion}</Text>
              <Text className="text-sm text-lana-800">{fechaCorta(g.fecha)} · {nombreCat(g.categoria_gasto_id)}</Text>
            </View>
            {g.comprobante_path ? <Paperclip size={16} color={TEMA.lana['500']} /> : null}
            <Text className="text-base font-bold text-lana-900">{money(g.monto)}</Text>
          </Pressable>
        ))}
      </View>
      <Paginador pagina={actual} total={paginas} onChange={setPagina} />

      <Hoja visible={nuevo} onClose={() => setNuevo(false)} titulo="Registrar gasto">
        <Campo etiqueta="Monto *" value={f.monto} onChangeText={(v) => setF({ ...f, monto: v })} keyboardType="decimal-pad" />
        <Campo etiqueta="Descripción *" value={f.descripcion} onChangeText={(v) => setF({ ...f, descripcion: v })} />
        <View className="gap-1">
          <Text className="text-sm font-medium text-lana-800">Tipo de gasto</Text>
          <Selector valor={f.categoria_gasto_id || data?.cats[0]?.id || ''} onChange={(v) => setF({ ...f, categoria_gasto_id: v })}
                    opciones={(data?.cats ?? []).map((c: Fila) => ({ id: c.id as string, texto: c.nombre as string }))} />
        </View>
        <SelectorFecha etiqueta="Fecha" valor={f.fecha} onChange={(v) => setF({ ...f, fecha: v || hoyISO() })} limite="pasado" />
        <Chips valor={f.metodo_pago} onChange={(v) => setF({ ...f, metodo_pago: v })} opciones={['efectivo', 'yape', 'transferencia', 'tarjeta', 'otro'].map((m) => ({ id: m, texto: m }))} />
        <Boton titulo={foto ? 'Comprobante listo (cambiar)' : 'Foto del comprobante (opcional)'} icono={Camera} variante="suave" onPress={async () => setFoto((await tomarFoto('camara'))?.base64 ?? foto)} />
        <ErrorMsg texto={error} />
        <Boton titulo="Guardar gasto" onPress={guardar} cargando={ocupado} />
      </Hoja>
    </Pantalla>
  );
}
