import { P } from '@/components/pay-ui';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, Sparkles } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { C, F } from '@/lib/theme';
import { Markdown } from '@/components/markdown';
import { Loading, T } from '@/components/ui';

type M = { role: 'user' | 'assistant'; content: string };
const STARTERS = ['Make me a budget', 'Build an emergency fund', 'Pay off my credit card faster', 'Raise my credit score', 'TFSA vs RRSP vs FHSA'];

export default function Coach() {
  const { data } = useApi<{ messages: M[]; health: { score: number } }>('/api/pay/coach');
  const [msgs, setMsgs] = useState<M[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  useEffect(() => { if (data) setMsgs(data.messages); }, [data]);
  const ask = async (q: string) => {
    if (!q.trim() || busy) return;
    setMsgs((m) => [...m, { role: 'user', content: q }]); setText(''); setBusy(true);
    try { const r = await api<{ reply: string }>('/api/pay/coach', { body: { message: q } }); setMsgs((m) => [...m, { role: 'assistant', content: r.reply }]); }
    catch (e) { setMsgs((m) => [...m, { role: 'assistant', content: (e as Error).message }]); }
    finally { setBusy(false); }
  };
  if (!data) return <Loading />;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView ref={scroll} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })} contentContainerStyle={{ padding: 18, gap: 12 }}>
          <View style={st.score}><Sparkles color={C.blue} size={18} /><T v="bodyStrong">Financial Health Score {data.health.score}/100</T></View>
          {!msgs.length && <View style={{ gap: 8 }}><T v="body" color={C.muted}>Hi, I'm Oeno. Ask me anything about your money.</T><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{STARTERS.map((s) => <Pressable key={s} onPress={() => ask(s)} style={st.starter}><Text style={st.starterText}>{s}</Text></Pressable>)}</View></View>}
          {msgs.map((m, i) => <View key={i} style={[st.bubble, m.role === 'user' ? st.me : st.bot]}>{m.role === 'assistant' ? <Markdown text={m.content} /> : <Text style={st.meText}>{m.content}</Text>}</View>)}
          {busy && <T v="small" color={C.muted}>Oeno is thinking…</T>}
        </ScrollView>
        <View style={st.bar}>
          <TextInput value={text} onChangeText={setText} placeholder="Ask Oeno…" placeholderTextColor={C.faint} style={st.input} multiline maxLength={2000} />
          <Pressable onPress={() => ask(text)} style={st.send} accessibilityLabel="Send"><Send color="#fff" size={18} /></Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  score: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: C.sky, borderRadius: 14, padding: 12 },
  starter: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: C.paper },
  starterText: { fontFamily: F.semi, fontSize: 13, color: C.ink },
  bubble: { maxWidth: '88%', borderRadius: 18, padding: 12 },
  me: { alignSelf: 'flex-end', backgroundColor: P.ink },
  bot: { alignSelf: 'flex-start', backgroundColor: C.paper },
  meText: { fontFamily: F.medium, fontSize: 14.5, color: '#fff' },
  bar: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, backgroundColor: C.paper },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 14, backgroundColor: C.bg, paddingHorizontal: 14, paddingVertical: 10, fontFamily: F.medium, fontSize: 15, color: C.ink },
  send: { width: 44, height: 44, borderRadius: 14, backgroundColor: P.ink, alignItems: 'center', justifyContent: 'center' },
});
