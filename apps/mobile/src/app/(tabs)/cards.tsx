import { Status } from '@/components/pay-ui';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Snowflake, Play } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { human, nextStep, statusTone, type Overview } from '@/lib/pay';
import { C } from '@/lib/theme';
import { Badge, Button, EmptyState, ErrorText, Loading, Screen } from '@/components/ui';
import { PinSheet } from '@/components/pin-sheet';
import { CardFace } from '@/components/card-face';
import { CreditCard } from 'lucide-react-native';

type Card = { id: string; last4: string; brand: string; type: string; status: string; expMonth: number; expYear: number; familyId: string | null };


export default function Cards() {
  const { data: o } = useApi<Overview>('/api/pay/overview');
  const { data, error, refreshing, reload, refetch } = useApi<{ cards: Card[] }>('/api/pay/cards');
  const [sheet, setSheet] = useState<null | { title: string; run: (code: string) => Promise<void> }>(null);
  if (!data || !o) return <Screen title="Cards">{error ? <ErrorText text={error} /> : <Loading />}</Screen>;
  const mine = data.cards.filter((c) => !c.familyId);
  const patch = (c: Card, status: string) => async (code?: string) => { await api(`/api/pay/cards/${c.id}`, { method: 'PATCH', body: { status, code } }); setSheet(null); refetch(); };
  return (
    <Screen title="Cards" refreshing={refreshing} onRefresh={reload}>
      {!mine.length ? <EmptyState icon={<CreditCard color={C.blue} size={26} />} title="No card yet" text="Get a virtual card in seconds on the web app (Pay, Cards). It works in Apple Pay and Google Pay." action={<Button title="Get a virtual card" variant="primary" disabled={!!nextStep(o)} onPress={() => setSheet({ title: 'Confirm new card', run: async (code) => { await api('/api/pay/cards', { body: { type: 'virtual', code } }); setSheet(null); refetch(); } })} />} /> :
        mine.map((c) => (
          <View key={c.id} style={{ gap: 12 }}>
            <CardFace c={c} name={o.profile.name ?? ''} />
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Status status={c.status} />
              <View style={{ flex: 1 }} />
              {c.status === 'ACTIVE' && <Button small title="Freeze" icon={<Snowflake color={C.ink} size={16} />} onPress={() => patch(c, 'FROZEN')().catch((e) => Alert.alert('Not frozen', e.message))} />}
              {c.status === 'FROZEN' && <Button small variant="primary" title="Unfreeze" icon={<Play color="#fff" size={16} />} onPress={() => setSheet({ title: 'Unfreeze card', run: patch(c, 'ACTIVE') })} />}
              {c.status !== 'CANCELED' && <Button small variant="ghost" title="Cancel" onPress={() => setSheet({ title: 'Cancel card for good', run: patch(c, 'CANCELED') })} />}
            </View>
          </View>
        ))}
      <PinSheet visible={!!sheet} title={sheet?.title ?? ''} codeOnly onClose={() => setSheet(null)} onConfirm={async (_p, code) => { await sheet?.run(code ?? ''); }} />
    </Screen>
  );
}

