import { P, PayHero } from '@/components/pay-ui';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Plus, UserRound } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { errCode, money, newKey, nextStep, type Overview } from '@/lib/pay';
import { C, F } from '@/lib/theme';
import { Button, Card, Chips, ErrorText, Input, List, Loading, Row, Screen, Section, T } from '@/components/ui';
import { PinSheet } from '@/components/pin-sheet';

type Opt = { method: string; label: string; networks?: string[]; eta: string; fields: string[] };
type Corridor = { country: string; name: string; currency: string; flag: string; options: Opt[] };
type Recipient = { id: string; name: string; country: string; method: string; label: string | null };
type Quote = { sendCents: number; sendCurrency: string; feeCents: number; totalCents: number; rate: number; receiveCents: number; receiveCurrency: string; eta: string };
const LABEL: Record<string, string> = { accountNumber: 'Account number', iban: 'IBAN', swift: 'SWIFT / BIC or routing number', bankName: 'Bank name', phone: 'Mobile number with country code', ipa: 'InstaPay address', cardNumber: 'Card number', walletId: 'Wallet or UPI ID' };

export default function Send() {
  const router = useRouter();
  const { data: o } = useApi<Overview>('/api/pay/overview');
  const { data: cs } = useApi<{ from: string; corridors: Corridor[] }>('/api/pay/corridors');
  const { data: rs, refetch: refetchRs } = useApi<{ recipients: Recipient[] }>('/api/pay/recipients');
  const [country, setCountry] = useState('EG');
  const [method, setMethod] = useState('');
  const [amount, setAmount] = useState('200');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [qErr, setQErr] = useState<string | null>(null);
  const [recipient, setRecipient] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ name: '' });
  const [network, setNetwork] = useState('');
  const [sheet, setSheet] = useState<null | 'recipient' | 'send'>(null);
  const [needCode, setNeedCode] = useState(false);
  const [done, setDone] = useState<{ status: string; receiveCents: number; receiveCurrency: string } | null>(null);
  const [key, setKey] = useState(newKey);

  const c = cs?.corridors.find((x) => x.country === country);
  const opt = c?.options.find((x) => x.method === method) ?? c?.options[0];
  useEffect(() => { setMethod(c?.options[0]?.method ?? ''); setRecipient(''); setNetwork(''); }, [country]); // eslint-disable-line react-hooks/exhaustive-deps
  const cents = Math.round(Number(amount || 0) * 100);
  useEffect(() => {
    if (!opt || cents < 500) { setQuote(null); return; }
    const t = setTimeout(() => api<Quote>('/api/pay/quote', { body: { country, method: opt.method, sendCents: cents } }).then((r) => { setQuote(r); setQErr(null); }, (e) => { setQuote(null); setQErr(e.message); }), 400);
    return () => clearTimeout(t);
  }, [country, opt?.method, cents]); // eslint-disable-line react-hooks/exhaustive-deps
  const mine = useMemo(() => (rs?.recipients ?? []).filter((r) => r.country === country && r.method === opt?.method), [rs, country, opt]);

  if (!cs || !o) return <Screen edges={[]}><Loading /></Screen>;
  const blocked = nextStep(o);
  if (done) return (
    <Screen edges={[]}>
      <View style={{ alignItems: 'center', gap: 14, paddingTop: 40 }}>
        <View style={st.doneIcon}><Check color={C.green} size={40} /></View>
        <T v="display" style={{ textAlign: 'center' }}>{done.status === 'REVIEW' ? 'Sent for a quick check' : 'Money is on its way'}</T>
        <T v="body" color={C.muted} style={{ textAlign: 'center' }}>{done.status === 'REVIEW' ? 'Our compliance team reviews some transfers, usually within one business day. Your money is held safely until then.' : `They'll receive ${money(done.receiveCents, done.receiveCurrency)}. We'll notify you when it arrives.`}</T>
        <Button title="Done" variant="primary" big onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
      </View>
    </Screen>
  );
  return (
    <Screen edges={[]}>
      {blocked && <Card><T v="heading">{blocked.title}</T><T v="small" color={C.muted}>{blocked.text}</T><Button title="Fix this" small variant="soft" onPress={() => router.push(blocked.route)} style={{ marginTop: 10, alignSelf: 'flex-start' }} /></Card>}
      <Section title="Where to?">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {cs.corridors.map((x) => <Pressable key={x.country} onPress={() => setCountry(x.country)} style={[st.country, country === x.country && st.countryOn]}><Text style={{ fontSize: 20 }}>{x.flag}</Text><Text style={[st.countryText, country === x.country && { color: '#fff' }]}>{x.name}</Text></Pressable>)}
        </ScrollView>
      </Section>
      {c && <Section title="How will they get it?"><Chips options={c.options.map((x) => [x.method, x.label] as const)} value={(opt?.method ?? '') as string} onChange={(k) => { setMethod(k); setRecipient(''); }} />{opt && <T v="small" color={C.muted} style={{ marginTop: 6 }}>{opt.eta}{opt.networks ? ` · ${opt.networks.join(', ')}` : ''}</T>}</Section>}
      {opt && <Section title="Recipient" action={adding ? undefined : 'New'} onAction={() => setAdding(true)}>
        {adding ? (
          <Card style={{ gap: 12 }}>
            <Input label="Full legal name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
            {opt.networks && <Chips options={opt.networks.map((n) => [n, n] as const)} value={network} onChange={setNetwork} />}
            {opt.fields.map((f) => <Input key={f} label={LABEL[f] ?? f} value={form[f] ?? ''} onChangeText={(v) => setForm({ ...form, [f]: v })} autoCapitalize="none" autoCorrect={false} />)}
            <View style={{ flexDirection: 'row', gap: 8 }}><Button title="Cancel" onPress={() => setAdding(false)} style={{ flex: 1 }} /><Button title="Save" variant="primary" disabled={!!blocked || form.name.trim().length < 2} onPress={() => setSheet('recipient')} style={{ flex: 1 }} /></View>
          </Card>
        ) : !mine.length ? <T v="small" color={C.muted}>No saved recipients for this method yet. Tap New.</T> : (
          <List>{mine.map((r) => <Row key={r.id} title={r.name} sub={r.label ?? ''} icon={<UserRound color={C.muted} size={18} />} right={recipient === r.id ? <Check color={C.blue} size={20} /> : undefined} onPress={() => setRecipient(r.id)} />)}</List>
        )}
      </Section>}
      <PayHero>
        <Text style={st.eyebrow}>YOU SEND</Text>
        <Input value={amount} onChangeText={(v) => setAmount(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" style={{ fontFamily: F.displayBold, fontSize: 30 }} right={<T v="heading">{cs.from}</T>} />
        {qErr ? <Text style={st.onNavy}>{qErr}</Text> : quote ? <View style={{ gap: 4 }}>
          <Text style={st.onNavy}>Rate 1 {quote.sendCurrency} = {quote.rate} {quote.receiveCurrency} · Fee {quote.feeCents ? money(quote.feeCents, quote.sendCurrency) : 'free'}</Text>
          <Text style={st.onNavy}>Total {money(quote.totalCents, quote.sendCurrency)} · {quote.eta}</Text>
          <Text style={st.receive}>They get {money(quote.receiveCents, quote.receiveCurrency)}</Text>
        </View> : <Text style={st.onNavy}>Enter at least 5.00</Text>}
        <Button title="Review and send" variant="light" big disabled={!quote || !recipient || !!blocked} onPress={() => setSheet('send')} />
      </PayHero>
      <PinSheet visible={sheet === 'recipient'} title="Confirm new recipient" codeOnly onClose={() => setSheet(null)} onConfirm={async (_p, code) => {
        const details = Object.fromEntries((opt?.fields ?? []).map((f) => [f, form[f] ?? '']));
        const r = await api<{ id: string }>('/api/pay/recipients', { body: { name: form.name, country, method: opt?.method, network: network || null, details, code } });
        setSheet(null); setAdding(false); setForm({ name: '' }); refetchRs(); setRecipient(r.id);
      }} />
      <PinSheet visible={sheet === 'send'} title="Confirm transfer" needCode={needCode} onClose={() => { setSheet(null); setNeedCode(false); }}
        summary={quote && <><T v="body">To {mine.find((r) => r.id === recipient)?.name}</T><T v="bodyStrong">You pay {money(quote.totalCents, quote.sendCurrency)}</T><T v="body">They get {money(quote.receiveCents, quote.receiveCurrency)}</T></>}
        onConfirm={async (pin, code) => {
          try { const t = await api<{ status: string; receiveCents: number; receiveCurrency: string }>('/api/pay/transfers', { body: { recipientId: recipient, sendCents: cents, pin, code, idempotencyKey: key } }); setSheet(null); setNeedCode(false); setDone(t); setKey(newKey()); }
          catch (e) { if (errCode(e) === 'STEP_UP_REQUIRED') { setNeedCode(true); throw new Error('Enter the code from your authenticator app to finish.'); } throw e; }
        }} />
    </Screen>
  );
}

const st = StyleSheet.create({
  country: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 44, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper },
  countryOn: { backgroundColor: P.ink, borderColor: P.ink },
  countryText: { fontFamily: F.semi, fontSize: 14, color: C.ink },
  eyebrow: { fontFamily: F.semi, fontSize: 11, letterSpacing: 1.6, color: C.onNavyMuted },
  onNavy: { fontFamily: F.medium, fontSize: 13.5, color: C.onNavy },
  receive: { fontFamily: F.displayBold, fontSize: 24, color: '#fff', marginTop: 4 },
  doneIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: C.greenBg, alignItems: 'center', justifyContent: 'center' },
});
