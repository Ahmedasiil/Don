import { useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Plane, Send, Smartphone } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { useAuth } from '@/lib/auth';
import { ago, money, newKey } from '@/lib/pay';
import { C } from '@/lib/theme';
import { Button, Card, Chips, Input, List, Loading, Row, Screen, Section, Segmented, T } from '@/components/ui';
import { Status } from '@/components/pay-ui';
import { DateField } from '@/components/date-field';
import { Line, MoneySheet } from '@/components/pin-sheet';

type Price = { totalCents: number; feeCents: number; currency: string };
type Flight = { id: string; airline: string; logo: string | null; price: Price; refundable: boolean; slices: { from: string; to: string; duration: string | null; stops: number; departAt: string; arriveAt: string }[] };
type Stay = { id: string; name: string; rating: number | null; photo: string | null; address: string; price: Price };
type Rate = { id: string; board: string | null; refundable: boolean; price: Price };
type Booking = { id: string; kind: string; title: string; status: string; reference: string | null; amountCents: number; currency: string; createdAt: string };
type Trips = { bookings: Booking[]; messages: { role: 'user' | 'assistant'; content: string }[] };
type Tab = 'ai' | 'flights' | 'stays' | 'trips';

const day = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);
const time = (s: string) => new Date(s).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const dur = (s: string | null) => s?.replace(/^P(T)?/, '').replace('D', 'd ').replace('H', 'h ').replace('M', 'm').toLowerCase() ?? '';
const CABINS = [['economy', 'Economy'], ['premium_economy', 'Premium'], ['business', 'Business'], ['first', 'First']] as const;

export default function Travel() {
  const router = useRouter();
  const { session } = useAuth();
  const [tab, setTab] = useState<Tab>('ai');
  const { data: t, refetch, refreshing, reload } = useApi<Trips>('/api/pay/travel');
  // AI agent
  const [msg, setMsg] = useState('');
  const [chat, setChat] = useState<Trips['messages'] | null>(null);
  const [thinking, setThinking] = useState(false);
  // Search
  const [q, setQ] = useState({ from: 'YYZ', to: '', place: '', depart: day(14), back: day(21), adults: '1', cabin: 'economy' as (typeof CABINS)[number][0] });
  const [flights, setFlights] = useState<Flight[] | null>(null);
  const [stays, setStays] = useState<Stay[] | null>(null);
  const [busy, setBusy] = useState(false);
  // Booking
  const [flight, setFlight] = useState<Flight | null>(null);
  const [stay, setStay] = useState<{ s: Stay; rates: Rate[] | null } | null>(null);
  const [rate, setRate] = useState<Rate | null>(null);
  const [who, setWho] = useState({ given: '', family: '', born: '1990-01-01', gender: 'm' as 'm' | 'f', phone: '' });
  const [confirm, setConfirm] = useState(false);

  if (!t) return <Screen title="Travel"><Loading /></Screen>;
  const messages = chat ?? t.messages;
  const set = (k: keyof typeof q) => (v: string) => setQ((x) => ({ ...x, [k]: v }));

  const ask = async () => {
    const m = msg.trim(); if (!m) return;
    setMsg(''); setThinking(true); setChat([...messages, { role: 'user', content: m }]);
    try {
      const r = await api<{ reply: string; flights?: Flight[]; stays?: Stay[] }>('/api/pay/travel/chat', { body: { message: m } });
      setChat((c) => [...(c ?? []), { role: 'assistant', content: r.reply }]);
      if (r.flights?.length) setFlights(r.flights);
      if (r.stays?.length) setStays(r.stays);
    } catch (e) { Alert.alert('Agent unavailable', (e as Error).message); }
    setThinking(false);
  };
  const search = async () => {
    setBusy(true);
    try {
      if (tab === 'flights') setFlights((await api<{ offers: Flight[] }>('/api/pay/travel/flights', { body: { from: q.from, to: q.to, depart: q.depart, back: q.back || undefined, adults: Number(q.adults), cabin: q.cabin } })).offers);
      else setStays((await api<{ results: Stay[] }>('/api/pay/travel/stays', { body: { place: q.place, checkIn: q.depart, checkOut: q.back, adults: Number(q.adults) } })).results);
    } catch (e) { Alert.alert('Search failed', (e as Error).message); }
    setBusy(false);
  };
  const openStay = async (s: Stay) => { setStay({ s, rates: null }); try { const r = await api<{ rooms: { name: string; rates: Rate[] }[] }>(`/api/pay/travel/stays/${s.id}`); setStay({ s, rates: r.rooms.flatMap((x) => x.rates.map((y) => ({ ...y, board: `${x.name}${y.board ? ` · ${y.board.replace(/_/g, ' ')}` : ''}` }))) }); } catch (e) { Alert.alert('No rooms', (e as Error).message); setStay(null); } };
  const price = flight?.price ?? rate?.price;
  const ready = who.given && who.family && /^\+\d{7,15}$/.test(who.phone);
  const book = async (pin: string, code?: string) => {
    const guest = { given_name: who.given, family_name: who.family };
    const common = { pin, code, idempotencyKey: newKey() };
    const r = flight
      ? await api<{ reference: string | null }>('/api/pay/travel/book', { body: { kind: 'FLIGHT', offerId: flight.id, travellers: [{ title: who.gender === 'm' ? 'mr' : 'ms', ...guest, born_on: who.born, gender: who.gender, email: session?.user?.email, phone_number: who.phone }], ...common } })
      : await api<{ reference: string | null }>('/api/pay/travel/book', { body: { kind: 'STAY', rateId: rate?.id, hotel: stay?.s.name, checkIn: q.depart, checkOut: q.back, guest, phone: who.phone, ...common } });
    setConfirm(false); setFlight(null); setStay(null); setRate(null); refetch(); setTab('trips');
    Alert.alert('Booked', r.reference ? `Your reference is ${r.reference}.` : 'We sent the details to your email.');
  };

  return (
    <Screen title="Travel" refreshing={refreshing} onRefresh={reload}>
      <Segmented value={tab} onChange={setTab} options={[['ai', 'AI agent'], ['flights', 'Flights'], ['stays', 'Hotels'], ['trips', 'My trips']] as const} />

      {tab === 'ai' && <>
        <Card style={{ gap: 10 }}>
          {messages.length === 0 && <T v="small">Tell me where and when. For example: “Toronto to Cairo in March, under $1,200, one bag.” I'll find flights and hotels, and you approve before anything is paid.</T>}
          {messages.slice(-12).map((m, i) => <View key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', backgroundColor: m.role === 'user' ? C.navy : C.bg, borderRadius: 16, padding: 12 }}><T v="body" color={m.role === 'user' ? '#fff' : C.ink}>{m.content}</T></View>)}
          {thinking && <T v="small">Searching…</T>}
          <Input value={msg} onChangeText={setMsg} placeholder="Where to?" onSubmitEditing={ask} returnKeyType="send" right={<Pressable onPress={ask} accessibilityLabel="Send"><Send color={C.blue} size={18} /></Pressable>} />
          {messages.length > 0 && <Button small variant="ghost" title="Start over" onPress={async () => { await api('/api/pay/travel', { method: 'DELETE' }); setChat([]); setFlights(null); setStays(null); }} />}
        </Card>
      </>}

      {(tab === 'flights' || tab === 'stays') && <Card style={{ gap: 12 }}>
        {tab === 'flights'
          ? <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Input label="From" value={q.from} onChangeText={(v) => set('from')(v.toUpperCase().slice(0, 3))} autoCapitalize="characters" placeholder="YYZ" /></View><View style={{ flex: 1 }}><Input label="To" value={q.to} onChangeText={(v) => set('to')(v.toUpperCase().slice(0, 3))} autoCapitalize="characters" placeholder="CAI" /></View></View>
          : <Input label="City or area" value={q.place} onChangeText={set('place')} placeholder="Cairo" />}
        <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><DateField label={tab === 'flights' ? 'Depart' : 'Check in'} value={q.depart} onChange={set('depart')} min={day(1)} /></View><View style={{ flex: 1 }}><DateField label={tab === 'flights' ? 'Return' : 'Check out'} value={q.back} onChange={set('back')} min={q.depart} /></View></View>
        <Input label="Travellers" value={q.adults} onChangeText={(v) => set('adults')(v.replace(/\D/g, '').slice(0, 1))} keyboardType="number-pad" />
        {tab === 'flights' && <Chips value={q.cabin} onChange={(v) => setQ((x) => ({ ...x, cabin: v }))} options={CABINS} />}
        <Button title="Search" variant="primary" loading={busy} disabled={tab === 'flights' ? q.from.length !== 3 || q.to.length !== 3 : q.place.length < 2} onPress={search} />
      </Card>}

      {(tab === 'flights' || tab === 'ai') && flights && <Section title={`${flights.length} flights`}>{flights.slice(0, 15).map((f) => <Card key={f.id} style={{ gap: 6 }} onPress={() => setFlight(f)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{f.logo ? <Image source={{ uri: f.logo }} style={{ width: 22, height: 22 }} /> : <Plane color={C.ink} size={18} />}<T v="bodyStrong" style={{ flex: 1 }}>{f.airline}</T><T v="heading">{money(f.price.totalCents, f.price.currency)}</T></View>
        {f.slices.map((s, i) => <T key={i} v="small">{s.from} → {s.to} · {time(s.departAt)} · {dur(s.duration)} · {s.stops ? `${s.stops} stop${s.stops > 1 ? 's' : ''}` : 'Direct'}</T>)}
      </Card>)}</Section>}

      {(tab === 'stays' || tab === 'ai') && stays && <Section title={`${stays.length} hotels`}>{stays.slice(0, 15).map((s) => <Card key={s.id} style={{ gap: 6 }} onPress={() => openStay(s)}>
        {s.photo && <Image source={{ uri: s.photo }} style={{ height: 130, borderRadius: 12 }} />}
        <View style={{ flexDirection: 'row' }}><T v="bodyStrong" style={{ flex: 1 }}>{s.name}{s.rating ? ` · ${'★'.repeat(s.rating)}` : ''}</T><T v="heading">{money(s.price.totalCents, s.price.currency)}</T></View>
        <T v="small">{s.address}</T>
      </Card>)}</Section>}

      {tab === 'trips' && <>
        <Section title="Bookings">{t.bookings.length ? <List>{t.bookings.map((b) => <Row key={b.id} title={b.title} sub={`${b.reference ?? 'No reference yet'} · ${ago(b.createdAt)}`} right={<View style={{ alignItems: 'flex-end', gap: 4 }}><T v="bodyStrong">{money(b.amountCents, b.currency)}</T><Status status={b.status} /></View>} />)}</List> : <T v="small">Your flights and hotels show up here.</T>}</Section>
        <Card onPress={() => router.push('/esim')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Smartphone color={C.ink} size={20} /><View style={{ flex: 1 }}><T v="bodyStrong">Travel eSIM</T><T v="small">Data in 190+ countries, ready before you land.</T></View></Card>
      </>}

      <Modal visible={!!(flight || stay) && !confirm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setFlight(null); setStay(null); setRate(null); }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
          <T v="title">{flight ? `${flight.airline}` : stay?.s.name}</T>
          {flight && flight.slices.map((s, i) => <Line key={i} k={`${s.from} → ${s.to}`} v={time(s.departAt)} />)}
          {stay && (stay.rates ? <List>{stay.rates.map((r) => <Row key={r.id} title={r.board ?? 'Room'} sub={r.refundable ? 'Free cancellation' : 'Non-refundable'} right={<T v="bodyStrong" color={rate?.id === r.id ? C.blue : C.ink}>{money(r.price.totalCents, r.price.currency)}</T>} onPress={() => setRate(r)} />)}</List> : <Loading />)}
          <T v="heading">{flight ? 'Traveller (as on passport)' : 'Guest'}</T>
          <Input label="First name" value={who.given} onChangeText={(v) => setWho({ ...who, given: v })} />
          <Input label="Last name" value={who.family} onChangeText={(v) => setWho({ ...who, family: v })} />
          {flight && <><DateField label="Date of birth" value={who.born} onChange={(v) => setWho({ ...who, born: v })} /><Chips value={who.gender} onChange={(v) => setWho({ ...who, gender: v })} options={[['m', 'Male'], ['f', 'Female']] as const} /></>}
          <Input label="Mobile" value={who.phone} onChangeText={(v) => setWho({ ...who, phone: v.replace(/[^\d+]/g, '') })} keyboardType="phone-pad" placeholder="+14165550100" />
          {price && <Card style={{ gap: 6 }}><Line k="Price" v={money(price.totalCents - price.feeCents, price.currency)} /><Line k="oenodpay fee" v={money(price.feeCents, price.currency)} /><Line k="Total from your wallet" v={money(price.totalCents, price.currency)} /></Card>}
          <Button title="Book and pay" variant="primary" big disabled={!ready || !price} onPress={() => setConfirm(true)} />
          <Button title="Cancel" variant="ghost" onPress={() => { setFlight(null); setStay(null); setRate(null); }} />
        </ScrollView>
      </Modal>
      <MoneySheet visible={confirm} title="Confirm booking" onClose={() => setConfirm(false)} summary={price && <Line k="Total" v={money(price.totalCents, price.currency)} />} run={book} />
    </Screen>
  );
}
