import { useMemo, useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LineChart, TrendingDown, TrendingUp } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { money, newKey, nextStep, type Overview } from '@/lib/pay';
import { C, F } from '@/lib/theme';
import { Button, Chips, Input, List, Loading, Row, Screen, Section, T } from '@/components/ui';
import { Label, PayHero, Status } from '@/components/pay-ui';
import { Line, MoneySheet } from '@/components/pin-sheet';

type Holding = { symbol: string; name: string; quantity: number; costCents: number; valueCents: number | null; gainCents: number | null };
type P = { currency: string; rows: Holding[]; valueCents: number; costCents: number; gainCents: number; trades: { id: string; symbol: string; side: string; amountCents: number; status: string; createdAt: string }[]; feeExample: number };
type Q = { symbol: string; name: string; kind: string; price: number | null; changePct: number | null; halal: boolean };
const pct = (n: number | null) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`);

export default function Invest() {
  const router = useRouter();
  const { data: o } = useApi<Overview>('/api/pay/overview');
  const { data: p, refreshing, reload, refetch } = useApi<P>('/api/pay/invest');
  const { data: mk } = useApi<{ quotes: Q[] }>('/api/pay/markets');
  const [kind, setKind] = useState<'STOCK' | 'CRYPTO'>('STOCK');
  const [trade, setTrade] = useState<{ q: Q; side: 'BUY' | 'SELL' } | null>(null);
  const [amount, setAmount] = useState('');
  const [all, setAll] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [key, setKey] = useState(newKey);
  const list = useMemo(() => (mk?.quotes ?? []).filter((q) => q.kind === kind), [mk, kind]);
  if (!p || !o) return <Screen title="Invest"><Loading /></Screen>;
  const held = trade ? p.rows.find((h) => h.symbol === trade.q.symbol) : undefined;
  const cents = all && held?.valueCents ? held.valueCents : Math.round(Number(amount || 0) * 100);
  const fee = Math.round((cents * p.feeExample) / 10_000);
  const quote = (h: Holding): Q => mk?.quotes.find((q) => q.symbol === h.symbol) ?? { symbol: h.symbol, name: h.name, kind: 'STOCK', price: null, changePct: null, halal: false };
  const open = (q: Q, side: 'BUY' | 'SELL') => { setTrade({ q, side }); setAmount(''); setAll(false); };
  return (
    <Screen title="Invest" right={<Button small title="Markets" icon={<LineChart color={C.ink} size={16} />} onPress={() => router.push('/markets')} />} refreshing={refreshing} onRefresh={reload}>
      <PayHero>
        <Label color="rgba(255,255,255,0.55)">Portfolio value</Label>
        <Text style={{ fontFamily: F.display, fontSize: 38, color: '#fff', letterSpacing: -1 }}>{money(p.valueCents, p.currency)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>{p.gainCents >= 0 ? <TrendingUp color="#7CE3B1" size={16} /> : <TrendingDown color="#FDA29B" size={16} />}<Text style={{ fontFamily: F.semi, color: p.gainCents >= 0 ? '#7CE3B1' : '#FDA29B' }}>{p.gainCents >= 0 ? '+' : ''}{money(p.gainCents, p.currency)} all time</Text></View>
      </PayHero>
      {p.rows.length > 0 && <Section title="You own"><List>{p.rows.map((h) => (
        <Row key={h.symbol} title={h.name} sub={`${h.quantity.toLocaleString('en-US', { maximumFractionDigits: 6 })} · ${money(h.valueCents ?? h.costCents, p.currency)}`} right={<View style={{ flexDirection: 'row', gap: 6 }}><Button small title="Sell" onPress={() => open(quote(h), 'SELL')} /><Button small variant="primary" title="Buy" onPress={() => open(quote(h), 'BUY')} /></View>} />
      ))}</List></Section>}
      <Section title="Discover">
        <Chips value={kind} onChange={setKind} options={[['STOCK', 'Stocks and ETFs'], ['CRYPTO', 'Crypto']] as const} />
        {!mk ? <Loading /> : <List>{list.map((q) => <Row key={q.symbol} title={q.name} sub={`${q.symbol} · ${pct(q.changePct)}${q.halal ? ' · Halal' : ''}`} right={<Button small variant="primary" title="Buy" disabled={!!nextStep(o)} onPress={() => open(q, 'BUY')} />} />)}</List>}
      </Section>
      {p.trades.length > 0 && <Section title="Orders"><List>{p.trades.slice(0, 10).map((t) => <Row key={t.id} title={`${t.side === 'BUY' ? 'Bought' : 'Sold'} ${t.symbol}`} sub={money(t.amountCents, p.currency)} right={<Status status={t.status} />} />)}</List></Section>}
      <T v="caption" color={C.faint}>Investing involves risk. You could get back less than you put in. Not investment advice.</T>

      <Modal visible={!!trade && !confirm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setTrade(null)}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
          <T v="title">{trade?.side === 'BUY' ? 'Buy' : 'Sell'} {trade?.q.name}</T>
          {trade?.q.price != null && <T v="small">US${trade.q.price.toLocaleString('en-US', { maximumFractionDigits: 4 })} · {pct(trade.q.changePct)} today</T>}
          <Input label={`Amount in ${p.currency}`} value={all ? ((held?.valueCents ?? 0) / 100).toFixed(2) : amount} editable={!all} onChangeText={(v) => setAmount(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder="0.00" style={{ fontFamily: F.displayBold, fontSize: 28 }} />
          {trade?.side === 'SELL' && held && <Button small title={all ? 'Enter an amount instead' : 'Sell everything'} onPress={() => setAll(!all)} />}
          <T v="small">Fee {money(fee, p.currency)}. Market order, filled at the next price.</T>
          <Button title="Review" variant="primary" big disabled={cents < 100} onPress={() => setConfirm(true)} />
          <Button title="Cancel" variant="ghost" onPress={() => setTrade(null)} />
        </ScrollView>
      </Modal>
      <MoneySheet visible={confirm} title={trade?.side === 'BUY' ? 'Confirm purchase' : 'Confirm sale'} onClose={() => setConfirm(false)} summary={trade && <><Line k={trade.side === 'BUY' ? 'Buy' : 'Sell'} v={trade.q.name} /><Line k="Amount" v={money(cents, p.currency)} /><Line k="Fee" v={money(fee, p.currency)} /></>}
        run={async (pin, code) => { await api('/api/pay/invest', { body: { side: trade?.side, symbol: trade?.q.symbol, amountCents: all ? undefined : cents, all: all || undefined, pin, code, idempotencyKey: key } }); setConfirm(false); setTrade(null); setKey(newKey()); refetch(); }} />
    </Screen>
  );
}
