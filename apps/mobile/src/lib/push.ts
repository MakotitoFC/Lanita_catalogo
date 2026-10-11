import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: false, shouldSetBadge: false }),
});

/** Registra el token push del dispositivo para el usuario logueado (los textos nunca llevan datos de clientes). */
export async function registrarPush() {
  if (!Device.isDevice) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'Avisos', importance: Notifications.AndroidImportance.DEFAULT });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return;
  const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId;
  if (!projectId || String(projectId).startsWith('REEMPLAZAR')) return;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await supabase.rpc('registrar_dispositivo_push', { p_token: token, p_plataforma: Platform.OS === 'ios' ? 'ios' : 'android' });
}
