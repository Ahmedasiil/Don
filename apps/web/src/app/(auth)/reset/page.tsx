"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/client/api";
import { Button, Field, Input } from "@/components/ui";

export default function Reset() {
  const t = useSearchParams().get("t") ?? "";
  const [pw, setPw] = useState({ a: "", b: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!t) return <div className="space-y-3"><h1 className="font-display text-[28px] font-semibold">This link is incomplete</h1><p className="text-muted">Open the link from your email again, or ask for a new one.</p><Link href="/forgot" className="btn-pri">Get a new link</Link></div>;
  return (
    <form className="space-y-5" onSubmit={async (e) => {
      e.preventDefault(); setErr(null);
      if (pw.a !== pw.b) return setErr("The passwords don't match.");
      setBusy(true);
      try { const r = await api("/api/auth/reset", { body: { token: t, password: pw.a } }); location.href = r.redirect === "/signin" ? "/signin?reset=1" : r.redirect; }
      catch (er: any) { setErr(er.message); setBusy(false); }
    }}>
      <div><h1 className="font-display text-[30px] font-semibold tracking-tight">Choose a new password</h1><p className="mt-1 text-[14px] text-muted">You'll be signed out on your other devices.</p></div>
      <Field label="New password" help="At least 10 characters."><Input type="password" autoFocus required minLength={10} value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} autoComplete="new-password" className="h-12" /></Field>
      <Field label="Repeat it"><Input type="password" required value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} autoComplete="new-password" className="h-12" /></Field>
      {err && <p className="rounded-xl bg-[#FFF5F7] px-3 py-2 text-[13px] text-crit">{err}{/expired|invalid|used/i.test(err) && <> <Link href="/forgot" className="font-bold underline">Get a new link</Link></>}</p>}
      <Button variant="pri" type="submit" loading={busy} className="h-12 w-full">Save password</Button>
    </form>
  );
}
