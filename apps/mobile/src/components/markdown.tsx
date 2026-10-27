import { Text, View, type TextStyle } from 'react-native';
import { C, F } from '@/lib/theme';

// Just enough Markdown for AI replies: paragraphs, bullets, numbered lists, **bold** and headings.
function Inline({ text, style }: { text: string; style?: TextStyle }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return <Text style={[{ fontSize: 15, lineHeight: 22, color: C.text, fontFamily: F.regular }, style]}>{parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <Text key={i} style={{ fontFamily: F.bold, color: C.ink }}>{p.slice(2, -2)}</Text> : p.replace(/`/g, '')))}</Text>;
}

export function Markdown({ text, color }: { text: string; color?: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  return (
    <View style={{ gap: 6 }}>
      {lines.map((l, i) => {
        const s = l.trim();
        if (!s) return null;
        const h = s.match(/^#{1,4}\s+(.*)/);
        if (h) return <Inline key={i} text={h[1]} style={{ fontFamily: F.display, color: color ?? C.ink, fontSize: 16 }} />;
        const b = s.match(/^([-*•]|\d+[.)])\s+(.*)/);
        if (b) return (
          <View key={i} style={{ flexDirection: 'row', gap: 8, paddingStart: 4 }}>
            <Text style={{ color: color ?? C.blue, fontFamily: F.bold, minWidth: 14 }}>{/\d/.test(b[1]) ? b[1] : '•'}</Text>
            <View style={{ flex: 1 }}><Inline text={b[2]} style={color ? { color } : undefined} /></View>
          </View>
        );
        return <Inline key={i} text={s} style={color ? { color } : undefined} />;
      })}
    </View>
  );
}
