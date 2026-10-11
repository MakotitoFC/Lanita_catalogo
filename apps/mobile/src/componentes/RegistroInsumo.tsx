import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { gastoSchema } from '@lanita/shared';
import { supabase, mensajeError, type Fila } from '@/lib/supabase';
import { hoyISO } from '@/lib/utils';
import { Boton, Campo, Chips, ErrorMsg, Nota, Subtitulo } from '@/ui';
import { Selector } from '@/ui/selector';
import { SelectorFecha } from '@/ui/fecha';

const UNIDADES = ['kg', 'g', 'l', 'ml', 'unidad', 'plancha', 'pliego', 'metro'] as const;
const NUEVO = '__nuevo';

/** Opciones del selector de insumos (con "Nuevo insumo" opcional). */
function opcionesInsumos(insumos: Fila[], conNuevo: boolean) {
  return [...(conNuevo ? [{ id: NUEVO, texto: '+ Nuevo insumo' }] : []), ...insumos.map((i) => ({ id: i.id as string, texto: i.nombre as string }))];
}

/**
 * Registrar una compra: qué insumo, cuánto y a qué precio. Se guarda como un gasto de "Materia prima"
 * enlazado al insumo, así cuenta una sola vez en los gastos. No se lleva cuenta de stock.
 */
export function CompraInsumo({ insumos, onListo }: { insumos: Fila[]; onListo: () => void }) {
  const [insumoId, setInsumoId] = useState<string>(insumos[0]?.id ?? NUEVO);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [unidad, setUnidad] = useState<string>('unidad');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [donde, setDonde] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const opciones = useMemo(() => opcionesInsumos(insumos, true), [insumos]);

  async function guardar() {
    setError(null);
    const nuevo = insumoId === NUEVO;
    if (nuevo && nombreNuevo.trim().length < 2) return setError('Escribe el nombre del insumo.');
    setOcupado(true);
    try {
      let id = insumoId, nombre = insumos.find((i) => i.id === insumoId)?.nombre as string | undefined;
      if (nuevo) {
        const r = await supabase.from('insumos').insert({ nombre: nombreNuevo.trim(), unidad_medida: unidad, alerta_activa: false }).select('id').single();
        if (r.error) throw r.error;
        id = r.data.id; nombre = nombreNuevo.trim();
      }
      const cat = await supabase.from('categorias_gasto').select('id').eq('slug', 'materia-prima').single();
      if (cat.error) throw cat.error;
      const v = gastoSchema.safeParse({
        fecha, monto, categoria_gasto_id: cat.data.id, metodo_pago: 'efectivo', insumo_id: id,
        descripcion: `Compra de ${nombre}${donde.trim() ? ` en ${donde.trim()}` : ''}`,
        cantidad: Number(cantidad) > 0 ? Number(cantidad) : undefined, unidad,
      });
      if (!v.success) throw new Error(v.error.issues[0]?.message ?? 'Revisa los datos');
      if (!v.data.cantidad) throw new Error('Indica cuánto compraste.');
      const { id: _o, ...fila } = v.data as Fila;
      const { error: e } = await supabase.from('gastos').insert(fila);
      if (e) throw e;
      onListo();
    } catch (e) { setError(mensajeError(e)); }
    setOcupado(false);
  }

  return (
    <>
      <Subtitulo>¿Qué compraste?</Subtitulo>
      <Selector valor={insumoId} onChange={setInsumoId} opciones={opciones} />
      {insumoId === NUEVO && <Campo etiqueta="Nombre del insumo *" value={nombreNuevo} onChangeText={setNombreNuevo} placeholder="Ej.: Cemento blanco" />}
      <Campo etiqueta="Cantidad *" value={cantidad} onChangeText={setCantidad} keyboardType="decimal-pad" placeholder="0" />
      <Chips valor={unidad} onChange={setUnidad} opciones={UNIDADES.map((u) => ({ id: u as string, texto: u }))} />
      <Campo etiqueta="Cuánto pagaste (S/) *" value={monto} onChangeText={setMonto} keyboardType="decimal-pad" placeholder="0.00" />
      <SelectorFecha etiqueta="Fecha de la compra" valor={fecha} onChange={(v) => setFecha(v || hoyISO())} limite="pasado" />
      <Campo etiqueta="¿Dónde compraste? (opcional)" value={donde} onChangeText={setDonde} placeholder="Tienda, mercado, web…" />
      <Nota>La compra también cuenta como gasto del mes.</Nota>
      <ErrorMsg texto={error} />
      <Boton titulo="Guardar compra" onPress={guardar} cargando={ocupado} />
    </>
  );
}

/** Bloc de notas: escribe una observación y elige a qué insumo corresponde. Queda en el historial por fecha. */
export function NotaInsumo({ insumos, insumoInicial, onListo }: { insumos: Fila[]; insumoInicial?: string; onListo: () => void }) {
  const [insumoId, setInsumoId] = useState<string>(insumoInicial ?? insumos[0]?.id ?? '');
  const [fecha, setFecha] = useState(hoyISO());
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function guardar() {
    setError(null);
    if (!insumoId) return setError('Primero registra un insumo.');
    if (texto.trim().length < 3) return setError('Escribe tu observación.');
    setOcupado(true);
    const { error: e } = await supabase.from('insumo_notas').insert({ insumo_id: insumoId, fecha, texto: texto.trim() });
    setOcupado(false);
    if (e) return setError(mensajeError(e));
    onListo();
  }

  return (
    <>
      <Subtitulo>¿De qué insumo?</Subtitulo>
      <Selector valor={insumoId} onChange={setInsumoId} opciones={opcionesInsumos(insumos, false)} />
      <SelectorFecha etiqueta="Fecha" valor={fecha} onChange={(v) => setFecha(v || hoyISO())} limite="pasado" />
      <Campo etiqueta="Observación" value={texto} onChangeText={setTexto} multiline placeholder="¿Qué tal te fue con este insumo? Pruebas, mezclas, resultados…" style={{ minHeight: 140, textAlignVertical: 'top' }} />
      <ErrorMsg texto={error} />
      <View><Boton titulo="Guardar nota" onPress={guardar} cargando={ocupado} /></View>
    </>
  );
}
