import { useState } from 'react';
import { Animated, Image, View, type ImageProps, type StyleProp, type ViewStyle } from 'react-native';

// Un solo pulso compartido por todos los bloques (barato y sincronizado).
const pulso = new Animated.Value(0.45);
Animated.loop(Animated.sequence([
  Animated.timing(pulso, { toValue: 1, duration: 700, useNativeDriver: true }),
  Animated.timing(pulso, { toValue: 0.45, duration: 700, useNativeDriver: true }),
])).start();

/** Bloque gris que pulsa mientras llegan los datos. */
export function Bloque({ className = '', style }: { className?: string; style?: StyleProp<ViewStyle> }) {
  return <Animated.View style={[{ opacity: pulso }, style]} className={`bg-neutral-200 ${className}`} />;
}

/** Foto con esqueleto: se ve el bloque pulsando hasta que la imagen termina de cargar. */
export function Foto({ uri, className = '', ...resto }: { uri: string; className?: string } & Omit<ImageProps, 'source'>) {
  const [lista, setLista] = useState(false);
  return (
    <View className={`overflow-hidden ${className}`}>
      {!lista && <Bloque className="absolute inset-0" />}
      <Image {...resto} source={{ uri }} className="h-full w-full" onLoad={() => setLista(true)} onError={() => setLista(true)} />
    </View>
  );
}

/** Tarjeta de lista (encabezado, foto + dos líneas, pie con precio). */
export function TarjetaEsqueleto() {
  return (
    <View className="overflow-hidden rounded-3xl border border-neutral-300 bg-white">
      <View className="border-b border-neutral-200 px-4 py-3"><Bloque className="h-4 w-1/3 rounded-md" /></View>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Bloque className="h-14 w-14 rounded-2xl" />
        <View className="flex-1 gap-2"><Bloque className="h-4 w-3/4 rounded-md" /><Bloque className="h-3 w-1/2 rounded-md" /></View>
      </View>
      <View className="mx-4 flex-row items-center justify-between border-t border-neutral-200 py-3">
        <Bloque className="h-3 w-16 rounded-md" /><Bloque className="h-5 w-20 rounded-md" />
      </View>
    </View>
  );
}

export function ListaEsqueleto({ n = 4 }: { n?: number }) {
  return <View className="gap-3">{Array.from({ length: n }, (_, i) => <TarjetaEsqueleto key={i} />)}</View>;
}

/** Filas simples dentro de un cuadro (pedidos, gastos). */
export function FilasEsqueleto({ n = 4 }: { n?: number }) {
  return (
    <View className="overflow-hidden rounded-2xl border border-neutral-300 bg-white">
      {Array.from({ length: n }, (_, i) => (
        <View key={i} className={`flex-row items-center gap-3 px-4 py-4 ${i > 0 ? 'border-t border-neutral-200' : ''}`}>
          <View className="flex-1 gap-2"><Bloque className="h-4 w-2/3 rounded-md" /><Bloque className="h-3 w-1/2 rounded-md" /></View>
          <Bloque className="h-5 w-16 rounded-md" />
        </View>
      ))}
    </View>
  );
}

/** Inicio: cuatro indicadores y un cuadro de lista. */
export function InicioEsqueleto() {
  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap gap-3">
        {[0, 1, 2, 3].map((i) => (
          <View key={i} className="min-w-[46%] flex-1 gap-3 rounded-2xl bg-neutral-100 p-4">
            <View className="flex-row items-center gap-2"><Bloque className="h-11 w-11 rounded-xl" /><Bloque className="h-6 flex-1 rounded-md" /></View>
            <Bloque className="h-3 w-2/3 rounded-md" />
          </View>
        ))}
      </View>
      <FilasEsqueleto n={3} />
    </View>
  );
}

/** Ticket del pedido mientras carga. */
export function TicketEsqueleto() {
  return (
    <View className="gap-3 rounded-3xl border border-neutral-300 bg-white p-5">
      <View className="items-center gap-2"><Bloque className="h-4 w-1/2 rounded-md" /><Bloque className="h-6 w-2/3 rounded-md" /></View>
      {[0, 1, 2, 3, 4].map((i) => <Bloque key={i} className="h-4 w-full rounded-md" />)}
      <Bloque className="h-7 w-full rounded-md" />
    </View>
  );
}

/** Cuadrícula de productos (2 columnas) mientras cargan las fotos. */
export function CuadriculaEsqueleto({ n = 4 }: { n?: number }) {
  return (
    <View className="flex-row flex-wrap justify-between gap-y-3">
      {Array.from({ length: n }, (_, i) => (
        <View key={i} className="w-[48.5%] rounded-3xl bg-[#f2f2f2] p-2">
          <Bloque className="aspect-square rounded-2xl" />
          <Bloque className="mt-3 h-4 w-3/4 rounded-md" />
          <Bloque className="mt-2 h-4 w-1/3 rounded-md" />
        </View>
      ))}
    </View>
  );
}
