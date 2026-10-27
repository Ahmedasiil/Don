import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BellOff, CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react-native';
import { ago } from '@/lib/pay';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/use-api';
import { linkToRoute } from '@/lib/links';
import { t } from '@/lib/i18n';
import { C, F } from '@/lib/theme';
import { Card, EmptyState, ErrorText, IconTile, List, Loading, Screen, Section } from '@/components/ui';

type N = { id: string; kind: string; title: string; body: string | null; link: string | null; readAt: string | null; createdAt: string };
// Notice kinds from the server, shown with a tone.
const levelOf = (k: string) => (k === 'SECURITY' ? 'warn' : ['MONEY_IN', 'REWARD'].includes(k) ? 'success' : 'info');
const LEVEL = {
  success: { tone: 'green', icon: CircleCheck, color: C.green },
  warn: { tone: 'amber', icon: TriangleAlert, color: C.amber },
  error: { tone: 'red', icon: CircleAlert, color: C.red },
  info: { tone: 'blue', icon: Info, color: C.blue },
} as const;

export default function Notifications() {
  const router = useRouter();
  const { refresh } = useAuth();
  const { data, error, refreshing, reload } = useApi<{ rows: N[]; unread: number }>('/api/pay/notices');
  // Opening the list marks everything as read.
  useEffect(() => { if (data?.unread) api('/api/pay/notices', { body: {} }).then(refresh).catch(() => {}); }, [data?.unread]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!data && !error) return <Screen edges={[]}><Loading /></Screen>;
  const items = data?.rows ?? [];
  const today = items.filter((n) => new Date(n.createdAt).toDateString() === new Date().toDateString());
  const earlier = items.filter((n) => !today.includes(n));

  const group = (title: string, list: N[]) => list.length > 0 && (
    <Section title={title}>
      <List>
        {list.map((n) => {
          const L = LEVEL[levelOf(n.kind) as keyof typeof LEVEL] ?? LEVEL.info;
          return (
            <Pressable key={n.id} disabled={!n.link} onPress={() => n.link && router.push(linkToRoute(n.link) as never)} style={({ pressed }) => [st.row, pressed && { backgroundColor: C.bg }]}>
              <IconTile tone={L.tone}><L.icon color={L.color} size={18} /></IconTile>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                  <Text style={[st.title, !n.readAt && { fontFamily: F.bold }]} numberOfLines={2}>{n.title}</Text>
                  {!n.readAt && <View style={st.unread} />}
                </View>
                {n.body && <Text style={st.body} numberOfLines={3}>{n.body}</Text>}
                <Text style={st.when}>{ago(n.createdAt)}</Text>
              </View>
            </Pressable>
          );
        })}
      </List>
    </Section>
  );

  return (
    <Screen edges={[]} refreshing={refreshing} onRefresh={reload}>
      <ErrorText text={error} />
      {items.length ? <>{group(t('common.today'), today)}{group('Earlier', earlier)}</>
        : <Card><EmptyState icon={<BellOff color={C.blue} size={24} />} title="You're all caught up" text="Shift changes, approvals and messages from your team will show up here." /></Card>}
    </Screen>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 22 },
  title: { flex: 1, fontFamily: F.semi, fontSize: 15, color: C.ink, lineHeight: 20 },
  body: { fontFamily: F.regular, fontSize: 14, color: C.text, lineHeight: 20 },
  when: { fontFamily: F.medium, fontSize: 12, color: C.faint },
  unread: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.blue, marginTop: 6 },
});
