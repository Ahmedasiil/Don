// oenodpay launches in English. Screens call t() so more languages can be added in one place later.
const EN = {
  'auth.signInTitle': 'Welcome back', 'auth.signInSub': 'Sign in to your oenodpay account.', 'auth.twoFactorTitle': 'Two-step sign-in', 'auth.twoFactorSub': 'Enter the 6-digit code from your authenticator app.',
  'auth.email': 'Email', 'auth.password': 'Password', 'auth.forgot': 'Forgot your password?',
  'common.today': 'Today', 'common.more': 'More', 'common.cancel': 'Cancel', 'common.signOut': 'Sign out', 'common.next': 'Continue', 'common.back': 'Back', 'common.settings': 'Settings',
  'nav.signIn': 'Sign in', 'nav.notifications': 'Notifications', 'nav.security': 'Security', 'nav.home': 'Home',
} as const;
export type Key = keyof typeof EN;
export const locale = () => 'en';
export const t = (k: Key) => EN[k] ?? k;
