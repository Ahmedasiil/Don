"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { api } from "@/lib/client/api";
import { Button, Field, Input } from "@/components/ui";
import { safeNext } from "@/lib/public";

export default function SignIn() {
  const sp = useSearchParams();
  const next = safeNext(sp.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const done = (r: { redirect: string; mustEnable2fa?: boolean }) => { location.href = r.mustEnable2fa ? r.redirect : next ?? r.redirect; };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      if (challenge) { done(await api("/api/auth/2fa", { body: { challenge, code: code.trim() } })); return; }
      const r = await api("/api/auth/signin", { body: { email, password } });
      if (r.mfaRequired) { setChallenge(r.challenge); setBusy(false); return; }
      done(r);
    } catch (er: any) {
      if (challenge && er.status === 401 && /expired|again/i.test(er.message)) setChallenge(null);
      setErr(er.message); setBusy(false);
    }
  };

  if (challenge) return (
    <form onSubmit={submit} className="space-y-5">
      <button type="button" onClick={() => { setChallenge(null); setCode(""); }} className="flex items-center gap-1 text-[13px] font-semibold text-muted"><ArrowLeft className="h-4 w-4 rtl:rotate-180" />Back</button>
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sky text-blue"><ShieldCheck className="h-6 w-6" /></span>
      <div><h1 className="font-display text-[28px] font-semibold tracking-tight">Two-step sign-in</h1><p className="mt-1 text-[14px] text-muted">{useRecovery ? "Enter one of your recovery codes." : "Enter the 6-digit code from your authenticator app."}</p></div>
      {useRecovery
        ? <Input autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="xxxx-xxxx" className="h-12 font-mono text-lg" autoComplete="one-time-code" />
        : <Input autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className="h-14 text-center font-mono text-2xl tracking-[0.5em]" />}
      {err && <p className="rounded-xl bg-[#FFF5F7] px-3 py-2 text-[13px] text-crit">{err}</p>}
      <Button variant="pri" type="submit" loading={busy} disabled={code.trim().length < 6} className="h-12 w-full">Verify and sign in</Button>
      <button type="button" onClick={() => { setUseRecovery(!useRecovery); setCode(""); }} className="text-[13px] font-semibold text-blue">{useRecovery ? "Use my authenticator app" : "Lost your phone? Use a recovery code"}</button>
    </form>
  );

  return (
    <form onSubmit={submit} className="space-y-5">
      <div><h1 className="font-display text-[32px] font-semibold tracking-tight">Welcome back</h1><p className="mt-1 text-[14px] text-muted">Sign in to oenodpay.</p></div>
      <Field label="Email"><Input type="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" className="h-12" /></Field>
      <Field label="Password"><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="h-12" /></Field>
      <div className="-mt-2 text-end"><Link href={`/forgot${email ? `?email=${encodeURIComponent(email)}` : ""}`} className="text-[13px] font-semibold text-blue">Forgot password?</Link></div>
      {err && <p className="rounded-xl bg-[#FFF5F7] px-3 py-2 text-[13px] text-crit">{err}</p>}
      <Button variant="pri" type="submit" loading={busy} className="h-12 w-full text-[14.5px]">Sign in</Button>
      <p className="text-center text-[13.5px] text-muted">New to oenodpay? <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-bold text-blue">Create an account</Link></p>
    </form>
  );
}
