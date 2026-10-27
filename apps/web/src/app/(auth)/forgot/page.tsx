"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import { api } from "@/lib/client/api";
import { Button, Field, Input } from "@/components/ui";

export default function Forgot() {
  const sp = useSearchParams();
  const [email, setEmail] = useState(sp.get("email") ?? "");
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (sent) return (
    <div className="space-y-4 text-center">
      <MailCheck className="mx-auto h-12 w-12 text-blue" />
      <h1 className="font-display text-[28px] font-semibold tracking-tight">Check your email</h1>
      <p className="text-[14px] text-muted">{sent} The link works for one hour.</p>
      <Link href="/signin" className="btn mt-2">Back to sign in</Link>
    </div>
  );
  return (
    <form className="space-y-5" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(null); try { const r = await api("/api/auth/forgot", { body: { email } }); setSent(r.message); } catch (er: any) { setErr(er.message); } finally { setBusy(false); } }}>
      <div><h1 className="font-display text-[30px] font-semibold tracking-tight">Reset your password</h1><p className="mt-1 text-[14px] text-muted">Enter your email and we'll send you a link to choose a new one.</p></div>
      <Field label="Email"><Input type="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="h-12" /></Field>
      {err && <p className="rounded-xl bg-[#FFF5F7] px-3 py-2 text-[13px] text-crit">{err}</p>}
      <Button variant="pri" type="submit" loading={busy} className="h-12 w-full">Send reset link</Button>
      <p className="text-center text-[13.5px]"><Link href="/signin" className="font-bold text-blue">Back to sign in</Link></p>
    </form>
  );
}
