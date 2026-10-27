import { useState } from 'react';
import { Alert, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { CheckCircle2, Fingerprint, KeyRound, ShieldCheck, Smartphone, Snowflake, XCircle } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { API_URL } from '@/lib/config';
import { type Overview } from '@/lib/pay';
import { C } from '@/lib/theme';
import { Button, Card, ErrorText, IconTile, Input, List, Loading, Row, Screen, Section, T } from '@/components/ui';
import { useRouter } from 'expo-router';

export default function Security() {
  const router = useRouter();
  const { data: o, error, refreshing, reload, refetch } = useApi<Overview>('/api/pay/overview');
  const [pin, setPin] = useState({ a: '', b: '', code: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!o) return <Screen edges={[]}>{error ? <ErrorText text={error} /> : <Loading />}</Screen>;
  const mark = (ok: boolean) => (ok ? <CheckCircle2 color={C.green} size={20} /> : <XCircle color={C.red} size={20} />);
  const savePin = async () => {
    if (pin.a !== pin.b) { setErr("The two PINs don't match."); return; }
    setBusy(true); setErr(null);
    try { await api('/api/pay/pin', { body: { pin: pin.a, code: pin.code } }); setPin({ a: '', b: '', code: '' }); refetch(); Alert.alert('PIN saved'); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const freeze = () => Alert.alert('Freeze everything?', 'No money can leave and your cards stop working right away. Support will verify it is you to unfreeze.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Freeze', style: 'destructive', onPress: async () => { try { await api('/api/pay/security/freeze', { body: {} }); refetch(); } catch (e) { Alert.alert('Not frozen', (e as Error).message); } } }]);
  return (
    <Screen edges={[]} refreshing={refreshing} onRefresh={reload}>
      <List>
        <Row title="Two-step sign-in" sub={o.profile.twoStep ? 'On' : 'Required to move money'} icon={<IconTile tone="blue"><Smartphone color={C.blue} size={18} /></IconTile>} right={mark(o.profile.twoStep)} onPress={o.profile.twoStep ? undefined : () => WebBrowser.openBrowserAsync(`${API_URL}/pay/security`)} chevron={!o.profile.twoStep} />
        <Row title="Identity verified" sub={o.profile.kycStatus === 'VERIFIED' ? 'Verified' : 'ID and selfie, about two minutes'} icon={<IconTile tone="violet"><Fingerprint color={C.violet} size={18} /></IconTile>} right={mark(o.profile.kycStatus === 'VERIFIED')} onPress={() => router.push('/verify')} chevron />
        <Row title="Payment PIN" sub={o.profile.pinSet ? 'Set' : 'Not set yet'} icon={<IconTile tone="green"><KeyRound color={C.green} size={18} /></IconTile>} right={mark(o.profile.pinSet)} />
      </List>
      <Section title={o.profile.pinSet ? 'Change PIN' : 'Create your PIN'}>
        <Card style={{ gap: 12 }}>
          <Input label="New 6-digit PIN" value={pin.a} onChangeText={(v) => setPin({ ...pin, a: v.replace(/\D/g, '').slice(0, 6) })} keyboardType="number-pad" secureTextEntry maxLength={6} />
          <Input label="Type it again" value={pin.b} onChangeText={(v) => setPin({ ...pin, b: v.replace(/\D/g, '').slice(0, 6) })} keyboardType="number-pad" secureTextEntry maxLength={6} />
          {o.profile.twoStep && <Input label="Authenticator code" value={pin.code} onChangeText={(v) => setPin({ ...pin, code: v.trim() })} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={11} />}
          <ErrorText text={err} />
          <Button title="Save PIN" variant="primary" loading={busy} disabled={pin.a.length !== 6 || pin.b.length !== 6 || (o.profile.twoStep && pin.code.length < 6)} onPress={savePin} />
        </Card>
      </Section>
      <Card style={{ gap: 10, borderColor: '#FFD6DF' }}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><Snowflake color={C.red} size={20} /><T v="heading">Freeze everything</T></View>
        <T v="small" color={C.muted}>Lost your phone or see something you didn't do? Stops all payments and pauses every card instantly.</T>
        <Button title={o.profile.frozen ? 'Account frozen' : 'Freeze now'} variant="danger" disabled={o.profile.frozen} onPress={freeze} />
      </Card>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><ShieldCheck color={C.green} size={16} /><T v="small" color={C.muted}>We never ask for your password, PIN or codes.</T></View>
    </Screen>
  );
}
