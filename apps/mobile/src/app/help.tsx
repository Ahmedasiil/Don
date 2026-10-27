import { useState } from 'react';
import { View } from 'react-native';
import { Bot, User as UserIcon } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { C } from '@/lib/theme';
import { Button, Card, ErrorText, Input, Screen, Section, T } from '@/components/ui';

type Msg = { id: string; from: string; body: string };
type C2 = { id: string; subject: string; status: string; messages: Msg[] };

export default function Help() {
  const { data: list, refetch } = useApi<{ cases: { id: string; subject: string; status: string }[] }>('/api/pay/support');
  const [open, setOpen] = useState<string | null>(null);
  const { data: c, refetch: refetchCase } = useApi<C2>(open ? `/api/pay/support/${open}` : null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const send = async () => {
    setBusy(true); setErr(null);
    try {
      if (open) { await api(`/api/pay/support/${open}`, { body: { message: text } }); refetchCase(); }
      else { const r = await api<{ id: string }>('/api/pay/support', { body: { message: text } }); setOpen(r.id); refetch(); }
      setText('');
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Screen edges={[]} onRefresh={open ? refetchCase : refetch}>
      {open && c ? (
        <View style={{ gap: 10 }}>
          <Button small variant="ghost" title="All conversations" onPress={() => setOpen(null)} style={{ alignSelf: 'flex-start' }} />
          {c.messages.map((m) => <Card key={m.id} style={{ backgroundColor: m.from === 'CUSTOMER' ? C.sky : C.paper, flexDirection: 'row', gap: 10 }}>{m.from === 'CUSTOMER' ? <UserIcon color={C.muted} size={18} /> : <Bot color={C.blue} size={18} />}<T v="body" style={{ flex: 1 }}>{m.body}</T></Card>)}
          {c.status === 'WAITING_AGENT' && <T v="small" color={C.muted}>A member of our team will reply here. We'll notify you.</T>}
        </View>
      ) : (
        <>
          <T v="body" color={C.muted}>Our AI assistant answers right away and brings in a person whenever you need one.</T>
          {list && list.cases.length > 0 && <Section title="Your conversations">{list.cases.map((x) => <Button key={x.id} title={x.subject} onPress={() => setOpen(x.id)} />)}</Section>}
        </>
      )}
      <Input value={text} onChangeText={setText} placeholder={open ? 'Write a message' : "Tell us what's going on"} multiline maxLength={4000} />
      <ErrorText text={err} />
      <Button title={open ? 'Send' : 'Start chat'} variant="primary" loading={busy} disabled={text.trim().length < 2} onPress={send} />
      <T v="small" color={C.muted}>Never share your password, PIN or codes, even with us.</T>
    </Screen>
  );
}
