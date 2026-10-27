import { P } from '@/components/pay-ui';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { Wifi } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { money, nextStep, type Overview } from '@/lib/pay';
import { C, F } from '@/lib/theme';
import { Button, Card, ErrorText, IconTile, List, Loading, Row, Screen, Section, T } from '@/components/ui';
import { PinSheet } from '@/components/pin-sheet';

type Pkg = { id: string; title: string; data: string; days: number; priceCents: number; currency: string; operator: string; country: string };
type Order = { id: string; dataLabel: string; days: number; country: string; status: string; qrcodeUrl: string | null; lpa: string | null };
const POPULAR = [['EG', '🇪🇬 Egypt'], ['US', '🇺🇸 USA'], ['AE', '🇦🇪 UAE'], ['SA', '🇸🇦 Saudi'], ['TR', '🇹🇷 Türkiye'], ['GB', '🇬🇧 UK'], ['FR', '🇫🇷 France'], ['MX', '🇲🇽 Mexico'], ['JP', '🇯🇵 Japan']];

export default function Esim() {
  const { data: o } = useApi<Overview>('/api/pay/overview');
  const [country, setCountry] = useState<string | null>(null);
  const { data, error } = useApi<{ packages: Pkg[] }>(country ? `/api/pay/esim?country=${country}` : null);
  const { data: orders, refetch } = useApi<{ orders: Order[] }>('/api/pay/esim/orders');
  const [buy, setBuy] = useState<Pkg | null>(null);
  const [show, setShow] = useState<Order | null>(null);
  if (!o) return <Screen edges={[]}><Loading /></Screen>;
  return (
    <Screen edges={[]}>
      {show && <Card style={{ alignItems: 'center', gap: 10 }}>
        {show.qrcodeUrl && <Image source={{ uri: show.qrcodeUrl }} style={{ width: 220, height: 220 }} />}
        <T v="small" color={C.muted} style={{ textAlign: 'center' }}>Settings, Mobile data, Add eSIM, then scan. On this phone, tap Install below.</T>
        {show.lpa && <Button title="Install on this phone" variant="primary" onPress={() => Linking.openURL(`https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(show.lpa!)}`)} />}
        <Button title="Close" variant="ghost" onPress={() => setShow(null)} />
      </Card>}
      {orders && orders.orders.length > 0 && <Section title="Your eSIMs"><List>{orders.orders.map((x) => <Row key={x.id} title={`${x.dataLabel} · ${x.days} days`} sub={x.country} icon={<IconTile tone="blue"><Wifi color={C.blue} size={16} /></IconTile>} chevron={x.status === 'READY'} onPress={() => x.status === 'READY' && setShow(x)} />)}</List></Section>}
      <Section title="Where are you going?">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{POPULAR.map(([c, n]) => <Pressable key={c} onPress={() => setCountry(c)} style={[st.chip, country === c && st.on]}><Text style={[st.chipText, country === c && { color: '#fff' }]}>{n}</Text></Pressable>)}</ScrollView>
      </Section>
      {country && (error ? <ErrorText text={error} /> : !data ? <Loading /> : <List>{data.packages.slice(0, 15).map((p) => <Row key={p.id} title={`${p.data} · ${p.days} days`} sub={p.operator} right={<Button small variant="primary" title={money(p.priceCents, p.currency)} disabled={!!nextStep(o)} onPress={() => setBuy(p)} />} />)}</List>)}
      <PinSheet visible={!!buy} title="Buy eSIM" summary={buy && <T v="bodyStrong">{buy.data} · {buy.days} days · {money(buy.priceCents, buy.currency)}</T>} onClose={() => setBuy(null)} onConfirm={async (pin) => { const r = await api<Order>('/api/pay/esim', { body: { country: buy?.country, packageId: buy?.id, pin } }); setBuy(null); refetch(); setShow(r); }} />
    </Screen>
  );
}

const st = StyleSheet.create({
  chip: { paddingHorizontal: 14, height: 42, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, justifyContent: 'center' },
  on: { backgroundColor: P.ink, borderColor: P.ink },
  chipText: { fontFamily: F.semi, fontSize: 14, color: C.ink },
});
