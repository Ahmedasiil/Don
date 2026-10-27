"use client";
import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, KeyRound, Smartphone, Snowflake, Lock, Eye, Fingerprint, BellRing, CheckCircle2, XCircle } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { Button, ErrorNote, Field, Input, Loading, Modal, useToast } from "@/components/ui";
import { PageTitle, type Overview } from "../bits";
import { TwoStepSetup } from "../two-step";

export default function Security() {
  const toast = useToast();
  const { data: o, error, reload } = useApi<Overview>("/api/pay/overview");
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState({ a: "", b: "", code: "" });
  const [freeze, setFreeze] = useState(false);
  const [busy, setBusy] = useState(false);
  const [twoStep, setTwoStep] = useState(false);
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!o) return <Loading rows={5} />;
  const checks = [
    { ok: o.profile.twoStep, title: "Two-step sign-in", body: "A code from your authenticator app at every new sign-in and for big payments.", onClick: () => setTwoStep(true), cta: "Turn on", icon: Smartphone },
    { ok: o.profile.kycStatus === "VERIFIED", title: "Identity verified", body: "Your ID and selfie are checked so nobody can open an account as you.", href: "/app/verify", cta: "Verify", icon: Fingerprint },
    { ok: o.profile.pinSet, title: "Payment PIN", body: "Six digits to confirm every payment. Locks after 5 wrong tries.", onClick: () => setPinOpen(true), cta: o.profile.pinSet ? "Change" : "Set PIN", icon: KeyRound },
  ];
  const savePin = async () => {
    if (pin.a !== pin.b) { toast("The two PINs don't match", "err"); return; }
    setBusy(true);
    try { await api("/api/pay/pin", { body: { pin: pin.a, code: pin.code } }); toast("PIN saved", "ok"); setPinOpen(false); setPin({ a: "", b: "", code: "" }); reload(); }
    catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); }
  };
  return (
    <div>
      <PageTitle title="Security" sub="Bank-grade protection on every account. Here's what's on, and what you can turn on." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          {checks.map((c) => (
            <section key={c.title} className="card flex flex-wrap items-center gap-4 p-5">
              <span className={`grid h-11 w-11 place-items-center rounded-full ${c.ok ? "bg-[#EEFAF4] text-[#1FAF6B]" : "bg-[#FFF5F7] text-crit"}`}><c.icon className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1"><b className="flex items-center gap-1.5 text-[15px]">{c.title}{c.ok ? <CheckCircle2 className="h-4 w-4 text-[#1FAF6B]" /> : <XCircle className="h-4 w-4 text-crit" />}</b><small className="text-[#667085]">{c.body}</small></div>
              {"href" in c && c.href ? (!c.ok && <Link href={c.href} className="btn-pri">{c.cta}</Link>) : (!c.ok || c.title === "Payment PIN") && <Button variant={c.ok ? "default" : "pri"} onClick={c.onClick}>{c.cta}</Button>}
            </section>
          ))}
          <section className="card border-crit/30 p-5">
            <div className="flex flex-wrap items-center gap-4"><span className="grid h-11 w-11 place-items-center rounded-[12px] bg-[#FEF3F2] text-[#D92D20]"><Snowflake className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1"><b className="text-[15px]">Freeze everything</b><small className="block text-[#667085]">Lost your phone or see something you didn't do? This stops all payments and pauses every card instantly.</small></div>
              <Button variant="danger" disabled={o.profile.frozen} onClick={() => setFreeze(true)}>{o.profile.frozen ? "Frozen" : "Freeze now"}</Button></div>
          </section>
        </div>
        <aside className="rounded-[24px] bg-[#0B1020] p-6 text-white">
          <ShieldCheck className="h-8 w-8 text-[#9DAEFF]" />
          <h2 className="mt-3 font-display text-[20px] font-semibold">How we protect you</h2>
          <ul className="mt-4 space-y-3 text-[13.5px] text-white/80">
            {[[Lock, "Account numbers and personal data are encrypted with AES-256 at rest and TLS in transit."], [Eye, "Every transfer is screened against global sanctions lists and checked for fraud patterns."], [BellRing, "You get an alert for new devices, new recipients, PIN changes and every card payment."], [Smartphone, "New devices have lower limits for their first 24 hours."], [KeyRound, "We never ask for your password, PIN or codes. Not by phone, email or chat."]].map(([I, t], i) => { const Icon = I as typeof Lock; return <li key={i} className="flex gap-2.5"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#9DAEFF]" />{t as string}</li>; })}
          </ul>
        </aside>
      </div>
      <TwoStepSetup open={twoStep} onClose={() => setTwoStep(false)} onDone={reload} />
      <Modal open={pinOpen} onClose={() => setPinOpen(false)} title={o.profile.pinSet ? "Change PIN" : "Create your PIN"} footer={<><Button onClick={() => setPinOpen(false)}>Cancel</Button><Button variant="pri" loading={busy} disabled={pin.a.length !== 6 || pin.b.length !== 6 || (o.profile.twoStep && pin.code.length < 6)} onClick={savePin}>Save PIN</Button></>}>
        <div className="space-y-3">
          <Field label="New 6-digit PIN"><Input type="password" inputMode="numeric" maxLength={6} value={pin.a} onChange={(e) => setPin({ ...pin, a: e.target.value.replace(/\D/g, "") })} className="text-center font-mono text-xl tracking-[.5em]" /></Field>
          <Field label="Type it again"><Input type="password" inputMode="numeric" maxLength={6} value={pin.b} onChange={(e) => setPin({ ...pin, b: e.target.value.replace(/\D/g, "") })} className="text-center font-mono text-xl tracking-[.5em]" /></Field>
          {o.profile.twoStep && <Field label="Code from your authenticator app"><Input inputMode="numeric" maxLength={11} value={pin.code} onChange={(e) => setPin({ ...pin, code: e.target.value.trim() })} className="text-center font-mono text-lg tracking-[.3em]" /></Field>}
          <p className="text-[12.5px] text-[#667085]">Avoid birthdays and simple patterns like 123456.</p>
        </div>
      </Modal>
      <Modal open={freeze} onClose={() => setFreeze(false)} title="Freeze your account?" footer={<><Button onClick={() => setFreeze(false)}>Cancel</Button><Button variant="danger" loading={busy} onClick={async () => { setBusy(true); try { await api("/api/pay/security/freeze", { body: {} }); toast("Account frozen. Contact support to unfreeze.", "ok"); setFreeze(false); reload(); } catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); } }}>Freeze everything</Button></>}>
        <p className="text-[14px] text-[#667085]">No money can leave and all your cards stop working right away. To unfreeze, our support team will verify it's you.</p>
      </Modal>
    </div>
  );
}
