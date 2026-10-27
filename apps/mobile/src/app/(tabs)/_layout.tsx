import { StyleSheet, View, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { House, CreditCard, TrendingUp, Plane, LayoutGrid, type LucideIcon } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { C, F } from '@/lib/theme';

// The active tab sits in a soft pill so it's clear at a glance where you are.
const icon = (I: LucideIcon) => ({ focused, color }: { focused: boolean; color: ColorValue }) => (
  <View style={[st.pill, focused && st.pillOn]}>
    <I color={String(color)} size={21} strokeWidth={focused ? 2.3 : 1.9} />
  </View>
);

export default function TabsLayout() {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.ink,
        tabBarInactiveTintColor: C.faint,
        tabBarStyle: { height: 74 + insets.bottom, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: C.paper, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, boxShadow: '0px -6px 24px rgba(16,24,40,0.06)' },
        tabBarLabelStyle: { fontFamily: F.semi, fontSize: 11, marginTop: 2 },
        tabBarBadgeStyle: { backgroundColor: C.red, fontFamily: F.bold, fontSize: 10 },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon(House) }} />
      <Tabs.Screen name="cards" options={{ title: 'Cards', tabBarIcon: icon(CreditCard) }} />
      <Tabs.Screen name="invest" options={{ title: 'Invest', tabBarIcon: icon(TrendingUp) }} />
      <Tabs.Screen name="travel" options={{ title: 'Travel', tabBarIcon: icon(Plane) }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarBadge: session?.unread ? Math.min(session.unread, 99) : undefined, tabBarIcon: icon(LayoutGrid) }} />
    </Tabs>
  );
}

const st = StyleSheet.create({
  pill: { width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  pillOn: { backgroundColor: '#EEF2FF' },
});
