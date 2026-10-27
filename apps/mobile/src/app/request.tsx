import { useState } from 'react';
import { Alert, View } from 'react-native';
import { HandCoins } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { ago, money } from '@/lib/pay';
import { C } from '@/lib/theme';
import { Button, Card, EmptyState, Input, List, Loading, Row, Screen, Segmented } from '@/components/ui';
import { Status } from '@/components/pay-ui';
import { Line, MoneySheet } from '@/components/pin-sheet';

type Req = { id: string; amountCents: number; currency: string; note: string | null; status: string; createdAt: string; person: { name: string } | null };

export default function RequestMoney() {
  const { data, refreshing, reload, refetch } = useApi<{ sent: Req[]; received: Req[] }>('/api/pay/requests');
  const [tab, setTab] = useState<'received' | 'sent'>('received');
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState<Req | null>(null);
  const cents = Math.round(Number(amount || 0) * 100);
  const ask = async () => {
    setBusy(true);
    try { await api('/api/pay/requests', { body: { email, amountCents: cents, note: note || undefined } }); setEmail(''); setAmount(''); setNote(''); setTab('sent'); refetch(); Alert.alert('Request sent'); }
    catch (e) { Alert.alert('Not sent', (e as Error).message); } finally { setBusy(false); }
  };
  const act = (r: Req, action: 'decline' | 'cancel') => api(`/api/pay/requests/${r.id}`, { body: { action } }).then(refetch, (e) => Alert.alert('Error', e.message));
  if (!data) return <Screen edges={[]}><Loading /></Screen>;
  const list = data[tab];
  return (
    <Screen edges={[]} refreshing={refreshing} onRefresh={reload}>
      <Card style={{ gap: 12 }}>
        <Input label="Their email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="friend@email.com" />
        <Input label="Amount" value={amount} onChangeText={(v) => setAmount(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder="0.00" />
        <Input label="What's it for?" value={note} onChangeText={setNote} maxLength={140} placeholder="Dinner on Friday" />
        <Button title="Send request" variant="primary" loading={busy} disabled={!email || cents < 100} onPress={ask} />
      </Card>
      <Segmented value={tab} onChange={setTab} options={[['received', 'Asked of you', data.received.filter((r) => r.status === 'PENDING').length], ['sent', 'You asked']] as const} />
      {!list.length ? <EmptyState icon={<HandCoins color={C.muted} size={26} />} title={tab === 'received' ? 'No one has asked you for money' : "You haven't asked anyone yet"} /> : (
        <List>{list.map((r) => (
          <View key={r.id}>
            <Row title={`${money(r.amountCents, r.currency)} ${tab === 'received' ? 'from' : 'to'} ${r.person?.name ?? 'someone'}`} sub={`${r.note ? `${r.note} · ` : ''}${ago(r.createdAt)}`} right={<Status status={r.status} />} />
            {r.status === 'PENDING' && <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}>
              {tab === 'received' ? <><Button small title="Decline" onPress={() => act(r, 'decline')} style={{ flex: 1 }} /><Button small variant="primary" title="Pay" onPress={() => setPay(r)} style={{ flex: 1 }} /></> : <Button small title="Cancel request" onPress={() => act(r, 'cancel')} style={{ flex: 1 }} />}
            </View>}
          </View>
        ))}</List>
      )}
      <MoneySheet visible={!!pay} title="Pay request" onClose={() => setPay(null)} summary={pay && <><Line k="To" v={pay.person?.name} /><Line k="Amount" v={money(pay.amountCents, pay.currency)} /></>}
        run={async (pin, code) => { await api(`/api/pay/requests/${pay?.id}`, { body: { action: 'pay', pin, code } }); setPay(null); refetch(); }} />
    </Screen>
  );
}
