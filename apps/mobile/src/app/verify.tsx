import { useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { BadgeCheck, Clock, IdCard, ScanFace } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { type Overview } from '@/lib/pay';
import { C } from '@/lib/theme';
import { Button, EmptyState, ErrorText, IconTile, List, Loading, Row, Screen, T } from '@/components/ui';

export default function Verify() {
  const { data: o, refetch } = useApi<Overview>('/api/pay/overview');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!o) return <Screen edges={[]}><Loading /></Screen>;
  const s = o.profile.kycStatus;
  if (s === 'VERIFIED') return <Screen edges={[]}><EmptyState icon={<BadgeCheck color={C.green} size={28} />} title="You're verified" text={o.profile.name ?? ''} /></Screen>;
  if (s === 'PENDING' || s === 'REVIEW') return <Screen edges={[]}><EmptyState icon={<Clock color={C.blue} size={28} />} title="Checking your documents" text="Most checks finish in a few minutes." action={<Button title="Refresh" onPress={refetch} />} /></Screen>;
  return (
    <Screen edges={[]}>
      <T v="body" color={C.muted}>Required by law before you can send money. About two minutes.</T>
      <List>
        <Row title="Photo of your ID" sub="Passport, driver's licence or national ID" icon={<IconTile tone="blue"><IdCard color={C.blue} size={18} /></IconTile>} />
        <Row title="A quick live selfie" sub="Matched to your ID photo" icon={<IconTile tone="violet"><ScanFace color={C.violet} size={18} /></IconTile>} />
      </List>
      {s === 'REJECTED' && <ErrorText text="We couldn't verify your last attempt. Use a valid ID in good light and try again." />}
      <ErrorText text={err} />
      <Button title="Start verification" variant="primary" big loading={busy} onPress={async () => { setBusy(true); setErr(null); try { const r = await api<{ url: string }>('/api/pay/kyc', { body: { returnPath: '/verify' } }); await WebBrowser.openBrowserAsync(r.url); refetch(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } }} />
    </Screen>
  );
}
