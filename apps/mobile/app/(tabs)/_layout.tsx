import { useState } from 'react';
import { Tabs } from 'expo-router';
import { Ellipsis, House, Package, Receipt, type LucideIcon } from 'lucide-react-native';
import { TEMA } from '@lanita/shared';
import { MenuMas } from '@/componentes/MenuMas';

const icono = (Icono: LucideIcon) =>
  ({ color, size }: { color: string; size: number }) => <Icono color={color} size={size + 2} />;

export default function TabsLayout() {
  const [mas, setMas] = useState(false);
  return (
    <>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: TEMA.lana['700'],
        tabBarInactiveTintColor: TEMA.lana['400'],
        tabBarStyle: { backgroundColor: '#ffffff', borderTopColor: '#d4d4d4', height: 64, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: TEMA.lana['800'],
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: '#ffffff' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: icono(House) }} />
      <Tabs.Screen name="pedidos" options={{ title: 'Pedidos', tabBarIcon: icono(Receipt) }} />
      <Tabs.Screen name="productos" options={{ title: 'Productos', tabBarIcon: icono(Package) }} />
      <Tabs.Screen
        name="mas"
        options={{ title: 'Más', tabBarIcon: icono(Ellipsis) }}
        listeners={{ tabPress: (e) => { e.preventDefault(); setMas(true); } }}
      />
      <Tabs.Screen name="ingresos" options={{ href: null }} />
      <Tabs.Screen name="insumos" options={{ href: null }} />
      <Tabs.Screen name="gastos" options={{ href: null }} />
      <Tabs.Screen name="promociones" options={{ href: null }} />
      <Tabs.Screen name="ajustes" options={{ href: null }} />
    </Tabs>
    <MenuMas visible={mas} onClose={() => setMas(false)} />
    </>
  );
}
