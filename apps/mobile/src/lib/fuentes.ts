import { cloneElement } from 'react';
import { StyleSheet, Text } from 'react-native';

// Se cargan solo estos 4 pesos (archivos .ttf) y no las 18 variantes del paquete.
export const FUENTES_POPPINS = {
  Poppins_400Regular: require('@expo-google-fonts/poppins/Poppins_400Regular.ttf'),
  Poppins_500Medium: require('@expo-google-fonts/poppins/Poppins_500Medium.ttf'),
  Poppins_600SemiBold: require('@expo-google-fonts/poppins/Poppins_600SemiBold.ttf'),
  Poppins_700Bold: require('@expo-google-fonts/poppins/Poppins_700Bold.ttf'),
};

const POR_PESO: Record<string, string> = {
  normal: 'Poppins_400Regular', '400': 'Poppins_400Regular',
  '500': 'Poppins_500Medium',
  '600': 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold', '700': 'Poppins_700Bold', '800': 'Poppins_700Bold', '900': 'Poppins_700Bold',
};

let aplicado = false;

/**
 * En Android cada peso de una fuente personalizada es un archivo distinto: `font-bold` no basta.
 * Se envuelve el render de <Text> para elegir el archivo Poppins según el peso pedido (font-medium, font-bold…).
 */
export function aplicarPoppinsGlobal() {
  if (aplicado) return;
  aplicado = true;
  const T = Text as any;
  const original = T.render;
  if (typeof original !== 'function') return;
  T.render = function (...args: unknown[]) {
    const el = original.apply(this, args);
    const plano = StyleSheet.flatten(el.props.style) ?? {};
    if (plano.fontFamily && !String(plano.fontFamily).startsWith('Poppins')) return el; // respeta otras fuentes
    const familia = POR_PESO[String(plano.fontWeight ?? '400')] ?? 'Poppins_400Regular';
    return cloneElement(el, { style: [el.props.style, { fontFamily: familia, fontWeight: 'normal' }] });
  };
}
