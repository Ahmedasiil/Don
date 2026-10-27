"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, ShieldCheck, Bell, FileText, LifeBuoy, LogOut, ChevronRight, Gift, Lock } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { date } from "@/lib/format";
import { Button, Field, Input, Loading, Toggle, useToast } from "@/components/ui";
import { PageTitle } from "../bits";

type P = { name: string; email: string; phone: string | null; locale: string; marketingEmailConsent: boolean; marketingSmsConsent: boolean; createdAt: string; country: string | null; tier: number; kycStatus: string; twoFactor: boolean; pinSet: boolean };

const LINKS = [
  ["/app/security", "Security", "Two-step sign-in, PIN, devices, freeze account", ShieldCheck],
  ["/app/notifications", "Notifications", "Everything that happened on your account", Bell],
  ["/app/activity", "Statements", "Download your history for any dates", FileText],
  ["/app/rewards", "Invite friends", "Earn a bonus for each friend who joins", Gift],
  ["/app/help", "Help", "Chat with support, any time", LifeBuoy],
] as const;

export default function Profile() {
  const toast = useToast();
  const { data: p, reload } = useApi<P>("/api/pay/profile");
  const [v, setV] = useState({ name: "", phone: "" });
  useEffect(() => { if (p) setV({ name: p.name, phone: p.phone ?? "" }); }, [p]);
  if (!p) return <Loading rows={5} />;
  const verified = p.kycStatus === "VERIFIED";
  const save = async (d: Record<string, unknown>, msg = "Saved") => { try { await api("/api/account", { method: "PATCH", body: d }); toast(msg, "ok"); reload(); } catch (e: any) { toast(e.message, "err"); } };
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageTitle title="Profile and settings" />
      <section className="card flex flex-wrap items-center gap-4 p-5">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-[#4C6BFF] to-[#1B2A8A] font-display text-[18px] font-semibold text-white">{p.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>
        <div className="min-w-0 flex-1"><b className="flex items-center gap-1.5 text-[17px]">{p.name}{verified && <BadgeCheck className="h-5 w-5 text-[#2E5BFF]" />}</b><small className="text-[13px] text-[#667085]">{p.email} · Member since {date(p.createdAt)}</small></div>
        <span className="rounded-full bg-[#F2F4F7] px-3 py-1 text-[12.5px] font-semibold">{verified ? `Verified · Level ${p.tier}` : "Not verified yet"}</span>
      </section>
      <section className="card space-y-4 p-5">
        <h2 className="pay-h">Personal details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Legal name" help={verified ? "Verified with your ID. Contact support to change it." : undefined}><Input value={v.name} disabled={verified} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
          <Field label="Mobile"><Input type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} placeholder="+1" /></Field>
          <Field label="Email" help="Contact support to change your sign-in email."><Input value={p.email} disabled /></Field>
          <Field label="Country"><Input value={p.country ?? "—"} disabled /></Field>
        </div>
        <Button variant="pri" disabled={v.name === p.name && v.phone === (p.phone ?? "")} onClick={() => save({ ...(verified ? {} : { name: v.name }), phone: v.phone || null })}>Save changes</Button>
      </section>
      <section className="card space-y-4 p-5">
        <h2 className="pay-h">Offers and news</h2>
        <Toggle checked={p.marketingEmailConsent} onChange={(x) => save({ marketingEmailConsent: x })} label="Email me offers and product news" help="Security alerts and receipts always come, whatever you choose here." />
        <Toggle checked={p.marketingSmsConsent} onChange={(x) => save({ marketingSmsConsent: x })} label="Text me offers" />
      </section>
      <section className="card divide-y divide-[#EEF0F4]">
        {LINKS.map(([href, t, d, I]) => <Link key={href} href={href} className="flex items-center gap-3 px-5 py-4 hover:bg-[#FAFBFC]"><I className="h-5 w-5 text-[#344054]" /><span className="min-w-0 flex-1"><b className="block text-[14px]">{t}</b><small className="text-[12.5px] text-[#667085]">{d}</small></span><ChevronRight className="h-4 w-4 text-[#98A2B3]" /></Link>)}
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-[#667085]">
        <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /><a href="/legal/privacy" className="underline">Privacy</a> · <a href="/legal/terms" className="underline">Terms</a></span>
        <Button variant="ghost" onClick={async () => { await api("/api/auth/signout", { body: {} }); location.href = "/"; }}><LogOut className="h-4 w-4" />Sign out</Button>
      </div>
    </div>
  );
}
