import { P } from '@/components/pay-ui';
import { useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { Star, TrendingDown, TrendingUp } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { C } from '@/lib/theme';
import { Chips, ErrorText, IconTile, List, Loading, Row, Screen, T } from '@/components/ui';

type Q = { symbol: string; name: string; kind: string; price: number | null; changePct: number | null; currency: string; halal: boolean };
const fmt = (p: number | null, cur: string) => { if (p == null) return '—'; try { return new Intl.NumberFormat('en-CA', { style: 'currency', currency: cur.length === 3 ? cur : 'USD', currencyDisplay: 'narrowSymbol', maximumFractionDigits: p < 10 ? 4 : 2 }).format(p); } catch { return p.toFixed(2); } };

export default function Markets() {
  const [tab, setTab] = useState<'ALL' | 'WATCH' | 'STOCK' | 'CRYPTO' | 'METAL' | 'FX'>('ALL');
  const [halal, setHalal] = useState(false);
  const { data, error, refreshing, reload } = useApi<{ quotes: Q[]; note: string }>('/api/pay/markets');
  const { data: wl, refetch } = useApi<{ watch: { symbol: string }[] }>('/api/pay/watchlist');
  if (!data) return <Screen edges={[]}>{error ? <ErrorText text={error} /> : <Loading />}</Screen>;
  const watched = new Set(wl?.watch.map((w) => w.symbol));
  const list = data.quotes.filter((q) => (tab === 'ALL' || (tab === 'WATCH' ? watched.has(q.symbol) : q.kind === tab)) && (!halal || q.halal));
  const toggleWatch = async (q: Q) => { try { if (watched.has(q.symbol)) await api(`/api/pay/watchlist?symbol=${encodeURIComponent(q.symbol)}`, { method: 'DELETE' }); else await api('/api/pay/watchlist', { body: { symbol: q.symbol } }); refetch(); } catch (e) { Alert.alert('Not saved', (e as Error).message); } };
  return (
    <Screen edges={[]} refreshing={refreshing} onRefresh={reload}>
      <Chips options={[['ALL', 'All'], ['WATCH', 'Watchlist'], ['STOCK', 'Stocks'], ['CRYPTO', 'Crypto'], ['METAL', 'Gold'], ['FX', 'Currencies']] as const} value={tab} onChange={setTab} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><T v="bodyStrong">Halal only</T><Switch value={halal} onValueChange={setHalal} trackColor={{ true: P.ink, false: C.line }} thumbColor="#fff" /></View>
      <List>{list.map((q) => (
        <Row key={q.symbol} title={q.name} sub={`${q.symbol}${watched.has(q.symbol) ? ' · watching' : ''}`} onPress={() => toggleWatch(q)}
          icon={<IconTile tone={watched.has(q.symbol) ? 'amber' : 'blue'}>{watched.has(q.symbol) ? <Star color={C.amber} size={16} /> : q.changePct != null && q.changePct < 0 ? <TrendingDown color={C.red} size={16} /> : <TrendingUp color={C.blue} size={16} />}</IconTile>}
          right={<View style={{ alignItems: 'flex-end' }}><T v="bodyStrong">{fmt(q.price, q.currency)}</T>{q.changePct != null && <T v="small" color={q.changePct >= 0 ? C.green : C.red}>{q.changePct >= 0 ? '+' : ''}{q.changePct.toFixed(2)}%</T>}</View>} />
      ))}</List>
      <T v="small" color={C.muted}>Tap to add to or remove from your watchlist. {data.note}</T>
    </Screen>
  );
}
