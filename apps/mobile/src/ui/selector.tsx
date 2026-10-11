import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import { TEMA } from '@lanita/shared';

export type OpcionSelector = { id: string; texto: string };

/** Menú desplegable redondeado (reemplaza a las filas de chips cuando hay muchas opciones). */
export function Selector({ valor, onChange, opciones }: { valor: string; onChange: (id: string) => void; opciones: OpcionSelector[] }) {
  const [abierto, setAbierto] = useState(false);
  const actual = opciones.find((o) => o.id === valor);
  return (
    <>
      <Pressable onPress={() => setAbierto(true)} accessibilityRole="button" className="min-h-[48px] flex-row items-center justify-between gap-2 rounded-xl border border-neutral-300 bg-white px-5">
        <Text numberOfLines={1} className="flex-1 text-base text-lana-900">{actual?.texto}</Text>
        <ChevronDown size={18} color={TEMA.lana['700']} />
      </Pressable>
      <Modal visible={abierto} transparent animationType="fade" onRequestClose={() => setAbierto(false)} statusBarTranslucent>
        <Pressable className="flex-1 items-center justify-center bg-black/40 p-6" onPress={() => setAbierto(false)}>
          <View className="max-h-[70%] w-full max-w-sm rounded-3xl bg-white p-2">
            <ScrollView>
              {opciones.map((o) => {
                const activa = o.id === valor;
                return (
                  <Pressable key={o.id} onPress={() => { onChange(o.id); setAbierto(false); }} className={`min-h-[48px] flex-row items-center justify-between rounded-2xl px-4 ${activa ? 'bg-lana-200' : ''}`}>
                    <Text className={`text-base ${activa ? 'font-semibold text-lana-900' : 'text-lana-800'}`}>{o.texto}</Text>
                    {activa && <Check size={18} color={TEMA.lana['700']} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
