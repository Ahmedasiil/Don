import { useState } from 'react';
import { Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { API_URL } from '@/lib/config';
import { t } from '@/lib/i18n';
import { C, F, G } from '@/lib/theme';
import { Button, ErrorText, Input, T } from '@/components/ui';

export default function SignIn() {
  const { signIn, verify2fa } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const go = async () => {
    setErr(null); setBusy(true);
    try {
      if (challenge) await verify2fa(challenge, code.trim());
      else { const r = await signIn(email.trim(), password); if (r.challenge) setChallenge(r.challenge); }
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.navy }}>
      <LinearGradient colors={G.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[s.ring, { width: 420, height: 420, top: -160, right: -180 }]} />
      <View pointerEvents="none" style={[s.ring, { width: 280, height: 280, top: -80, right: -100 }]} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between' }} keyboardShouldPersistTaps="handled" bounces={false}>
            <View style={s.hero}>
              <Image source={require('../../assets/logo-white.png')} style={s.logo} resizeMode="contain" accessibilityLabel="oenodpay" />
              <Text style={s.headline}>Your work,{'\n'}in your pocket.</Text>
              <Text style={s.tag}>Shifts, hours, pay and your team, all in one place.</Text>
            </View>
            <View style={s.sheet}>
              <View style={s.grabber} />
              <View style={{ gap: 4 }}>
                <T v="display" style={{ fontSize: 26 }}>{challenge ? t('auth.twoFactorTitle') : t('auth.signInTitle')}</T>
                <T v="small" style={{ fontSize: 14.5 }}>{challenge ? t('auth.twoFactorSub') : t('auth.signInSub')}</T>
              </View>
              {challenge ? (
                <Input label="Code" icon={<KeyRound color={C.muted} size={18} />} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={12} autoFocus onSubmitEditing={go} style={{ letterSpacing: 8, fontSize: 20, fontFamily: F.bold }} />
              ) : (
                <>
                  <Input label={t('auth.email')} icon={<Mail color={C.muted} size={18} />} placeholder="you@email.com" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="username" returnKeyType="next" />
                  <Input label={t('auth.password')} icon={<Lock color={C.muted} size={18} />} placeholder="••••••••••" value={password} onChangeText={setPassword} secureTextEntry={!show} autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={go}
                    right={<Pressable accessibilityRole="button" accessibilityLabel={show ? 'Hide password' : 'Show password'} onPress={() => setShow(!show)} hitSlop={10}>{show ? <EyeOff color={C.muted} size={19} /> : <Eye color={C.muted} size={19} />}</Pressable>} />
                </>
              )}
              <ErrorText text={err} />
              <Button title={challenge ? t('common.next') : t('nav.signIn')} variant="primary" big loading={busy} disabled={challenge ? code.trim().length < 6 : !email || !password} onPress={go} />
              {challenge
                ? <Button title={t('common.back')} variant="ghost" onPress={() => { setChallenge(null); setCode(''); }} />
                : <Button title={t('auth.forgot')} variant="ghost" onPress={() => Linking.openURL(`${API_URL}/forgot`)} />}
              <View style={s.secure}>
                <ShieldCheck color={C.green} size={15} />
                <T v="caption">Encrypted sign-in · two-step verification supported</T>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  ring: { position: 'absolute', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  hero: { paddingHorizontal: 28, paddingTop: 36, paddingBottom: 32, gap: 14 },
  logo: { width: 150, height: 44, marginBottom: 18 },
  headline: { color: '#fff', fontFamily: F.display, fontSize: 34, lineHeight: 40, letterSpacing: -1 },
  tag: { color: C.onNavy, fontSize: 15.5, lineHeight: 23, fontFamily: F.regular, maxWidth: 300 },
  sheet: { backgroundColor: C.paper, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 36, gap: 16 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 6 },
  secure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 2 },
});
