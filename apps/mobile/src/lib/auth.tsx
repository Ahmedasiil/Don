import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, loadToken, saveToken, setSignedOutHandler } from './api';
import { registerForPush, unregisterPush } from './push';

export type Session = {
  user: { id: string; name: string; email: string; phone?: string | null; isSuperAdmin: boolean; twoFactor: boolean };
  unread: number;
};

type Auth = {
  ready: boolean;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<{ challenge?: string }>;
  verify2fa: (challenge: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};
const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  const refresh = useCallback(async () => { setSession(await api<Session>('/api/auth/me')); }, []);

  useEffect(() => {
    setSignedOutHandler(() => setSession(null));
    (async () => {
      try { if (await loadToken()) await refresh(); } catch { /* signed out or offline: show sign-in */ }
      finally { setReady(true); }
    })();
  }, [refresh]);

  // Ask for notifications once someone is signed in.
  useEffect(() => { if (session) registerForPush().catch(() => {}); }, [session?.user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = async (token: string) => { await saveToken(token); await refresh(); };
  const value: Auth = {
    ready, session, refresh,
    signIn: async (email, password) => {
      const r = await api<{ token?: string; mfaRequired?: boolean; challenge?: string }>('/api/auth/signin', { body: { email, password }, auth: false });
      if (r.mfaRequired && r.challenge) return { challenge: r.challenge };
      if (r.token) await finish(r.token);
      return {};
    },
    verify2fa: async (challenge, code) => {
      const r = await api<{ token: string }>('/api/auth/2fa', { body: { challenge, code }, auth: false });
      await finish(r.token);
    },
    signOut: async () => {
      await unregisterPush().catch(() => {});
      await api('/api/auth/signout', { body: {} }).catch(() => {});
      await saveToken(null);
      setSession(null);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const a = useContext(Ctx);
  if (!a) throw new Error('useAuth must be used inside AuthProvider');
  return a;
}
