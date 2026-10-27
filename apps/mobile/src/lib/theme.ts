// oenodpay's look: graphite ink, quiet greys, one blue for actions. Same palette as the website.
export const C = {
  bg: '#F6F7F9',
  paper: '#FFFFFF',
  ink: '#0B1020',
  text: '#344054',
  muted: '#667085',
  faint: '#98A2B3',
  line: '#E7E9EF',
  hair: '#EEF0F4',
  navy: '#0B1020',
  navyDeep: '#080B14',
  navy2: '#1C2235',
  royal: '#1B2A8A',
  blue: '#2E5BFF',
  sky: '#EEF2FF',
  sky2: '#DCE4FF',
  onNavy: '#C9D4FF',
  onNavyMuted: '#8C9BD9',
  green: '#12B76A',
  greenBg: '#E8F8F0',
  amber: '#9A6100',
  amberBg: '#FFF4DE',
  red: '#F04438',
  redBg: '#FFF1F4',
  violet: '#6C3FE0',
  violetBg: '#F2EDFF',
};

// Gradients for the navy hero surfaces.
export const G = {
  hero: ['#0B1020', '#111833', '#1B2A8A'] as const,
  orb: ['#2E5BFF', '#1B2A8A'] as const,
};

// Typefaces match the web app: Sora for headings and numbers, Plus Jakarta Sans for everything else.
export const F = {
  display: 'Sora_600SemiBold',
  displayBold: 'Sora_700Bold',
  displayLight: 'Sora_300Light',
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semi: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extra: 'PlusJakartaSans_800ExtraBold',
};

export const R = { xs: 8, sm: 12, md: 16, lg: 22, xl: 28, pill: 999 };
export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };

/** Soft, layered shadow used on cards (React Native's boxShadow works on iOS, Android and web). */
const SHADOWS = [
  '0px 1px 2px rgba(16,24,40,0.04), 0px 4px 12px rgba(16,24,40,0.05)',
  '0px 2px 4px rgba(16,24,40,0.04), 0px 10px 24px rgba(16,24,40,0.08)',
  '0px 6px 14px rgba(16,24,40,0.10), 0px 22px 44px rgba(16,24,40,0.18)',
];
export const shadow = (level: 1 | 2 | 3 = 1) => ({ boxShadow: SHADOWS[level - 1] });
