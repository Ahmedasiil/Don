import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, ExternalLink, FileText, Gauge, Gift, HandCoins, LifeBuoy, LineChart, LogOut, Receipt, ShieldCheck, Sparkles, UserRound, Users, Wifi } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { API_URL, APP_VERSION } from '@/lib/config';
import { C, F } from '@/lib/theme';
import { Avatar, Badge, HeroCard, IconTile, List, Row, Screen, Section, T } from '@/components/ui';

export default function More() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const go = (r: string) => () => router.push(r as never);
  const confirmSignOut = () => Alert.alert('Sign out', 'You will need your password to sign back in.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: () => signOut() }]);
  return (
    <Screen title="More">
      <HeroCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar name={session?.user.name ?? ''} size={58} ring />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={st.name} numberOfLines={1}>{session?.user.name}</Text>
            <Text style={st.email} numberOfLines={1}>{session?.user.email}</Text>
          </View>
        </View>
      </HeroCard>
      <Section title="Money">
        <List>
          <Row title="Request money" icon={<IconTile><HandCoins color={C.blue} size={18} /></IconTile>} chevron onPress={go('/request')} />
          <Row title="Pay bills" icon={<IconTile><Receipt color={C.blue} size={18} /></IconTile>} chevron onPress={go('/bills')} />
          <Row title="Statements" sub="Every movement, download any dates" icon={<IconTile><FileText color={C.blue} size={18} /></IconTile>} chevron onPress={go('/activity')} />
        </List>
      </Section>
      <Section title="Grow">
        <List>
          <Row title="Credit and loans" icon={<IconTile tone="green"><Gauge color={C.green} size={18} /></IconTile>} chevron onPress={go('/credit')} />
          <Row title="Rewards" icon={<IconTile tone="green"><Gift color={C.green} size={18} /></IconTile>} chevron onPress={go('/rewards')} />
          <Row title="Markets and alerts" icon={<IconTile tone="green"><LineChart color={C.green} size={18} /></IconTile>} chevron onPress={go('/markets')} />
          <Row title="Oeno, money coach" icon={<IconTile tone="violet"><Sparkles color={C.violet} size={18} /></IconTile>} chevron onPress={go('/coach')} />
        </List>
      </Section>
      <Section title="Life">
        <List>
          <Row title="Family" sub="Teen cards and rules" icon={<IconTile tone="amber"><Users color={C.amber} size={18} /></IconTile>} chevron onPress={go('/family')} />
          <Row title="Travel eSIM" icon={<IconTile tone="amber"><Wifi color={C.amber} size={18} /></IconTile>} chevron onPress={go('/esim')} />
        </List>
      </Section>
      <Section title="Account">
        <List>
          <Row title="Notifications" icon={<IconTile><Bell color={C.blue} size={18} /></IconTile>} right={session?.unread ? <Badge text={String(session.unread)} tone="red" /> : undefined} chevron onPress={go('/notifications')} />
          <Row title="Profile" icon={<IconTile><UserRound color={C.blue} size={18} /></IconTile>} chevron onPress={go('/profile')} />
          <Row title="Security" sub={session?.user.twoFactor ? 'Two-step sign-in is on' : 'Turn on two-step sign-in'} icon={<IconTile tone={session?.user.twoFactor ? 'green' : 'amber'}><ShieldCheck color={session?.user.twoFactor ? C.green : C.amber} size={18} /></IconTile>} chevron onPress={go('/security')} />
          <Row title="Help" sub="Chat with us any time" icon={<IconTile><LifeBuoy color={C.blue} size={18} /></IconTile>} chevron onPress={go('/help')} />
          <Row title="Open oenodpay on the web" icon={<IconTile tone="navy"><ExternalLink color="#fff" size={17} /></IconTile>} right={<ExternalLink color={C.faint} size={16} />} onPress={() => Linking.openURL(`${API_URL}/app`)} />
        </List>
      </Section>
      <List>
        <Row title="Sign out" danger icon={<IconTile tone="red"><LogOut color={C.red} size={18} /></IconTile>} onPress={confirmSignOut} />
      </List>
      <T v="caption" color={C.faint} style={{ textAlign: 'center' }}>oenodpay {APP_VERSION}</T>
    </Screen>
  );
}

const st = StyleSheet.create({
  name: { color: '#fff', fontFamily: F.display, fontSize: 20, letterSpacing: -0.4 },
  email: { color: C.onNavy, fontFamily: F.medium, fontSize: 13.5 },
});
