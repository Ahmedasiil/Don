import { P } from '@/components/pay-ui';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ShieldCheck } from 'lucide-react-native';
import { api } from '@/lib/api';
import { C, F } from '@/lib/theme';
import { Button, ErrorText, Input, Screen, T } from '@/components/ui';

export default function TopUp() {
  const router = useRouter();
  const [amount, setAmount] = useState('100');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await api<{ url: string }>('/api/pay/topup', { body: { amountCents: Math.round(Number(amount) * 100), returnPath: '/app' } });
      await WebBrowser.openBrowserAsync(r.url);
      router.back();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Screen edges={[]}>
      <Input label="Amount" value={amount} onChangeText={(v) => setAmount(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" style={{ fontFamily: F.displayBold, fontSize: 32 }} />
      <View style={st.row}>{['50', '100', '250', '500'].map((a) => <Pressable key={a} onPress={() => setAmount(a)} style={[st.chip, amount === a && st.chipOn]}><Text style={[st.chipText, amount === a && { color: '#fff' }]}>{a}</Text></Pressable>)}</View>
      <ErrorText text={err} />
      <Button title="Continue to secure payment" variant="primary" big loading={busy} onPress={go} />
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><ShieldCheck color={C.green} size={16} /><T v="small" color={C.muted}>Card details go straight to Stripe. oenodpay never sees them.</T></View>
    </Screen>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, height: 44, borderRadius: 14, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper },
  chipOn: { backgroundColor: P.ink, borderColor: P.ink },
  chipText: { fontFamily: F.semi, fontSize: 15, color: C.ink },
});
