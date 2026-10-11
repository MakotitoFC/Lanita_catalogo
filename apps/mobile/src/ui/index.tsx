import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Switch, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Check, ChevronLeft, Search, type LucideIcon } from 'lucide-react-native';
import { TEMA } from '@lanita/shared';

export const colores = { fondo: '#ffffff', texto: TEMA.lana['900'], primario: TEMA.lana['700'], suave: TEMA.lana['500'] };

export function Pantalla({ children, onRefresh, refrescando = false, arriba = false }: { children: React.ReactNode; onRefresh?: () => void; refrescando?: boolean; arriba?: boolean }) {
  const { top } = useSafeAreaInsets();   // 'arriba': pantallas de pestañas, que ya no tienen encabezado
  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 12, paddingTop: arriba ? top + 16 : 16 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={colores.primario} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

export const Titulo = ({ children }: { children: React.ReactNode }) => (
  <Text className="text-2xl font-bold text-lana-900">{children}</Text>
);
export const Subtitulo = ({ children }: { children: React.ReactNode }) => (
  <Text className="mt-2 text-lg font-semibold text-lana-800">{children}</Text>
);
export const Texto = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <Text className={`text-base text-lana-800 ${className}`}>{children}</Text>
);
export const Nota = ({ children }: { children: React.ReactNode }) => <Text className="text-sm text-lana-800">{children}</Text>;

export const Tarjeta = ({ children, onPress, className = '' }: { children: React.ReactNode; onPress?: () => void; className?: string }) => {
  const base = `rounded-2xl border border-neutral-300 bg-white p-4 ${className}`;
  return onPress ? (
    <Pressable onPress={onPress} className={`${base} active:bg-neutral-100`}>{children}</Pressable>
  ) : (
    <View className={base}>{children}</View>
  );
};

type Variante = 'primario' | 'secundario' | 'suave' | 'peligro';
export function Boton({ titulo, onPress, variante = 'primario', cargando = false, deshabilitado = false, icono: Icono }: {
  titulo: string; onPress: () => void; variante?: Variante; cargando?: boolean; deshabilitado?: boolean; icono?: LucideIcon;
}) {
  const estilos: Record<Variante, string> = {
    primario: 'bg-lana-700 active:bg-lana-800',
    suave: 'bg-white border border-neutral-300 active:bg-neutral-100',
    secundario: 'bg-lana-200 active:bg-lana-300',
    peligro: 'bg-peligro',
  };
  const texto = variante === 'suave' ? 'text-lana-900' : variante === 'secundario' ? 'text-lana-900' : 'text-lana-50';
  return (
    <Pressable
      onPress={onPress}
      disabled={cargando || deshabilitado}
      className={`min-h-[56px] items-center justify-center rounded-xl px-5 ${estilos[variante]} ${deshabilitado ? 'opacity-50' : ''}`}
      accessibilityRole="button"
    >
      {cargando ? <ActivityIndicator color={variante === 'suave' || variante === 'secundario' ? colores.primario : '#fff'} /> : <View className="flex-row items-center justify-center gap-2">{Icono ? <Icono size={20} color={variante === 'suave' || variante === 'secundario' ? colores.primario : '#fff'} /> : null}<Text className={`text-lg font-semibold ${texto}`}>{titulo}</Text></View>}
    </Pressable>
  );
}

export function Campo({ etiqueta, ...props }: { etiqueta: string } & TextInputProps) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-lana-800">{etiqueta}</Text>
      <TextInput
        placeholderTextColor={TEMA.lana['400']}
        style={{ fontFamily: 'Poppins_400Regular' }}
        className="min-h-[52px] rounded-xl border border-neutral-300 bg-white px-4 text-lg text-lana-900"
        {...props}
      />
    </View>
  );
}

export function Interruptor({ etiqueta, valor, onChange }: { etiqueta: string; valor: boolean; onChange: (v: boolean) => void }) {
  return (
    <View className="min-h-[52px] flex-row items-center justify-between">
      <Text className="flex-1 text-base text-lana-800">{etiqueta}</Text>
      <Switch value={valor} onValueChange={onChange} trackColor={{ true: TEMA.lana['600'], false: TEMA.lana['300'] }} thumbColor={TEMA.lana['50']} />
    </View>
  );
}

export function Chips<T extends string>({ opciones, valor, onChange }: { opciones: { id: T; texto: string; marcado?: boolean }[]; valor: T | null; onChange: (v: T) => void }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {opciones.map((o) => (
        <Pressable key={o.id} onPress={() => onChange(o.id)}
          className={`min-h-[44px] justify-center rounded-xl border px-4 ${valor === o.id ? 'border-lana-700 bg-lana-700' : 'border-neutral-300 bg-white'}`}>
          <View className="flex-row items-center gap-1">
            {o.marcado ? <Check size={16} color={valor === o.id ? '#fff' : TEMA.lana['700']} /> : null}
            <Text className={`text-base ${valor === o.id ? 'text-lana-50' : 'text-lana-800'}`}>{o.texto}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const COLOR_BADGE: Record<string, string> = {
  verde: 'bg-ok', ok: 'bg-ok', amarillo: 'bg-alerta', alerta: 'bg-alerta', rojo: 'bg-peligro', peligro: 'bg-peligro', gris: 'bg-lana-900',
};
export const Badge = ({ texto, tono = 'gris' }: { texto: string; tono?: string }) => (
  <View className={`self-start rounded-full px-3 py-1 ${COLOR_BADGE[tono] ?? 'bg-lana-700'}`}>
    <Text className="text-sm font-medium text-white">{texto}</Text>
  </View>
);

export const Cargando = () => <ActivityIndicator size="large" color={colores.primario} style={{ marginTop: 48 }} />;
export const Vacio = ({ texto }: { texto: string }) => <Text className="py-10 text-center text-base text-lana-800">{texto}</Text>;
export const ErrorMsg = ({ texto }: { texto: string | null }) =>
  texto ? <Text className="rounded-xl bg-peligro/10 p-3 text-base text-peligro">{texto}</Text> : null;

export const Fila = ({ a, b }: { a: string; b: React.ReactNode }) => (
  <View className="flex-row items-center justify-between py-1">
    <Text className="text-base text-lana-800">{a}</Text>
    <Text className="ml-3 flex-shrink text-right text-base font-medium text-lana-900">{b}</Text>
  </View>
);

/** Carga datos al enfocar la pantalla. `cacheKey` => guarda copia local (solo datos NO personales) para uso sin conexión. */
export function useDatos<T>(fn: () => Promise<T>, cacheKey?: string) {
  const [data, setData] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fn();
      setData(r); setError(null); setOffline(false);
      if (cacheKey) AsyncStorage.setItem(`cache:${cacheKey}`, JSON.stringify(r)).catch(() => {});
    } catch (e: any) {
      if (cacheKey) {
        const c = await AsyncStorage.getItem(`cache:${cacheKey}`).catch(() => null);
        if (c) { setData(JSON.parse(c)); setOffline(true); setError(null); setCargando(false); return; }
      }
      setError(e?.message ? 'No se pudieron cargar los datos.' : 'Error');
    } finally { setCargando(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  useFocusEffect(useCallback(() => { recargar(); }, [recargar]));
  return { data, cargando, error, offline, recargar };
}

/** Encabezado común de las vistas: "<" sutil (si se puede volver), título y breve descripción. */
export function Encabezado({ titulo, descripcion, atras = false }: { titulo: string; descripcion: string; atras?: boolean }) {
  const router = useRouter();
  return (
    <View className="gap-0.5">
      {atras && (
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={12} accessibilityRole="button" accessibilityLabel="Volver"
                   className="-ml-2 mb-1 h-9 w-9 items-center justify-center">
          <ChevronLeft size={26} color={TEMA.lana['500']} strokeWidth={2.5} />
        </Pressable>
      )}
      <Text className="text-2xl font-bold text-lana-900">{titulo}</Text>
      <Text className="text-sm text-lana-800">{descripcion}</Text>
    </View>
  );
}

/** Campo de búsqueda con lupa (sin etiqueta encima). */
export function Buscador({ value, onChangeText, placeholder = 'Buscar…' }: { value: string; onChangeText: (v: string) => void; placeholder?: string }) {
  return (
    <View className="min-h-[48px] flex-1 flex-row items-center gap-2 rounded-xl border border-neutral-300 bg-white px-4">
      <Search size={18} color={TEMA.lana['500']} />
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={TEMA.lana['400']} accessibilityLabel={placeholder}
                 style={{ fontFamily: 'Poppins_400Regular' }} className="flex-1 text-base text-lana-900" />
    </View>
  );
}
