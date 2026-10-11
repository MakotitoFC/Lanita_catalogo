import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react-native';
import { loginSchema, TEMA } from '@lanita/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Boton, ErrorMsg } from '@/ui';

export default function Login() {
  const { sinAcceso } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function entrar() {
    const v = loginSchema.safeParse({ email, password });
    if (!v.success) return setError('Revisa el correo y la contraseña.');
    setCargando(true); setError(null);
    const { error: e } = await supabase.auth.signInWithPassword({ email: v.data.email, password: v.data.password });
    setCargando(false);
    // Mensaje genérico: no revela si el correo existe.
    if (e) setError('Correo o contraseña incorrectos.');
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-white">
      {/* Marca de agua: logo grande y tenue de fondo */}
      <View pointerEvents="none" style={{ position: 'absolute', bottom: -60, right: -80 }}>
        <Image source={require('../assets/marca-agua.webp')} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no"
               style={{ width: 380, height: 380, opacity: 0.12 }} />
      </View>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} keyboardShouldPersistTaps="handled">
        <Text className="text-3xl font-bold text-lana-900">Bienvenido/a</Text>
        <Text className="mb-8 mt-2 text-base text-lana-800">Inicia sesión para administrar tu catálogo, pedidos y gastos.</Text>

        <View className="gap-4">
          <View className="gap-1">
            <Text className="text-sm font-medium text-lana-800">Correo</Text>
            <View className="min-h-[52px] flex-row items-center gap-2 rounded-xl border border-neutral-300 bg-white px-4">
              <Mail size={18} color={TEMA.lana['500']} />
              <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
                         textContentType="username" autoComplete="email" placeholder="tucorreo@ejemplo.com" placeholderTextColor={TEMA.lana['400']}
                         style={{ fontFamily: 'Poppins_400Regular' }} className="flex-1 text-base text-lana-900" />
            </View>
          </View>
          <View className="gap-1">
            <Text className="text-sm font-medium text-lana-800">Contraseña</Text>
            <View className="min-h-[52px] flex-row items-center gap-2 rounded-xl border border-neutral-300 bg-white pl-4 pr-1">
              <Lock size={18} color={TEMA.lana['500']} />
              <TextInput value={password} onChangeText={setPassword} secureTextEntry={!ver} autoCapitalize="none" textContentType="password"
                         autoComplete="current-password" onSubmitEditing={entrar} placeholder="Tu contraseña" placeholderTextColor={TEMA.lana['400']}
                         style={{ fontFamily: 'Poppins_400Regular' }} className="flex-1 text-base text-lana-900" />
              <Pressable onPress={() => setVer((v) => !v)} hitSlop={8} accessibilityRole="button" accessibilityLabel={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                         className="h-11 w-11 items-center justify-center">
                {ver ? <EyeOff size={20} color={TEMA.lana['700']} /> : <Eye size={20} color={TEMA.lana['700']} />}
              </Pressable>
            </View>
          </View>
          <ErrorMsg texto={error ?? (sinAcceso ? 'Tu usuario no tiene un rol activo. Contacta al administrador.' : null)} />
          <Boton titulo="Iniciar sesión" onPress={entrar} cargando={cargando} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
