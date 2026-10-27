import { Alert, Share, Text, View } from 'react-native';
import { Copy, Gift } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { ago, money } from '@/lib/pay';
import { C, F } from '@/lib/theme';
import { Button, Card, List, Loading, Row, Screen, Section, T } from '@/components/ui';
import { Label, PayHero, Status } from '@/components/pay-ui';

type R = { currency: string; availableCents: number; pendingCents: number; earnedCents: number; cashbackBps: number; referralBonusCents: number; code: string; invited: number; inviteUrl: string; rows: { id: string; cents: number; status: string; memo: string | null; kind: string; createdAt: string }[] };

export default function Rewards() {
  const { data: r, refreshing, reload, refetch } = useApi<R>('/api/pay/rewards');
  if (!r) return <Screen edges={[]}><Loading /></Screen>;
  return (
    <Screen edges={[]} refreshing={refreshing} onRefresh={reload}>
      <PayHero>
        <Label color="rgba(255,255,255,0.55)">Ready to use</Label>
        <Text style={{ fontFamily: F.display, fontSize: 40, color: '#fff', letterSpacing: -1 }}>{money(r.availableCents, r.currency)}</Text>
        <T v="small" color="rgba(255,255,255,0.65)">{money(r.pendingCents, r.currency)} on the way · {money(r.earnedCents, r.currency)} earned</T>
        <Button title="Move to wallet" variant="light" disabled={r.availableCents <= 0} onPress={async () => { try { const x = await api<{ cents: number }>('/api/pay/rewards', { body: {} }); Alert.alert(`${money(x.cents, r.currency)} moved to your wallet`); refetch(); } catch (e) { Alert.alert('Not moved', (e as Error).message); } }} />
      </PayHero>
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><Gift color={C.blue} size={20} /><T v="heading" style={{ flex: 1 }}>Invite friends, get {money(r.referralBonusCents, r.currency)}</T></View>
        <T v="small">When a friend joins with your link and adds money, you both get {money(r.referralBonusCents, r.currency)}. {r.invited} joined so far. Your code: {r.code}</T>
        <Button title="Share my invite" variant="primary" icon={<Copy color="#fff" size={16} />} onPress={() => Share.share({ message: `Join me on oenodpay and we both get ${money(r.referralBonusCents, r.currency)}: ${r.inviteUrl}` })} />
      </Card>
      <T v="small">{r.cashbackBps / 100}% cash back on every card purchase. It clears after a few days.</T>
      <Section title="History">{r.rows.length ? <List>{r.rows.map((x) => <Row key={x.id} title={`${x.cents > 0 ? '+' : ''}${money(x.cents, r.currency)} · ${x.memo ?? x.kind}`} sub={ago(x.createdAt)} right={<Status status={x.status === 'AVAILABLE' ? 'ACTIVE' : x.status} />} />)}</List> : <T v="small">Use your card or invite a friend to start earning.</T>}</Section>
    </Screen>
  );
}
