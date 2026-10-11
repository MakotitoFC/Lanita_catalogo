import { Pressable, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { TEMA } from '@lanita/shared';

/** Paginador redondeado: "‹ 1 2 ›". No se muestra si todo cabe en una página. */
export function Paginador({ pagina, total, onChange }: { pagina: number; total: number; onChange: (p: number) => void }) {
  if (total <= 1) return null;
  return (
    <View className="items-center">
      <View className="flex-row items-center gap-1 rounded-full bg-white px-2 py-1.5 shadow-sm" style={{ elevation: 3 }}>
        <Pressable disabled={pagina === 1} onPress={() => onChange(pagina - 1)} accessibilityLabel="Página anterior" className="h-10 w-10 items-center justify-center" style={{ opacity: pagina === 1 ? 0.3 : 1 }}>
          <ChevronLeft size={18} color={TEMA.lana['800']} />
        </Pressable>
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
          <Pressable key={n} onPress={() => onChange(n)} accessibilityLabel={`Página ${n}`} accessibilityState={{ selected: n === pagina }}
                     className={`h-10 w-10 items-center justify-center rounded-full ${n === pagina ? 'bg-lana-700' : ''}`}>
            <Text className={`text-base font-semibold ${n === pagina ? 'text-lana-50' : 'text-lana-900'}`}>{n}</Text>
          </Pressable>
        ))}
        <Pressable disabled={pagina === total} onPress={() => onChange(pagina + 1)} accessibilityLabel="Página siguiente" className="h-10 w-10 items-center justify-center" style={{ opacity: pagina === total ? 0.3 : 1 }}>
          <ChevronRight size={18} color={TEMA.lana['800']} />
        </Pressable>
      </View>
    </View>
  );
}
