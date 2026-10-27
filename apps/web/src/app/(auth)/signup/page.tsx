"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/client/api";
import { safeNext } from "@/lib/public";
import { Button, Field, Input, Select, cx } from "@/components/ui";

// Wallets open in the launch countries (PAY_HOME_COUNTRIES on the server).
const COUNTRIES = ["CA", "US"];

function strength(p: string) {
  let s = 0;
  if (p.length >= 10) s++; if (p.length >= 14) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++; if (/\d/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(4, s);
}

export default function SignUp() {
  const sp = useSearchParams();
  const next = safeNext(sp.get("next"));
  const [v, setV] = useState({ name: "", email: "", password: "", country: "CA", phone: "", marketingConsent: false });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [names, setNames] = useState(() => COUNTRIES.map((c) => ({ value: c, label: c })));
  useEffect(() => {
    try { const d = new Intl.DisplayNames([navigator.language || "en"], { type: "region" }); setNames(COUNTRIES.map((c) => ({ value: c, label: d.of(c) ?? c }))); } catch {}
    try { const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; if (tz.startsWith("America/") && !/Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Montreal/.test(tz)) setV((x) => ({ ...x, country: "US" })); } catch {}
  }, []);
  const set = (k: string, x: unknown) => setV((s) => ({ ...s, [k]: x }));
  const st = strength(v.password);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const r = await api("/api/auth/signup", { body: { name: v.name, email: v.email, password: v.password, country: v.country, phone: v.phone || undefined, marketingConsent: v.marketingConsent, referral: sp.get("ref") ?? undefined } });
      location.href = next ?? r.redirect;
    } catch (er: any) { setErr(er.message); setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-5">
      <div><h1 className="font-display text-[32px] font-semibold tracking-[-.025em]">Open your account</h1><p className="mt-1 text-[14px] text-muted">Free to open. Takes about three minutes with your ID.</p></div>
      <Field label="Full legal name" required help="As it appears on your ID."><Input required minLength={2} value={v.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" className="h-11" /></Field>
      <Field label="Email" required><Input type="email" required value={v.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" className="h-11" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Country you live in"><Select value={v.country} onChange={(e) => set("country", e.target.value)} options={names} /></Field>
        <Field label="Mobile (optional)"><Input type="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" placeholder="+1" className="h-11" /></Field>
      </div>
      <Field label="Password" required help="At least 10 characters. A short sentence works well.">
        <Input type="password" required minLength={10} value={v.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" className="h-11" />
        {v.password && <div className="mt-2 flex gap-1">{[0, 1, 2, 3].map((i) => <span key={i} className={cx("h-1 flex-1 rounded-full", i < st ? (st < 2 ? "bg-crit" : st < 3 ? "bg-[#FFB020]" : "bg-[#1FAF6B]") : "bg-line")} />)}</div>}
      </Field>
      <label className="flex items-start gap-2 text-[12.5px] leading-5 text-muted"><input type="checkbox" className="mt-0.5" checked={v.marketingConsent} onChange={(e) => set("marketingConsent", e.target.checked)} />Send me offers and product news from oenodpay. You can unsubscribe at any time.</label>
      {err && <p className="rounded-xl bg-[#FFF5F7] px-3 py-2 text-[13px] text-crit">{err}{/already exists/.test(err) && <> <Link href="/signin" className="font-bold underline">Sign in</Link></>}</p>}
      <Button variant="pri" type="submit" loading={busy} className="h-12 w-full text-[14.5px]">Open my account</Button>
      <p className="text-center text-[11.5px] leading-5 text-muted">By continuing you agree to the <a href="/legal/terms" className="underline">Terms</a> and <a href="/legal/privacy" className="underline">Privacy Policy</a>.</p>
      <p className="text-center text-[13.5px] text-muted">Already have an account? <Link href={`/signin${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-bold text-blue">Sign in</Link></p>
    </form>
  );
}
