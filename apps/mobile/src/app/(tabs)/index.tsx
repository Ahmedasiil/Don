import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ArrowDownLeft, BadgeCheck, Check, ChevronRight, CreditCard, LineChart, Plane, Plus, Send, ShieldCheck, Sparkles, Users, LifeBuoy, Receipt } from 'lucide-react-native';
import { useApi } from '@/lib/use-api';
import { useAuth } from '@/lib/auth';
import { ago, money, nextStep, human, type Overview } from '@/lib/pay';
import { F } from '@/lib/theme';
import { ErrorText, Loading, Screen } from '@/components/ui';
import { CardFace } from '@/components/card-face';
import { flag, initials, Label, P, Panel, PayHero, Status } from '@/components/pay-ui';

export default function Pay() {
  const router = useRouter();
  const { session } = useAuth();
  const { data: o, error, refreshing, reload, refetch } = useApi<Overview>('/api/pay/overview');
  useFocusEffect(useCallback(() => { refetch(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps
  if (!o) return <Screen title="oenodpay">{error ? <ErrorText text={error} /> : <Loading />}</Screen>;
  const step = nextStep(o);
  const card = o.cards.find((c) => c.status === 'ACTIVE') ?? o.cards[0];
  const name = (o.profile.name ?? session?.user?.name ?? '').split(' ')[0];
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const actions = [
    { label: 'Add money', icon: Plus, onPress: () => router.push('/topup') },
    { label: 'Send', icon: Send, onPress: () => router.push('/send') },
    { label: 'Request', icon: ArrowDownLeft, onPress: () => router.push('/request') },
    { label: 'Bills', icon: Receipt, onPress: () => router.push('/bills') },
  ];
  const [whole, cents] = money(o.availableCents, o.currency).split(/(?=[.,]\d{2}$)/);
  const shields = [['Two-step sign-in', o.profile.twoStep], ['Identity verified', o.profile.kycStatus === 'VERIFIED'], ['Payment PIN', o.profile.pinSet], ['Sanctions screening', true]] as const;
  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <View style={{ gap: 4, marginBottom: 2 }}>
        <Label>{new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}</Label>
        <Text style={st.hello}>{hello}{name ? `, ${name}` : ''}</Text>
      </View>

      <PayHero>
        <View style={st.row}>
          <Label color="rgba(255,255,255,0.55)">Total balance · {o.currency}</Label>
          {o.profile.kycStatus === 'VERIFIED' && <View style={st.verified}><BadgeCheck color="#7CE3B1" size={14} /><Text style={st.verifiedText}>Verified</Text></View>}
        </View>
        <Text style={st.balance} adjustsFontSizeToFit numberOfLines={1}>{whole}<Text style={st.cents}>{cents}</Text></Text>
        {o.balanceCents !== o.availableCents && <Text style={st.held}>{money(o.balanceCents - o.availableCents, o.currency)} held for review</Text>}
        <View style={st.actions}>{actions.map((a) => (
          <Pressable key={a.label} onPress={a.onPress} style={({ pressed }) => [st.action, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={a.label}>
            <View style={st.actionIcon}><a.icon color="#fff" size={19} strokeWidth={1.9} /></View><Text style={st.actionText}>{a.label}</Text>
          </Pressable>
        ))}</View>
      </PayHero>

      {step && <Panel onPress={() => router.push(step.route)} style={st.step}><View style={st.stepIcon}><ShieldCheck color="#fff" size={18} /></View><View style={{ flex: 1, gap: 2 }}><Text style={st.title}>{step.title}</Text><Text style={st.sub}>{step.text}</Text></View><ChevronRight color={P.faint} size={18} /></Panel>}

      {card && <Panel style={{ padding: 16, gap: 14 }} onPress={() => router.push('/cards')}>
        <View style={st.row}><Label>Your card</Label><View style={st.link}><Text style={st.linkText}>Manage</Text><ChevronRight color={P.text} size={15} /></View></View>
        <CardFace c={card} name={o.profile.name ?? ''} />
      </Panel>}

      <Panel style={{ padding: 18, gap: 12 }} onPress={() => router.push('/coach')}>
        <View style={st.row}><Label>Financial health</Label><View style={st.link}><Sparkles color={P.blue} size={14} /><Text style={[st.linkText, { color: P.blue }]}>Ask Oeno</Text></View></View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}><Text style={st.score}>{o.health.score}</Text><Text style={st.sub}>/100</Text><Text style={[st.title, { marginLeft: 'auto', fontSize: 13 }]}>{o.health.score >= 70 ? 'Strong' : o.health.score >= 45 ? 'Fair' : 'Needs work'}</Text></View>
        <View style={{ flexDirection: 'row', gap: 6 }}>{Object.values(o.health.parts).map((v, i) => <View key={i} style={st.track}><View style={[st.fill, { width: `${v}%`, backgroundColor: v >= 70 ? P.green : v >= 45 ? P.amber : P.red }]} /></View>)}</View>
        <Text style={st.sub}>{o.health.bufferMonths} months of spending set aside</Text>
      </Panel>

      {o.transfers.length > 0 && <View style={{ gap: 10 }}>
        <View style={st.row}><Text style={st.section}>Recent transfers</Text><Pressable onPress={() => router.push('/send')}><Text style={st.linkText}>Send money</Text></Pressable></View>
        <Panel>{o.transfers.map((t, i) => (
          <View key={t.id} style={[st.item, i > 0 && st.sep]}>
            <View style={st.avatar}><Text style={st.avatarText}>{initials(t.recipient.name)}</Text><Text style={st.flag}>{flag(t.recipient.country)}</Text></View>
            <View style={{ flex: 1, minWidth: 0 }}><Text style={st.title} numberOfLines={1}>{t.recipient.name}</Text><Text style={st.sub} numberOfLines={1}>{t.recipient.label ?? t.recipient.country} · {ago(t.createdAt)}</Text></View>
            <View style={{ alignItems: 'flex-end', gap: 5 }}><Text style={st.amount}>−{money(t.sendCents, t.sendCurrency)}</Text><Status status={t.status} /></View>
          </View>
        ))}</Panel>
      </View>}

      {o.recent.length > 0 && <View style={{ gap: 10 }}>
        <View style={st.row}><Text style={st.section}>Activity</Text><Pressable onPress={() => router.push('/activity')} style={st.link}><Text style={st.linkText}>View all</Text></Pressable></View>
        <Panel>{o.recent.slice(0, 6).map((a, i) => (
          <View key={a.id} style={[st.item, i > 0 && st.sep]}>
            <View style={[st.icon, a.amountCents >= 0 && { backgroundColor: P.greenBg }]}>{a.amountCents >= 0 ? <ArrowDownLeft color={P.greenText} size={17} /> : <CreditCard color={P.text} size={17} />}</View>
            <View style={{ flex: 1, minWidth: 0 }}><Text style={st.title} numberOfLines={1}>{a.memo ?? human(a.kind)}</Text><Text style={st.sub}>{ago(a.at)}</Text></View>
            <Text style={[st.amount, a.amountCents >= 0 && { color: P.greenText }]}>{a.amountCents >= 0 ? '+' : ''}{money(a.amountCents, a.currency)}</Text>
          </View>
        ))}</Panel>
      </View>}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Panel style={st.tile} onPress={() => router.push('/family')}><Users color={P.ink} size={19} /><Text style={st.title}>Family</Text><Text style={st.sub}>Teen cards and rules</Text></Panel>
        <Panel style={st.tile} onPress={() => router.push('/help')}><LifeBuoy color={P.ink} size={19} /><Text style={st.title}>Help</Text><Text style={st.sub}>Day and night</Text></Panel>
      </View>

      <Panel style={{ padding: 16, gap: 10 }} onPress={() => router.push('/security')}>
        <View style={st.row}><View style={st.link}><ShieldCheck color={P.greenText} size={16} /><Text style={st.title}>Your protection</Text></View><ChevronRight color={P.faint} size={16} /></View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 8, columnGap: 14 }}>{shields.map(([l, ok]) => <View key={l} style={st.link}><Check color={ok ? P.green : P.faint} size={13} strokeWidth={3} /><Text style={[st.sub, { color: ok ? P.text : P.faint }]}>{l}</Text></View>)}</View>
      </Panel>
    </Screen>
  );
}

const st = StyleSheet.create({
  hello: { fontFamily: F.display, fontSize: 26, letterSpacing: -0.6, color: P.ink },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  verifiedText: { fontFamily: F.semi, fontSize: 11.5, color: '#fff' },
  balance: { fontFamily: F.display, fontSize: 46, color: '#fff', letterSpacing: -1.4 },
  cents: { fontSize: 24, color: 'rgba(255,255,255,0.5)' },
  held: { fontFamily: F.medium, fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  action: { alignItems: 'center', gap: 7, flex: 1 },
  actionIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  actionText: { fontFamily: F.medium, fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  stepIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: P.ink, alignItems: 'center', justifyContent: 'center' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkText: { fontFamily: F.semi, fontSize: 13, color: P.text },
  score: { fontFamily: F.display, fontSize: 34, letterSpacing: -1, color: P.ink },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: P.hair, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  section: { fontFamily: F.display, fontSize: 16, letterSpacing: -0.2, color: P.ink },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  sep: { borderTopWidth: 1, borderTopColor: P.hair },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: F.display, fontSize: 12.5, color: P.text },
  flag: { position: 'absolute', right: -3, bottom: -3, fontSize: 12 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: F.semi, fontSize: 14.5, color: P.ink },
  sub: { fontFamily: F.regular, fontSize: 12.5, color: P.muted },
  amount: { fontFamily: F.display, fontSize: 14.5, color: P.ink, fontVariant: ['tabular-nums'] },
  tile: { flex: 1, padding: 16, gap: 6 },
});
