import { useRouter } from 'expo-router';
import { Layers, LogOut, TrendingUp, Settings, Tag, Wallet, type LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { TEMA } from '@lanita/shared';
import { useAuth } from '@/lib/auth';
import { Hoja } from '@/ui/hoja';

/** Modal "Más": hoja inferior con handle y X que lista las demás secciones de la app. */
export function MenuMas({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { puede, salir } = useAuth();
  const items = [
    { href: '/ingresos', titulo: 'Ingresos', icono: TrendingUp as LucideIcon, roles: ['admin', 'ventas'] as const },
    { href: '/insumos', titulo: 'Insumos', icono: Layers as LucideIcon, roles: ['admin', 'produccion'] as const },
    { href: '/promociones', titulo: 'Promociones', icono: Tag as LucideIcon, roles: ['admin'] as const },
    { href: '/gastos', titulo: 'Gastos', icono: Wallet as LucideIcon, roles: ['admin'] as const },
    { href: '/ajustes', titulo: 'Ajustes', icono: Settings as LucideIcon, roles: ['admin', 'produccion', 'ventas'] as const },
  ].filter((i) => puede(...i.roles));

  return (
    <Hoja visible={visible} onClose={onClose} titulo="Más opciones" compacta>
      <View className="flex-row flex-wrap justify-between gap-y-3">
        {items.map((i) => (
          <Pressable key={i.href} onPress={() => { onClose(); router.push(i.href as any); }} accessibilityRole="button"
                     className="min-h-[104px] w-[48.5%] items-center justify-center gap-2 rounded-3xl border border-neutral-300 bg-white p-3">
            <i.icono size={28} color={TEMA.lana['700']} />
            <Text className="text-center text-base font-semibold text-lana-800">{i.titulo}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => { onClose(); salir(); }} accessibilityRole="button"
                   className="min-h-[104px] w-[48.5%] items-center justify-center gap-2 rounded-3xl border border-neutral-300 bg-white p-3">
          <LogOut size={28} color="#b3261e" />
          <Text className="text-center text-base font-semibold text-lana-800">Cerrar sesión</Text>
        </Pressable>
      </View>
    </Hoja>
  );
}
