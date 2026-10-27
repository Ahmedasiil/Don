import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useFonts, Sora_300Light, Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora';
import { PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { AuthProvider, useAuth } from '@/lib/auth';
import { linkToRoute } from '@/lib/links';
import { C, F } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Root() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Gate />
    </AuthProvider>
  );
}

const SCREENS: [string, string, boolean?][] = [
  ['send', 'Send money'], ['topup', 'Add money', true], ['request', 'Request money'], ['bills', 'Pay bills'], ['activity', 'Statements'],
  ['markets', 'Markets'], ['credit', 'Credit and loans'], ['rewards', 'Rewards'], ['family', 'Family'],
  ['coach', 'Oeno, money coach'], ['esim', 'Travel eSIM'], ['security', 'Security'], ['verify', 'Verify identity'], ['help', 'Help'],
  ['profile', 'Profile'], ['notifications', 'Notifications'],
];

function Gate() {
  const { ready, session } = useAuth();
  // If the fonts fail to load the app still opens with the system font.
  const [fontsLoaded, fontError] = useFonts({ Sora_300Light, Sora_600SemiBold, Sora_700Bold, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold });
  const fonts = fontsLoaded || !!fontError;
  useNotificationLinks(Boolean(session));
  useEffect(() => { if (ready && fonts) SplashScreen.hideAsync().catch(() => {}); }, [ready, fonts]);
  if (!ready || !fonts) return null;
  return (
    <Stack screenOptions={{ headerShadowVisible: false, headerStyle: { backgroundColor: C.bg }, headerTintColor: C.ink, headerTitleStyle: { fontFamily: F.display, fontSize: 17, color: C.ink }, headerBackButtonDisplayMode: 'minimal', contentStyle: { backgroundColor: C.bg } }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {SCREENS.map(([name, title, modal]) => <Stack.Screen key={name} name={name} options={{ title, presentation: modal ? 'modal' : undefined }} />)}
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="signin" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

// Push notifications only exist on phones; the web preview skips them.
const useLastResponse = Platform.OS === 'web' ? () => null : Notifications.useLastNotificationResponse;

/** Tapping a push notification opens the matching screen. */
function useNotificationLinks(signedIn: boolean) {
  const router = useRouter();
  const last = useLastResponse();
  useEffect(() => {
    if (!signedIn || !last) return;
    const link = last.notification.request.content.data?.link;
    if (typeof link === 'string') router.push(linkToRoute(link) as never);
  }, [signedIn, last, router]);
}
