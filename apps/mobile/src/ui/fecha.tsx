import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { TEMA } from '@lanita/shared';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const p2 = (n: number) => String(n).padStart(2, '0');
const iso = (a: number, m: number, d: number) => `${a}-${p2(m + 1)}-${p2(d)}`;

type Modo = 'dia' | 'mes' | 'anio';

/**
 * Selector de fecha flotante: se abre como una tarjeta redondeada sobre la pantalla y permite elegir año, mes y día.
 * Valor: 'AAAA-MM-DD' o ''. `limite`: 'futuro' (no permite fechas pasadas) o 'pasado' (no permite fechas futuras).
 */
export function SelectorFecha({ etiqueta, valor, onChange, limite, placeholder = 'Elegir fecha' }: { etiqueta: string; valor: string; onChange: (v: string) => void; limite?: 'futuro' | 'pasado'; placeholder?: string }) {
  const hoy = new Date();
  const hoyIso = iso(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const base = valor ? new Date(valor + 'T00:00:00') : hoy;
  const [abierto, setAbierto] = useState(false);
  const [modo, setModo] = useState<Modo>('dia');
  const [mes, setMes] = useState(base.getMonth());
  const [anio, setAnio] = useState(base.getFullYear());

  const primero = (new Date(anio, mes, 1).getDay() + 6) % 7;   // lunes = 0
  const dias = new Date(anio, mes + 1, 0).getDate();
  const celdas: (number | null)[] = [...Array(primero).fill(null), ...Array.from({ length: dias }, (_, i) => i + 1)];
  while (celdas.length % 7) celdas.push(null);
  const anios = Array.from({ length: 12 }, (_, i) => (limite === 'pasado' ? hoy.getFullYear() - 10 + i : hoy.getFullYear() - 1 + i));

  function mover(d: number) {
    const f = new Date(anio, mes + d, 1);
    setMes(f.getMonth()); setAnio(f.getFullYear());
  }
  function abrir() {
    const b = valor ? new Date(valor + 'T00:00:00') : hoy;
    setMes(b.getMonth()); setAnio(b.getFullYear()); setModo('dia'); setAbierto(true);
  }
  const texto = valor ? `${Number(valor.slice(8))} de ${MESES[Number(valor.slice(5, 7)) - 1]!.toLowerCase()} de ${valor.slice(0, 4)}` : placeholder;
  const bloqueado = (f: string) => (limite === 'futuro' && f < hoyIso) || (limite === 'pasado' && f > hoyIso);

  return (
    <View className="gap-1">
      {etiqueta ? <Text className="text-sm font-medium text-lana-800">{etiqueta}</Text> : null}
      <Pressable onPress={abrir} accessibilityRole="button" className="min-h-[48px] flex-row items-center justify-between rounded-xl border border-neutral-300 bg-white px-4">
        <Text className={`text-base ${valor ? 'text-lana-900' : 'text-lana-500'}`}>{texto}</Text>
        <CalendarDays size={20} color={TEMA.lana['700']} />
      </Pressable>

      <Modal visible={abierto} transparent animationType="fade" onRequestClose={() => setAbierto(false)} statusBarTranslucent>
        <Pressable className="flex-1 items-center justify-center bg-black/50 p-6" onPress={() => setAbierto(false)}>
          <Pressable onPress={() => {}} className="w-full max-w-sm rounded-3xl bg-white p-4 pt-12">
            <Pressable onPress={() => setAbierto(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cerrar calendario" className="absolute right-3 top-3 h-9 w-9 items-center justify-center rounded-full bg-lana-200">
              <X size={18} color={TEMA.lana['800']} />
            </Pressable>
            <View className="mb-3 flex-row items-center justify-between">
              <Pressable onPress={() => mover(-1)} hitSlop={8} accessibilityLabel="Mes anterior" className="h-10 w-10 items-center justify-center rounded-full border border-neutral-300"><ChevronLeft size={18} color={TEMA.lana['700']} /></Pressable>
              <View className="flex-row gap-1">
                <Pressable onPress={() => setModo(modo === 'mes' ? 'dia' : 'mes')} accessibilityRole="button" className={`min-h-[40px] flex-row items-center gap-1 rounded-xl px-3 ${modo === 'mes' ? 'bg-lana-200' : ''}`}>
                  <Text className="text-base font-semibold text-lana-900">{MESES[mes]}</Text><ChevronDown size={14} color={TEMA.lana['700']} />
                </Pressable>
                <Pressable onPress={() => setModo(modo === 'anio' ? 'dia' : 'anio')} accessibilityRole="button" className={`min-h-[40px] flex-row items-center gap-1 rounded-xl px-3 ${modo === 'anio' ? 'bg-lana-200' : ''}`}>
                  <Text className="text-base font-semibold text-lana-900">{anio}</Text><ChevronDown size={14} color={TEMA.lana['700']} />
                </Pressable>
              </View>
              <Pressable onPress={() => mover(1)} hitSlop={8} accessibilityLabel="Mes siguiente" className="h-10 w-10 items-center justify-center rounded-full border border-neutral-300"><ChevronRight size={18} color={TEMA.lana['700']} /></Pressable>
            </View>

            {modo === 'dia' && (
              <>
                <View className="flex-row">{DIAS.map((d, i) => <Text key={i} className="flex-1 text-center text-xs font-semibold text-lana-500">{d}</Text>)}</View>
                {Array.from({ length: celdas.length / 7 }, (_, fila) => (
                  <View key={fila} className="flex-row">
                    {celdas.slice(fila * 7, fila * 7 + 7).map((d, i) => {
                      if (!d) return <View key={i} className="h-11 flex-1" />;
                      const f = iso(anio, mes, d);
                      const no = bloqueado(f), sel = f === valor;
                      return (
                        <Pressable key={i} disabled={no} onPress={() => { onChange(f); setAbierto(false); }} accessibilityLabel={f} className="h-11 flex-1 items-center justify-center">
                          <View className={`h-10 w-10 items-center justify-center rounded-full ${sel ? 'bg-lana-700' : f === hoyIso ? 'border border-lana-700' : ''}`}>
                            <Text className={`text-base ${sel ? 'font-bold text-white' : no ? 'text-lana-300' : 'text-lana-900'}`}>{d}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </>
            )}

            {modo === 'mes' && (
              <View className="flex-row flex-wrap justify-between gap-y-2">
                {MESES.map((m, i) => (
                  <Pressable key={m} onPress={() => { setMes(i); setModo('dia'); }} className={`min-h-[48px] w-[31%] items-center justify-center rounded-xl border ${i === mes ? 'border-lana-700 bg-lana-700' : 'border-neutral-300'}`}>
                    <Text className={`text-sm font-semibold ${i === mes ? 'text-white' : 'text-lana-800'}`}>{m.slice(0, 3)}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {modo === 'anio' && (
              <ScrollView style={{ maxHeight: 260 }}>
                <View className="flex-row flex-wrap justify-between gap-y-2">
                  {anios.map((a) => (
                    <Pressable key={a} onPress={() => { setAnio(a); setModo('dia'); }} className={`min-h-[48px] w-[31%] items-center justify-center rounded-xl border ${a === anio ? 'border-lana-700 bg-lana-700' : 'border-neutral-300'}`}>
                      <Text className={`text-sm font-semibold ${a === anio ? 'text-white' : 'text-lana-800'}`}>{a}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            )}

            {valor !== '' && (
              <Pressable onPress={() => { onChange(''); setAbierto(false); }} className="mt-3 min-h-[40px] items-center justify-center"><Text className="text-sm font-semibold text-lana-800">Quitar fecha</Text></Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
