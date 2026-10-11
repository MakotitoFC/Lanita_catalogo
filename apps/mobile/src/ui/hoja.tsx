import { useEffect, useRef } from 'react';
import { Animated, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { TEMA } from '@lanita/shared';

/** Hoja inferior (bottom sheet): sube desde abajo, tiene barra de arrastre ("handle") y una X para cerrar. */
export function Hoja({ visible, onClose, titulo, children, compacta = false, sinRelleno = false }: { visible: boolean; onClose: () => void; titulo: string; children: React.ReactNode; compacta?: boolean; sinRelleno?: boolean }) {
  const y = useRef(new Animated.Value(0)).current;
  const cerrarRef = useRef(onClose);
  cerrarRef.current = onClose;

  useEffect(() => { if (visible) y.setValue(0); }, [visible, y]);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, g) => { if (g.dy > 0) y.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 110 || g.vy > 0.9) Animated.timing(y, { toValue: 900, duration: 180, useNativeDriver: true }).start(() => cerrarRef.current());
      else Animated.spring(y, { toValue: 0, useNativeDriver: true }).start();
    },
  })).current;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 justify-end bg-black/60">
        <Pressable className="absolute inset-0" onPress={onClose} accessibilityLabel="Cerrar" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={compacta ? undefined : { height: '92%' }}>
          <Animated.View style={{ transform: [{ translateY: y }], ...(compacta ? {} : { flex: 1 }) }} className="overflow-hidden rounded-t-3xl bg-white">
            <View {...pan.panHandlers} className="items-center pt-2">
              <View className="h-1.5 w-12 rounded-full bg-lana-300" />
              <View className="w-full flex-row items-center justify-between px-5 pb-2 pt-3">
                <Text className="text-xl font-bold text-lana-900">{titulo}</Text>
                <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar" className="h-10 w-10 items-center justify-center rounded-full bg-lana-200">
                  <X size={20} color={TEMA.lana['800']} />
                </Pressable>
              </View>
              <View className="h-px w-full bg-neutral-200" />
            </View>
            <ScrollView style={compacta ? { flexGrow: 0 } : undefined} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingTop: 14, paddingBottom: sinRelleno ? 16 : 48, gap: 12 }}>
              {children}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/**
 * Pantalla de registro (producto, insumo, molde, promoción…): se abre como hoja inferior con barra de arrastre y X.
 * Es una ruta "transparentModal": al cerrar se vuelve a la pantalla anterior.
 */
export function HojaRuta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const router = useRouter();
  const y = useRef(new Animated.Value(700)).current;
  const cerrarRef = useRef(() => {});
  cerrarRef.current = () => { if (router.canGoBack()) router.back(); else router.replace('/'); };

  useEffect(() => { Animated.timing(y, { toValue: 0, duration: 260, useNativeDriver: true }).start(); }, [y]);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, g) => { if (g.dy > 0) y.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 110 || g.vy > 0.9) Animated.timing(y, { toValue: 900, duration: 180, useNativeDriver: true }).start(() => cerrarRef.current());
      else Animated.spring(y, { toValue: 0, useNativeDriver: true }).start();
    },
  })).current;

  return (
    <View className="flex-1 justify-end bg-black/60">
      <Pressable className="absolute inset-0" onPress={() => cerrarRef.current()} accessibilityLabel="Cerrar" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ height: '92%' }}>
        <Animated.View style={{ transform: [{ translateY: y }], flex: 1 }} className="overflow-hidden rounded-t-3xl bg-white">
          <View {...pan.panHandlers} className="items-center pt-2">
            <View className="h-1.5 w-12 rounded-full bg-lana-300" />
            <View className="w-full flex-row items-center justify-between px-5 pb-2 pt-3">
              <Text numberOfLines={1} className="flex-1 pr-3 text-xl font-bold text-lana-900">{titulo}</Text>
              <Pressable onPress={() => cerrarRef.current()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar" className="h-10 w-10 items-center justify-center rounded-full bg-lana-200">
                <X size={20} color={TEMA.lana['800']} />
              </Pressable>
            </View>
            <View className="h-px w-full bg-neutral-200" />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingTop: 14, paddingBottom: 48, gap: 12 }}>
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}
