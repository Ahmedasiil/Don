"use client";
import { useState } from "react";
import Link from "next/link";
import { api, useApi } from "@/lib/client/api";
import { ago, num } from "@/lib/format";
import { Badge, Button, Card, ErrorNote, Field, Input, Loading, PageHeader, Stat, useToast } from "@/components/ui";
import { cents, Table } from "../bits";

type D = { currency: string; cashbackBps: number; referralBonusCents: number; clearDays: number; totals: { kind: string; status: string; _sum: { cents: number | null }; _count: number }[]; referrals30: number; paidOutCents: number; recent: { id: string; kind: string; cents: number; status: string; memo: string | null; createdAt: string; customer: { name: string; email: string } | null }[] };

export default function RewardsAdmin() {
  const toast = useToast();
  const { data: d, error, reload } = useApi<D>("/api/admin/rewards");
  const [b, setB] = useState({ email: "", amount: "", memo: "" });
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!d) return <Loading rows={6} />;
  const sum = (f: (t: D["totals"][number]) => boolean) => d.totals.filter(f).reduce((a, t) => a + (t._sum.cents ?? 0), 0);
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Products" title="Rewards" sub={`${d.cashbackBps / 100}% card cashback, ${cents(d.referralBonusCents, d.currency)} referral bonus each, clearing after ${d.clearDays} days. Change these in Plugin centre, Pricing.`} actions={<Link href="/admin/plugins#pricing" className="btn">Change rates</Link>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Waiting to clear" value={cents(sum((t) => t.status === "PENDING"), d.currency)} />
        <Stat label="Ready, not yet moved" value={cents(sum((t) => t.status === "AVAILABLE"), d.currency)} />
        <Stat label="Paid into wallets" value={cents(d.paidOutCents, d.currency)} />
        <Stat label="Friends joined, 30 days" value={num(d.referrals30)} />
      </div>
      <Card title="Give a bonus">
        <div className="grid gap-3 sm:grid-cols-[1fr_140px_1.4fr_auto] sm:items-end">
          <Field label="Customer email"><Input type="email" value={b.email} onChange={(e) => setB({ ...b, email: e.target.value })} /></Field>
          <Field label="Amount"><Input inputMode="decimal" value={b.amount} onChange={(e) => setB({ ...b, amount: e.target.value.replace(/[^\d.]/g, "") })} placeholder="10.00" /></Field>
          <Field label="Message they'll see"><Input value={b.memo} onChange={(e) => setB({ ...b, memo: e.target.value })} placeholder="Sorry for the wait" /></Field>
          <Button variant="pri" disabled={!b.email || !b.amount || b.memo.length < 3} onClick={async () => { try { await api("/api/admin/rewards", { body: { action: "bonus", email: b.email, cents: Math.round(Number(b.amount) * 100), memo: b.memo } }); toast("Bonus given", "ok"); setB({ email: "", amount: "", memo: "" }); reload(); } catch (e: any) { toast(e.message, "err"); } }}>Give bonus</Button>
        </div>
      </Card>
      <div className="card overflow-hidden"><Table head={["When", "Customer", "Reward", "Amount", "Status", ""]} empty={!d.recent.length}>
        {d.recent.map((r) => <tr key={r.id}>
          <td className="whitespace-nowrap px-5 py-3 text-muted">{ago(r.createdAt)}</td>
          <td className="px-5 py-3"><b>{r.customer?.name}</b><small className="block text-muted">{r.customer?.email}</small></td>
          <td className="px-5 py-3">{r.kind.toLowerCase()}<small className="block text-muted">{r.memo}</small></td>
          <td className="px-5 py-3 font-semibold tabular-nums">{cents(r.cents, d.currency)}</td>
          <td className="px-5 py-3"><Badge status={r.status} /></td>
          <td className="px-5 py-3 text-end">{["PENDING", "AVAILABLE"].includes(r.status) && r.cents > 0 && <Button size="sm" variant="ghost" onClick={async () => { const memo = prompt("Why reverse it?"); if (!memo) return; try { await api("/api/admin/rewards", { body: { action: "reverse", id: r.id, memo } }); reload(); } catch (e: any) { toast(e.message, "err"); } }}>Reverse</Button>}</td>
        </tr>)}
      </Table></div>
    </div>
  );
}
