import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Plus, Receipt, Repeat } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { money, newKey, nextStep, type Overview } from '@/lib/pay';
import { C, F } from '@/lib/theme';
import { Button, Card, EmptyState, IconTile, Input, List, Loading, Row, Screen, Section, T } from '@/components/ui';
import { Status } from '@/components/pay-ui';
import { DateField } from '@/components/date-field';
import { Line, MoneySheet } from '@/components/pin-sheet';

type Biller = { id: string; name: string; category: string; accountLabel: string; accountHint: string | null };
type Payee = { id: string; nickname: string | null; label: string; biller: { name: string } };
type Payment = { id: string; amountCents: number; currency: string; status: string; scheduledFor: string; repeat: string | null; confirmation: string | null; payee: { label: string; nickname: string | null } };
const today = () => new Date().toISOString().slice(0, 10);
const d = (s: string) => new Date(s).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

export default function Bills() {
  const { data: o } = useApi<Overview>('/api/pay/overview');
  const { data, refreshing, reload, refetch } = useApi<{ billers: Biller[]; payees: Payee[]; payments: Payment[]; feeCents: number }>('/api/pay/bills');
  const [adding, setAdding] = useState(false);
  const [nb, setNb] = useState({ billerId: '', account: '', nickname: '' });
  const [pay, setPay] = useState<Payee | null>(null);
  const [amount, setAmount] = useState('');
  const [when, setWhen] = useState(today());
  const [monthly, setMonthly] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [key, setKey] = useState(newKey);
  if (!data || !o) return <Screen edges={[]}><Loading /></Screen>;
  const cents = Math.round(Number(amount || 0) * 100);
  const biller = data.billers.find((b) => b.id === nb.billerId);
  return (
    <Screen edges={[]} refreshing={refreshing} onRefresh={reload}>
      {!data.payees.length ? <EmptyState icon={<Receipt color={C.muted} size={26} />} title="Add your first bill" text="Pick the company and enter the account number from your bill." action={<Button title="Add a biller" variant="primary" onPress={() => setAdding(true)} />} /> : <>
        <List>{data.payees.map((p) => <Row key={p.id} title={p.nickname ?? p.biller.name} sub={p.label} icon={<IconTile><Receipt color={C.blue} size={18} /></IconTile>} right={<Button small variant="primary" title="Pay" disabled={!!nextStep(o)} onPress={() => { setPay(p); setAmount(''); setWhen(today()); setMonthly(false); }} />} />)}</List>
        <Button title="Add a biller" icon={<Plus color={C.ink} size={18} />} onPress={() => setAdding(true)} />
      </>}
      {data.payments.length > 0 && <Section title="Payments"><List>{data.payments.map((p) => (
        <Row key={p.id} title={`${money(p.amountCents, p.currency)} · ${p.payee.nickname ?? p.payee.label}`} sub={`${d(p.scheduledFor)}${p.repeat ? ' · every month' : ''}${p.confirmation ? ` · #${p.confirmation}` : ''}`} right={p.status === 'SCHEDULED' ? <Button small title="Cancel" onPress={() => api(`/api/pay/bills/${p.id}`, { method: 'DELETE' }).then(refetch, (e) => Alert.alert('Error', e.message))} /> : <Status status={p.status} />} />
      ))}</List></Section>}

      <Modal visible={adding} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAdding(false)}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
          <T v="title">Add a biller</T>
          <View style={st.grid}>{data.billers.map((b) => <Pressable key={b.id} onPress={() => setNb({ ...nb, billerId: b.id })} style={[st.chip, nb.billerId === b.id && st.chipOn]}><T v="small" color={nb.billerId === b.id ? '#fff' : C.ink} style={{ fontFamily: F.semi }}>{b.name}</T></Pressable>)}</View>
          {biller && <Input label={biller.accountLabel} value={nb.account} onChangeText={(v) => setNb({ ...nb, account: v })} placeholder={biller.accountHint ?? "It's on your bill"} />}
          <Input label="Nickname (optional)" value={nb.nickname} onChangeText={(v) => setNb({ ...nb, nickname: v })} placeholder="Home hydro" />
          <Button title="Save" variant="primary" big disabled={!nb.billerId || nb.account.length < 4} onPress={async () => { try { await api('/api/pay/bills/payees', { body: { ...nb, nickname: nb.nickname || undefined } }); setAdding(false); setNb({ billerId: '', account: '', nickname: '' }); refetch(); } catch (e) { Alert.alert('Not saved', (e as Error).message); } }} />
          <Button title="Cancel" variant="ghost" onPress={() => setAdding(false)} />
        </ScrollView>
      </Modal>

      <Modal visible={!!pay && !confirm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPay(null)}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
          <T v="title">Pay {pay?.nickname ?? pay?.biller.name}</T>
          <Input label="Amount" value={amount} onChangeText={(v) => setAmount(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder="0.00" style={{ fontFamily: F.displayBold, fontSize: 28 }} />
          <DateField label="Pay on" value={when} min={today()} onChange={setWhen} />
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Repeat color={C.blue} size={18} /><T v="bodyStrong" style={{ flex: 1 }}>Repeat every month</T><Switch value={monthly} onValueChange={setMonthly} /></Card>
          <Button title="Review" variant="primary" big disabled={cents < 100} onPress={() => setConfirm(true)} />
          <Button title="Cancel" variant="ghost" onPress={() => setPay(null)} />
        </ScrollView>
      </Modal>
      <MoneySheet visible={confirm} title="Confirm bill payment" onClose={() => setConfirm(false)} summary={pay && <><Line k="To" v={pay.label} /><Line k="Amount" v={money(cents, o.currency)} /><Line k="Date" v={when === today() ? 'Today' : d(when)} />{monthly && <Line k="Repeats" v="Every month" />}</>}
        run={async (pin, code) => { await api('/api/pay/bills', { body: { payeeId: pay?.id, amountCents: cents, date: when, repeat: monthly ? 'MONTHLY' : null, pin, code, idempotencyKey: key } }); setConfirm(false); setPay(null); setKey(newKey()); refetch(); }} />
    </Screen>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
});
