import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Snowflake } from 'lucide-react-native';
import { F } from '@/lib/theme';

type Card = { last4: string; brand: string; status: string; expMonth: number; expYear: number; type?: string };

/** The oenodpay card: brushed graphite metal, or deep cobalt for teen cards. */
export function CardFace({ c, name, teen }: { c: Card; name: string; teen?: boolean }) {
  const off = c.status !== 'ACTIVE';
  return (
    <View style={st.card}>
      <LinearGradient colors={teen ? ['#2A47F0', '#16249A', '#0B1259'] : ['#2B2F3A', '#12141B', '#1C1F28', '#090A0F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)']} start={{ x: 0.7, y: 0 }} end={{ x: 0.4, y: 0.7 }} style={StyleSheet.absoluteFill} />
      <View style={st.top}><Text style={st.brand}>oenod<Text style={{ color: '#8FA4FF' }}>pay</Text></Text><Text style={st.kind}>{teen ? 'TEEN' : c.type === 'PHYSICAL' ? 'METAL' : 'VIRTUAL'}</Text></View>
      <View style={st.chip} />
      <View style={st.foot}>
        <View style={{ flex: 1 }}><Text style={st.name} numberOfLines={1}>{name.toUpperCase()}</Text><Text style={st.num}>•• {c.last4}   <Text style={{ color: 'rgba(255,255,255,0.45)' }}>{String(c.expMonth).padStart(2, '0')}/{String(c.expYear).slice(-2)}</Text></Text></View>
        <Text style={st.visa}>{c.brand.toUpperCase() === 'MASTERCARD' ? 'mastercard' : 'VISA'}</Text>
      </View>
      {off && <View style={st.off}><Snowflake color="#fff" size={18} /><Text style={st.offText}>{c.status === 'CANCELED' ? 'Cancelled' : 'Frozen'}</Text></View>}
    </View>
  );
}

const st = StyleSheet.create({
  card: { aspectRatio: 1.586, borderRadius: 20, padding: 20, overflow: 'hidden', justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', shadowColor: '#080B14', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 14 }, elevation: 8 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontFamily: F.displayBold, fontSize: 16, color: '#fff' },
  kind: { fontFamily: F.semi, fontSize: 10, letterSpacing: 1.8, color: 'rgba(255,255,255,0.55)' },
  chip: { width: 40, height: 30, borderRadius: 6, backgroundColor: '#C9CFDB', opacity: 0.9, marginTop: 'auto', marginBottom: 14 },
  foot: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  name: { fontFamily: F.medium, fontSize: 12.5, letterSpacing: 1, color: 'rgba(255,255,255,0.92)' },
  num: { fontFamily: F.medium, fontSize: 13, letterSpacing: 1.6, color: 'rgba(255,255,255,0.72)', marginTop: 3 },
  visa: { fontFamily: F.displayBold, fontStyle: 'italic', fontSize: 22, color: '#fff' },
  off: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,11,20,0.55)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  offText: { fontFamily: F.display, fontSize: 15, color: '#fff' },
});
