import { useEffect, useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { BadgeCheck } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { useAuth } from '@/lib/auth';
import { C } from '@/lib/theme';
import { Avatar, Badge, Button, Card, Input, Loading, Screen, Section, T } from '@/components/ui';

type P = { name: string; email: string; phone: string | null; country: string | null; tier: number; kycStatus: string; marketingEmailConsent: boolean; marketingSmsConsent: boolean; createdAt: string };

export default function Profile() {
  const { refresh } = useAuth();
  const { data: p, refetch } = useApi<P>('/api/pay/profile');
  const [phone, setPhone] = useState('');
  useEffect(() => { if (p) setPhone(p.phone ?? ''); }, [p]);
  if (!p) return <Screen edges={[]}><Loading /></Screen>;
  const verified = p.kycStatus === 'VERIFIED';
  const save = async (body: Record<string, unknown>) => { try { await api('/api/account', { method: 'PATCH', body }); refetch(); refresh(); } catch (e) { Alert.alert('Not saved', (e as Error).message); } };
  return (
    <Screen edges={[]}>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Avatar name={p.name} size={72} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><T v="title">{p.name}</T>{verified && <BadgeCheck color={C.blue} size={20} />}</View>
        <Badge text={verified ? `Verified · Level ${p.tier}` : 'Not verified yet'} tone={verified ? 'green' : 'amber'} />
      </View>
      <Section title="Details">
        <Card style={{ gap: 12 }}>
          <Input label="Legal name" value={p.name} editable={false} />
          <Input label="Email" value={p.email} editable={false} />
          <Input label="Mobile" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+1" />
          <Button title="Save" variant="primary" disabled={phone === (p.phone ?? '')} onPress={() => save({ phone: phone || null })} />
          {verified && <T v="caption">Your name is verified with your ID. Contact support to change it.</T>}
        </Card>
      </Section>
      <Section title="Offers and news">
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><T v="bodyStrong" style={{ flex: 1 }}>Email me offers</T><Switch value={p.marketingEmailConsent} onValueChange={(v) => save({ marketingEmailConsent: v })} /></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><T v="bodyStrong" style={{ flex: 1 }}>Text me offers</T><Switch value={p.marketingSmsConsent} onValueChange={(v) => save({ marketingSmsConsent: v })} /></View>
          <T v="caption">Security alerts and receipts always come.</T>
        </Card>
      </Section>
    </Screen>
  );
}
