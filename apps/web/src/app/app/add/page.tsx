"use client";
import { useState } from "react";
import Link from "next/link";
import { CreditCard, Landmark, HandCoins, ShieldCheck, Copy } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { Button, Input, Loading, copyText, cx, useToast } from "@/components/ui";
import { money, PageTitle, readiness, SetupBanner, toCents, type Overview } from "../bits";

// Ways to put money in the wallet.
export default function AddMoney() {
  const toast = useToast();
  const { data: o } = useApi<Overview>("/api/pay/overview");
  const [amount, setAmount] = useState("100");
  const [busy, setBusy] = useState(false);
  if (!o) return <Loading rows={4} />;
  const cents = toCents(amount);
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageTitle title="Add money" sub="Top up your wallet in seconds with a debit or credit card. The money is ready to use right away." />
      {readiness(o) && <SetupBanner o={o} />}
      <section className="card space-y-4 p-5">
        <h2 className="pay-h flex items-center gap-2"><CreditCard className="h-5 w-5" />Debit or credit card</h2>
        <div className="flex items-center gap-2 rounded-[14px] border border-[#E7E9EF] px-4"><span className="font-display text-2xl text-[#667085]">{o.currency}</span><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} className="h-16 border-0 px-0 font-display text-3xl shadow-none" /></div>
        <div className="flex gap-2">{["50", "100", "250", "500", "1000"].map((a) => <button key={a} onClick={() => setAmount(a)} className={cx("flex-1 rounded-xl border py-2 text-[13.5px] font-semibold", amount === a ? "border-[#0B1020] bg-[#0B1020] text-white" : "border-[#E7E9EF]")}>{a}</button>)}</div>
        <Button variant="pri" className="h-12 w-full" loading={busy} disabled={cents < 1000 || !!readiness(o)} onClick={async () => { setBusy(true); try { const r = await api<{ url: string }>("/api/pay/topup", { body: { amountCents: cents, returnPath: "/app" } }); location.href = r.url; } catch (e: any) { toast(e.message, "err"); setBusy(false); } }}>Add {money(cents, o.currency)}</Button>
        <p className="flex items-center gap-1.5 text-[12.5px] text-[#667085]"><ShieldCheck className="h-4 w-4 text-[#1FAF6B]" />Card details go straight to Stripe. oenodpay never sees them. Minimum {money(1000, o.currency)}.</p>
      </section>
      <Link href="/app/request" className="card flex items-center gap-3 p-5 hover:border-[#CDD2DC]"><HandCoins className="h-5 w-5" /><span className="flex-1"><b className="block text-[14px]">Ask someone to pay you</b><small className="text-[12.5px] text-[#667085]">Request money from anyone with oenodpay</small></span></Link>
      <section className="card flex items-center gap-3 p-5 opacity-80"><Landmark className="h-5 w-5" /><span className="flex-1"><b className="block text-[14px]">Bank transfer and Interac e-Transfer</b><small className="text-[12.5px] text-[#667085]">Your own account number for direct deposits is coming soon.</small></span></section>
    </div>
  );
}
