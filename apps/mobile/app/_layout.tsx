import '../global.css';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';
import { useFonts } from 'expo-font';
import { aplicarPoppinsGlobal, FUENTES_POPPINS } from '@/lib/fuentes';
import { AuthProvider, useAuth } from '@/lib/auth';
import { sincronizarCola } from '@/lib/cola';
import { Cargando } from '@/ui';
import { TEMA } from '@lanita/shared';

function Puerta() {
  const { session, perfil, cargando } = useAuth();
  const [fuentesListas] = useFonts(FUENTES_POPPINS);
  useEffect(() => { if (fuentesListas) aplicarPoppinsGlobal(); }, [fuentesListas]);
  const segmentos = useSegments();
  const enLogin = segmentos[0] === 'login';

  // Sincroniza borradores offline cuando vuelve la conexión.
  useEffect(() => {
    if (!perfil) return;
    const off = NetInfo.addEventListener((s) => { if (s.isConnected) sincronizarCola().catch(() => {}); });
    return off;
  }, [perfil]);

  // La navegación se monta SIEMPRE primero; la redirección ocurre después (si no, Expo Router da error).
  const router = useRouter();
  const listo = !cargando && fuentesListas;
  const irALogin = listo && (!session || !perfil) && !enLogin;
  const irAInicio = listo && !!session && !!perfil && enLogin;
  useEffect(() => {
    if (irALogin) router.replace('/login');
    else if (irAInicio) router.replace('/');
  }, [irALogin, irAInicio, router]);
  const tapar = !listo || irALogin || irAInicio;   // pantalla de carga mientras se decide a dónde ir

  return (
    <>
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: TEMA.lana['800'],
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: '#ffffff' },
        headerShadowVisible: false,
        headerShown: false,   // cada vista dibuja su propio encabezado (título, descripción y "<")
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="producto/[id]" options={{ presentation: 'transparentModal', animation: 'fade', headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />
      <Stack.Screen name="promocion/[id]" options={{ presentation: 'transparentModal', animation: 'fade', headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />
    </Stack>
    {tapar && (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#ffffff' }]}>
        <Cargando />
      </View>
    )}
    </>
  );
}

export default function Raiz() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Puerta />
    </AuthProvider>
  );
}
