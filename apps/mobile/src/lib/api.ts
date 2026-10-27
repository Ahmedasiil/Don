import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_URL, APP_VERSION } from './config';

const KEY = 'oenodpay.session';
let token: string | null = null;
let onSignedOut: (() => void) | null = null;

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: unknown) { super(message); }
}

// The phone's keychain (iOS) or keystore (Android). The web preview falls back to browser storage.
const store = Platform.OS === 'web'
  ? { get: async () => globalThis.localStorage?.getItem(KEY) ?? null, set: async (v: string) => globalThis.localStorage?.setItem(KEY, v), del: async () => globalThis.localStorage?.removeItem(KEY) }
  : { get: () => SecureStore.getItemAsync(KEY), set: (v: string) => SecureStore.setItemAsync(KEY, v), del: () => SecureStore.deleteItemAsync(KEY) };

export async function loadToken() {
  token = await store.get();
  return token;
}
export async function saveToken(t: string | null) {
  token = t;
  if (t) await store.set(t);
  else await store.del();
}
export const setSignedOutHandler = (fn: () => void) => { onSignedOut = fn; };

/** Every call identifies the app and its version, so the server can tell the app from the website. */
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers: {
        Accept: 'application/json',
        'X-Oenodpay-Client': `mobile/${APP_VERSION} (${Platform.OS})`,
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token && opts.auth !== false ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "You're offline. Check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token && opts.auth !== false) { await saveToken(null); onSignedOut?.(); }
    throw new ApiError(res.status, data?.error ?? 'Something went wrong. Please try again.', data);
  }
  return data as T;
}
