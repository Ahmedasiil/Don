"use client";
import { Gift, Copy, Users, CreditCard, Sparkles } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { ago } from "@/lib/format";
import { Button, Loading, copyText, cx, useToast } from "@/components/ui";
import { BigMoney, money, PageTitle, Status } from "../bits";

type R = { currency: string; availableCents: number; pendingCents: number; earnedCents: number; cashbackBps: number; referralBonusCents: number; code: string; invited: number; inviteUrl: string; rows: { id: string; kind: string; cents: number; status: string; memo: string | null; createdAt: string }[] };

export default function Rewards() {
  const toast = useToast();
  const { data: r, reload } = useApi<R>("/api/pay/rewards");
  if (!r) return <Loading rows={5} />;
  const share = async () => {
    const text = `Join me on oenodpay and we both get ${money(r.referralBonusCents, r.currency)}.`;
    if (navigator.share) { try { await navigator.share({ title: "oenodpay", text, url: r.inviteUrl }); return; } catch {} }
    await copyText(r.inviteUrl); toast("Invite link copied", "ok");
  };
  return (
    <div className="space-y-6">
      <PageTitle title="Rewards" sub={`${(r.cashbackBps / 100).toFixed(r.cashbackBps % 100 ? 1 : 0)}% cash back on every card purchase, and ${money(r.referralBonusCents, r.currency)} for you and each friend you invite.`} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="card overflow-hidden">
          <div className="bg-[radial-gradient(120%_120%_at_0%_0%,#2E5BFF_0%,#0B1020_70%)] p-6 text-white">
            <span className="text-[11px] font-semibold uppercase tracking-[.14em] text-white/60">Ready to use</span>
            <BigMoney cents={r.availableCents} currency={r.currency} className="mt-2 block text-[44px] font-semibold leading-none" />
            <p className="mt-2 text-[13px] text-white/70">{money(r.pendingCents, r.currency)} on the way · {money(r.earnedCents, r.currency)} earned so far</p>
            <Button variant="pri" className="mt-5 !bg-white !text-[#0B1020]" disabled={r.availableCents <= 0} onClick={async () => { try { const x = await api<{ cents: number }>("/api/pay/rewards", { body: {} }); toast(`${money(x.cents, r.currency)} moved to your wallet`, "ok"); reload(); } catch (e: any) { toast(e.message, "err"); } }}><Sparkles className="h-4 w-4" />Move to wallet</Button>
          </div>
          <div className="grid grid-cols-2 divide-x divide-[#EEF0F4]">
            <div className="flex items-center gap-3 p-4"><CreditCard className="h-5 w-5 text-[#2E5BFF]" /><span><b className="block text-[14px]">{(r.cashbackBps / 100).toFixed(r.cashbackBps % 100 ? 1 : 0)}% back</b><small className="text-[12px] text-[#667085]">On every card purchase</small></span></div>
            <div className="flex items-center gap-3 p-4"><Users className="h-5 w-5 text-[#2E5BFF]" /><span><b className="block text-[14px]">{r.invited} friends joined</b><small className="text-[12px] text-[#667085]">{money(r.referralBonusCents, r.currency)} each</small></span></div>
          </div>
        </section>
        <section className="card p-5">
          <h2 className="pay-h flex items-center gap-2"><Gift className="h-5 w-5" />Invite friends</h2>
          <p className="mt-1 text-[13.5px] text-[#667085]">When a friend joins with your link and adds money, you both get {money(r.referralBonusCents, r.currency)}.</p>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#E7E9EF] bg-[#FAFBFC] p-2 ps-3"><span className="flex-1 truncate font-mono text-[13px]">{r.inviteUrl}</span><Button size="sm" onClick={async () => { await copyText(r.inviteUrl); toast("Copied", "ok"); }}><Copy className="h-4 w-4" /></Button></div>
          <div className="mt-3 flex items-center justify-between"><span className="text-[13px] text-[#667085]">Your code <b className="font-mono text-[#0B1020]">{r.code}</b></span><Button variant="pri" size="sm" onClick={share}>Share invite</Button></div>
        </section>
      </div>
      <section><h2 className="pay-h mb-3">History</h2><div className="card divide-y divide-[#EEF0F4]">
        {r.rows.map((x) => (
          <div key={x.id} className="flex items-center gap-3 px-5 py-3.5"><span className="min-w-0 flex-1"><b className="block truncate text-[14px]">{x.memo ?? x.kind}</b><small className="text-[12.5px] text-[#667085]">{ago(x.createdAt)}</small></span><b className={cx("pay-num", x.cents > 0 && "text-[#067647]")}>{x.cents > 0 ? "+" : ""}{money(x.cents, r.currency)}</b><Status status={x.status === "AVAILABLE" ? "ACTIVE" : x.status} /></div>
        ))}
        {!r.rows.length && <p className="p-10 text-center text-[13.5px] text-[#667085]">Use your card or invite a friend to start earning.</p>}
      </div></section>
    </div>
  );
}
