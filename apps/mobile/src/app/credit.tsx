import { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, Text, View } from 'react-native';
import { Landmark } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { money, nextStep, type Overview } from '@/lib/pay';
import { C, F } from '@/lib/theme';
import { Button, Card, Chips, Input, Loading, Progress, Screen, Section, T } from '@/components/ui';
import { Label, PayHero, Status } from '@/components/pay-ui';
import { Line, MoneySheet } from '@/components/pin-sheet';

type Loan = { id: string; principalCents: number; termMonths: number; paymentCents: number; status: string; balanceCents: number; nextDueAt: string | null; decisionNote: string | null };
type Cr = { score: number; band: string; factors: { key: string; label: string; value: number; tip: string }[]; offer: { maxCents: number; aprBps: number; terms: number[] } | null; lendingOpen: boolean; loans: Loan[] };
const BAND: Record<string, string> = { EXCELLENT: 'Excellent', VERY_GOOD: 'Very good', GOOD: 'Good', FAIR: 'Fair', POOR: 'Building' };

export default function Credit() {
  const { data: o } = useApi<Overview>('/api/pay/overview');
  const { data: c, refreshing, reload, refetch } = useApi<Cr>('/api/pay/credit');
  const [apply, setApply] = useState(false);
  const [amount, setAmount] = useState('');
  const [term, setTerm] = useState('12');
  const [quote, setQuote] = useState<{ paymentCents: number | null; totalCents?: number } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [payLoan, setPayLoan] = useState<Loan | null>(null);
  const cents = Math.round(Number(amount || 0) * 100);
  useEffect(() => { if (!apply || cents < 50_000) { setQuote(null); return; } const t = setTimeout(() => api('/api/pay/credit?quote', { body: { amountCents: cents, termMonths: Number(term) } }).then(setQuote, () => setQuote(null)), 300); return () => clearTimeout(t); }, [apply, cents, term]);
  if (!c || !o) return <Screen edges={[]}><Loading /></Screen>;
  const open = c.loans.find((l) => ['REVIEW', 'APPROVED', 'ACTIVE'].includes(l.status));
  return (
    <Screen edges={[]} refreshing={refreshing} onRefresh={reload}>
      <PayHero>
        <Label color="rgba(255,255,255,0.55)">oenodpay score</Label>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}><Text style={{ fontFamily: F.display, fontSize: 52, color: '#fff', letterSpacing: -1.5 }}>{c.score}</Text><Text style={{ fontFamily: F.semi, color: 'rgba(255,255,255,0.6)' }}>/ 900 · {BAND[c.band] ?? c.band}</Text></View>
        <Progress value={(c.score - 300) / 6} color="#7CE3B1" track="rgba(255,255,255,0.12)" />
        <T v="caption" color="rgba(255,255,255,0.55)">Updates every day. Checking it never lowers it.</T>
      </PayHero>
      <Section title="What shapes it">
        <Card style={{ gap: 14 }}>{c.factors.map((f) => <View key={f.key} style={{ gap: 6 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T v="bodyStrong">{f.label}</T><T v="small">{f.value}/100</T></View><Progress value={f.value} color={f.value >= 70 ? C.green : f.value >= 40 ? C.blue : C.amber} /><T v="caption">{f.tip}</T></View>)}</Card>
      </Section>
      <Section title="Personal loan">
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><Landmark color={C.ink} size={20} /><T v="body" style={{ flex: 1 }}>{!c.lendingOpen ? 'Loans are opening soon. Keep building your score.' : open ? 'You have a loan open.' : c.offer ? `Borrow up to ${money(c.offer.maxCents, o.currency)} at ${(c.offer.aprBps / 100).toFixed(2)}% a year.` : 'Keep building your score to unlock a loan.'}</T></View>
          {c.offer && !open && <Button title="Check my offer" variant="primary" disabled={!!nextStep(o)} onPress={() => setApply(true)} />}
        </Card>
        {c.loans.map((l) => <Card key={l.id} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T v="bodyStrong">{money(l.principalCents, o.currency)} over {l.termMonths} months</T><Status status={l.status} /></View>
          <Line k="Monthly" v={money(l.paymentCents, o.currency)} /><Line k="Still owed" v={money(l.balanceCents, o.currency)} />
          {l.decisionNote && <T v="small">{l.decisionNote}</T>}
          {l.status === 'ACTIVE' && <><Progress value={(1 - l.balanceCents / l.principalCents) * 100} color={C.blue} /><Button small title="Pay now" onPress={() => setPayLoan(l)} /></>}
        </Card>)}
      </Section>

      <Modal visible={apply && !confirm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setApply(false)}>
        {c.offer && <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
          <T v="title">Your loan</T>
          <Input label={`How much? Up to ${money(c.offer.maxCents, o.currency)}`} value={amount} onChangeText={(v) => setAmount(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder="0.00" style={{ fontFamily: F.displayBold, fontSize: 28 }} />
          <Chips value={term} onChange={setTerm} options={c.offer.terms.map((t) => [String(t), `${t} months`] as const)} />
          {quote?.paymentCents ? <Card style={{ gap: 6 }}><Line k="Monthly payment" v={money(quote.paymentCents, o.currency)} /><Line k="Rate" v={`${(c.offer.aprBps / 100).toFixed(2)}% APR`} /><Line k="Total you'll repay" v={money(quote.totalCents, o.currency)} /></Card> : null}
          <T v="small">A person on our credit team reviews every application.</T>
          <Button title="Apply" variant="primary" big disabled={!quote?.paymentCents} onPress={() => setConfirm(true)} />
          <Button title="Cancel" variant="ghost" onPress={() => setApply(false)} />
        </ScrollView>}
      </Modal>
      <MoneySheet visible={confirm} title="Apply for loan" onClose={() => setConfirm(false)} summary={<><Line k="Amount" v={money(cents, o.currency)} /><Line k="Term" v={`${term} months`} /></>}
        run={async (pin, code) => { await api('/api/pay/credit', { body: { amountCents: cents, termMonths: Number(term), pin, code } }); setConfirm(false); setApply(false); refetch(); Alert.alert('Application sent', "We'll let you know soon."); }} />
      <MoneySheet visible={!!payLoan} title="Pay your loan" onClose={() => setPayLoan(null)} summary={payLoan && <Line k="Payment" v={money(payLoan.paymentCents, o.currency)} />}
        run={async (pin) => { await api(`/api/pay/credit/loans/${payLoan?.id}`, { body: { pin } }); setPayLoan(null); refetch(); }} />
    </Screen>
  );
}
