import { Alert, View } from 'react-native';
import { Pause, Play, Users } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { ago, money, type Overview } from '@/lib/pay';
import { C } from '@/lib/theme';
import { Badge, Button, Card, EmptyState, ErrorText, List, Loading, Progress, Row, Screen, Section, T } from '@/components/ui';
import { CardFace } from '@/components/card-face';

type Member = { id: string; name: string; birthYear: number; status: string; weeklyLimitCents: number; nightLock: boolean; onlineAllowed: boolean; spentThisWeekCents: number; cards: { id: string; last4: string; brand: string; status: string; expMonth: number; expYear: number }[]; activity: { id: string; merchant: string; amountCents: number; currency: string; decision: string; reason: string | null; createdAt: string }[] };

export default function Family() {
  const { data: o } = useApi<Overview>('/api/pay/overview');
  const { data, error, refreshing, reload, refetch } = useApi<{ members: Member[] }>('/api/pay/family');
  if (!data || !o) return <Screen edges={[]}>{error ? <ErrorText text={error} /> : <Loading />}</Screen>;
  const toggle = async (m: Member) => { try { await api(`/api/pay/family/${m.id}`, { method: 'PATCH', body: { status: m.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' } }); refetch(); } catch (e) { Alert.alert('Not saved', (e as Error).message); } };
  return (
    <Screen edges={[]} refreshing={refreshing} onRefresh={reload}>
      {!data.members.length ? <EmptyState icon={<Users color={C.blue} size={26} />} title="No family members yet" text="Add a teen on the web app (Pay, Family) to give them a card with your rules. You can manage them here." /> :
        data.members.map((m) => (
          <Section key={m.id} title={m.name} action={m.status === 'ACTIVE' ? 'Pause' : 'Resume'} onAction={() => toggle(m)}>
            {m.cards[0] && <CardFace c={m.cards[0]} name={m.name} teen />}
            <Card style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T v="bodyStrong">{money(m.spentThisWeekCents, o.currency)} of {money(m.weeklyLimitCents, o.currency)}</T><Badge text={m.status === 'ACTIVE' ? 'Active' : 'Paused'} tone={m.status === 'ACTIVE' ? 'green' : 'amber'} /></View>
              <Progress value={Math.min(1, m.spentThisWeekCents / Math.max(1, m.weeklyLimitCents))} color={C.blue} />
              <T v="small" color={C.muted}>This week{m.nightLock ? ' · night lock on' : ''}{!m.onlineAllowed ? ' · no online shopping' : ''}</T>
              <Button small title={m.status === 'ACTIVE' ? 'Pause card' : 'Resume card'} icon={m.status === 'ACTIVE' ? <Pause color={C.ink} size={16} /> : <Play color={C.ink} size={16} />} onPress={() => toggle(m)} style={{ alignSelf: 'flex-start' }} />
            </Card>
            {m.activity.length > 0 && <List>{m.activity.slice(0, 8).map((a) => <Row key={a.id} title={a.merchant} sub={a.decision === 'DECLINED' ? `Blocked: ${a.reason}` : ago(a.createdAt)} danger={a.decision === 'DECLINED'} right={<T v="bodyStrong">{money(a.amountCents, a.currency)}</T>} />)}</List>}
          </Section>
        ))}
    </Screen>
  );
}
