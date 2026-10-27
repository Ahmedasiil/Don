import { useState } from 'react';
import { Linking, View } from 'react-native';
import { ArrowDownLeft, ArrowUpRight, Download } from 'lucide-react-native';
import { useApi } from '@/lib/use-api';
import { API_URL } from '@/lib/config';
import { money } from '@/lib/pay';
import { C } from '@/lib/theme';
import { Button, Chips, Empty, IconTile, List, Loading, Row, Screen, Stat, T } from '@/components/ui';

type R = { rows: { id: string; kind: string; memo: string | null; at: string; amountCents: number; currency: string }[]; inCents: number; outCents: number; currency: string };
const TYPES = [['', 'All'], ['in', 'Money in'], ['transfers', 'Transfers'], ['cards', 'Card'], ['bills', 'Bills'], ['invest', 'Investing'], ['travel', 'Travel']] as const;

export default function Activity() {
  const [type, setType] = useState<(typeof TYPES)[number][0]>('');
  const { data, refreshing, reload } = useApi<R>(`/api/pay/activity?type=${type}`);
  return (
    <Screen edges={[]} refreshing={refreshing} onRefresh={reload}>
      <Chips value={type} onChange={setType} options={TYPES} />
      {!data ? <Loading /> : <>
        <View style={{ flexDirection: 'row', gap: 10 }}><Stat label="Money in" value={`+${money(data.inCents, data.currency)}`} style={{ flex: 1 }} /><Stat label="Money out" value={`−${money(data.outCents, data.currency)}`} style={{ flex: 1 }} /></View>
        {!data.rows.length ? <Empty text="Nothing in the last 90 days." /> : <List>{data.rows.map((r) => (
          <Row key={r.id} title={r.memo ?? r.kind} sub={new Date(r.at).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            icon={<IconTile tone={r.amountCents > 0 ? 'green' : 'gray'}>{r.amountCents > 0 ? <ArrowDownLeft color={C.green} size={17} /> : <ArrowUpRight color={C.text} size={17} />}</IconTile>}
            right={<T v="bodyStrong" color={r.amountCents > 0 ? C.green : C.ink}>{`${r.amountCents > 0 ? '+' : '−'}${money(Math.abs(r.amountCents), r.currency)}`}</T>} />
        ))}</List>}
        <Button title="Download statement on the web" icon={<Download color={C.ink} size={18} />} onPress={() => Linking.openURL(`${API_URL}/app/activity`)} />
      </>}
    </Screen>
  );
}
