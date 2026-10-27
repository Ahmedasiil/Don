import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { F } from '@/lib/theme';

// oenodpay's private-banking palette: graphite ink, quiet greys, one blue for live data.
export const P = {
  ink: '#0B1020', ink2: '#1C2235', canvas: '#F6F7F9', paper: '#FFFFFF', line: '#E7E9EF', hair: '#EEF0F4',
  text: '#344054', muted: '#667085', faint: '#98A2B3', blue: '#2E5BFF', green: '#12B76A', greenText: '#067647', greenBg: '#ECFDF3',
  amber: '#F79009', amberText: '#B54708', amberBg: '#FFFAEB', red: '#F04438', redText: '#B42318', redBg: '#FEF3F2',
};

/** The one dark surface on a screen: graphite with a soft blue glow. */
export function PayHero({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[st.hero, style]}>
      <LinearGradient colors={['#0B1020', '#111833', '#0B1020']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(46,91,255,0.22)', 'rgba(46,91,255,0)']} start={{ x: 1, y: 0 }} end={{ x: 0.3, y: 0.8 }} style={StyleSheet.absoluteFill} />
      <View style={{ padding: 22, gap: 14 }}>{children}</View>
    </View>
  );
}

const STATUS: Record<string, [string, string]> = {
  DELIVERED: ['Delivered', P.green], COMPLETED: ['Completed', P.green], ACTIVE: ['Active', P.green], VERIFIED: ['Verified', P.green], READY: ['Ready', P.green], APPROVED: ['Approved', P.green],
  SENT: ['Sent', P.blue], PROCESSING: ['Processing', P.blue], OPEN: ['Open', P.blue],
  REVIEW: ['In review', P.amber], PENDING: ['Pending', P.amber], INVITED: ['Invited', P.amber], FROZEN: ['Frozen', P.faint], INACTIVE: ['Frozen', P.faint], PAUSED: ['Paused', P.faint],
  FAILED: ['Failed', P.red], REJECTED: ['Rejected', P.red], DECLINED: ['Declined', P.red], CANCELLED: ['Cancelled', P.faint], CANCELED: ['Cancelled', P.faint], REFUNDED: ['Refunded', P.faint],
};
/** A quiet status: coloured dot and a word. */
export function Status({ status }: { status: string }) {
  const [label, color] = STATUS[status] ?? [status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' '), P.faint];
  return <View style={st.status}><View style={[st.dot, { backgroundColor: color }]} /><Text style={st.statusText}>{label}</Text></View>;
}

/** Small uppercase label used above figures and sections. */
export const Label = ({ children, color = P.muted, style }: { children: React.ReactNode; color?: string; style?: any }) => <Text style={[st.label, { color }, style]}>{children}</Text>;

/** White panel with a hairline border. */
export function Panel({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) return <Pressable onPress={onPress} style={({ pressed }) => [st.panel, pressed && { backgroundColor: '#FAFBFC' }, style]}>{children}</Pressable>;
  return <View style={[st.panel, style]}>{children}</View>;
}

export const initials = (n: string) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
export const flag = (cc: string) => cc.toUpperCase().replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)));

const st = StyleSheet.create({
  hero: { borderRadius: 24, overflow: 'hidden', backgroundColor: P.ink },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: P.line, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-end' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: F.medium, fontSize: 11.5, color: P.text },
  label: { fontFamily: F.semi, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  panel: { backgroundColor: P.paper, borderRadius: 18, borderWidth: 1, borderColor: P.line },
});
