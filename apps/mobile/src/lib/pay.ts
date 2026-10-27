import { ApiError } from './api';

// Shared types and helpers for the oenodpay screens.

export type Overview = {
  currency: string; balanceCents: number; availableCents: number;
  profile: { tier: number; kycStatus: string; name: string | null; country: string | null; frozen: boolean; pinSet: boolean; twoStep: boolean };
  limits: { perTransfer: number; daily: number; monthly: number; wallet: number; newDevice: boolean };
  health: { score: number; parts: Record<string, number>; bufferMonths: number; currency: string };
  recent: { id: string; kind: string; memo: string | null; at: string; amountCents: number; currency: string }[];
  cards: { id: string; last4: string; status: string; type: string; brand: string; expMonth: number; expYear: number }[];
  familyCount: number;
  transfers: { id: string; status: string; sendCents: number; sendCurrency: string; receiveCents: number; receiveCurrency: string; createdAt: string; recipient: { name: string; country: string; label: string | null } }[];
};

export const money = (cents: number | null | undefined, currency = 'CAD') => {
  try { return new Intl.NumberFormat('en-CA', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format((cents ?? 0) / 100); }
  catch { return `${((cents ?? 0) / 100).toFixed(2)} ${currency}`; }
};

export const statusTone = (s: string) => (['DELIVERED', 'ACTIVE', 'VERIFIED', 'READY', 'APPROVED'].includes(s) ? 'green' : ['REVIEW', 'PENDING', 'PROCESSING', 'SENT', 'FROZEN', 'PAUSED'].includes(s) ? 'amber' : ['FAILED', 'CANCELLED', 'CANCELED', 'REJECTED', 'DECLINED', 'REFUNDED'].includes(s) ? 'red' : 'gray') as 'green' | 'amber' | 'red' | 'gray';
export const human = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

/** The server puts machine-readable reasons (STEP_UP_REQUIRED, PIN_LOCKED...) in details.code. */
export const errCode = (e: unknown) => (e instanceof ApiError ? ((e.data as { details?: { code?: string } })?.details?.code ?? null) : null);

export const newKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

/** First thing the person must do before money can move, or null when ready. */
export function nextStep(o: Overview) {
  if (o.profile.frozen) return { title: 'Your account is on hold', text: 'Contact support to unfreeze it.', route: '/help' as const };
  if (!o.profile.twoStep) return { title: 'Turn on two-step sign-in', text: 'Required to move money. Protects you even if your password leaks.', route: '/security' as const };
  if (o.profile.kycStatus !== 'VERIFIED') return { title: o.profile.kycStatus === 'PENDING' ? 'Verification in progress' : 'Verify your identity', text: 'About two minutes with your ID and a selfie.', route: '/verify' as const };
  if (!o.profile.pinSet) return { title: 'Create your 6-digit PIN', text: 'You will use it to confirm payments.', route: '/security' as const };
  return null;
}

export function ago(v: string | Date) {
  const s = Math.max(0, (Date.now() - new Date(v).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(v).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}
