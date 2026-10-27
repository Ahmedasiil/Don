"use client";
import Link from "next/link";
import { ArrowRight, ShieldAlert, Headphones } from "lucide-react";
import { useApi } from "@/lib/client/api";
import { ago, num } from "@/lib/format";
import { Badge, Card, ErrorNote, Loading, PageHeader, Stat, cx } from "@/components/ui";
import { cents, Table } from "./bits";

type O = {
  currency: string; customers: { total: number; verified: number; frozen: number }; walletsCents: number;
  sent24: { cents: number; count: number }; sent30: { cents: number; count: number; feesCents: number }; revenue30Cents: number;
  reviewQueue: number; openRisks: number; activeCards: number; esims30: number; openCases: number;
  recent: { id: string; sendCents: number; sendCurrency: string; receiveCents: number; receiveCurrency: string; status: string; provider: string; createdAt: string; riskFlags: string[]; recipient: { name: string; country: string; method: string } }[];
  corridors: { currency: string; cents: number; count: number }[];
};

export default function PayAdmin() {
  const { data: s, error, reload } = useApi<O>("/api/admin/pay/overview", { refreshMs: 30_000 });
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!s) return <Loading rows={6} />;
  const c = (v: number) => cents(v, s.currency);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="oenodpay" title="Pay overview" sub="Money held, money moving, and what needs a person." />
      {(s.reviewQueue > 0 || s.openRisks > 0 || s.openCases > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {(s.reviewQueue > 0 || s.openRisks > 0) && <Link href="/admin/compliance" className="card flex items-center gap-3 p-4 hover:border-[#CDD2DC]"><span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[#FEF3F2] text-[#D92D20]"><ShieldAlert className="h-[18px] w-[18px]" /></span><span className="flex-1 text-[14px]"><b>{s.reviewQueue} transfer{s.reviewQueue === 1 ? "" : "s"}</b> held for review · <b>{s.openRisks}</b> open risk alert{s.openRisks === 1 ? "" : "s"}</span><ArrowRight className="h-4 w-4 rtl:rotate-180" /></Link>}
          {s.openCases > 0 && <Link href="/admin/support" className="card flex items-center gap-3 p-4 hover:border-[#CDD2DC]"><span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[#EEF4FF] text-[#2E5BFF]"><Headphones className="h-[18px] w-[18px]" /></span><span className="flex-1 text-[14px]"><b>{s.openCases} open support case{s.openCases === 1 ? "" : "s"}</b></span><ArrowRight className="h-4 w-4 rtl:rotate-180" /></Link>}
        </div>
      )}
      <section className="grid overflow-hidden rounded-[20px] bg-[#0B1020] bg-[radial-gradient(70%_140%_at_100%_0%,rgba(46,91,255,.25)_0%,transparent_60%)] text-white sm:grid-cols-2 lg:grid-cols-4">
        {[["Customer money held", c(s.walletsCents), `${num(s.customers.total)} wallets`], ["Sent, last 24 hours", c(s.sent24.cents), `${num(s.sent24.count)} transfers`], ["Sent, 30 days", c(s.sent30.cents), `${num(s.sent30.count)} transfers`], ["Revenue, 30 days", c(s.revenue30Cents), `${c(s.sent30.feesCents)} transfer fees`]].map(([l, v, h], i) => (
          <div key={l} className={cx("p-6 sm:p-7", i > 0 && "border-white/[.08] lg:border-s", i % 2 === 1 && "sm:border-s", i > 1 && "sm:border-t lg:border-t-0")}><div className="text-[11px] font-semibold uppercase tracking-[.12em] text-white/50">{l}</div><div className="mt-2 font-display text-[30px] font-semibold tabular-nums tracking-[-.02em]">{v}</div><div className="mt-1 text-[12.5px] text-white/45">{h}</div></div>
        ))}
      </section>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Customers" value={num(s.customers.total)} hint={`${num(s.customers.verified)} verified`} />
        <Stat label="Frozen accounts" value={num(s.customers.frozen)} tone={s.customers.frozen ? "warn" : undefined} />
        <Stat label="Transfers, 30 days" value={num(s.sent30.count)} hint={`${c(s.sent30.feesCents)} in fees`} />
        <Stat label="Active cards" value={num(s.activeCards)} />
        <Stat label="eSIMs sold, 30 days" value={num(s.esims30)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title="Latest transfers" pad={false}>
          <Table head={["When", "To", "Sent", "They get", "Route", "Status"]} empty={!s.recent.length}>
            {s.recent.map((t) => (
              <tr key={t.id}>
                <td className="whitespace-nowrap px-5 py-3 text-muted">{ago(t.createdAt)}</td>
                <td className="whitespace-nowrap px-5 py-3"><b>{t.recipient.name}</b><small className="block text-muted">{t.recipient.country} · {t.recipient.method.replace("_", " ").toLowerCase()}</small></td>
                <td className="whitespace-nowrap px-5 py-3 font-semibold tabular-nums">{cents(t.sendCents, t.sendCurrency)}</td>
                <td className="whitespace-nowrap px-5 py-3 tabular-nums">{cents(t.receiveCents, t.receiveCurrency)}</td>
                <td className="px-5 py-3 capitalize text-muted">{t.provider}</td>
                <td className="px-5 py-3"><Badge status={t.status} />{t.riskFlags.length > 0 && <span className="mt-1.5 flex flex-wrap gap-1">{t.riskFlags.slice(0, 3).map((f) => <span key={f} className="rounded-[5px] bg-[#FFFAEB] px-1.5 py-px text-[10.5px] font-semibold text-[#B54708] ring-1 ring-[#FEDF89]">{f.replace(/_/g, " ").toLowerCase()}</span>)}</span>}</td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="Top corridors, 30 days">
          <ul className="space-y-4">
            {s.corridors.sort((a, b) => b.cents - a.cents).slice(0, 10).map((x, _i, all) => <li key={x.currency} className="text-[14px]"><div className="flex items-center justify-between"><span className="font-semibold">{x.currency}</span><span className="tabular-nums text-muted">{c(x.cents)} · {x.count}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#EEF0F4]"><i className="block h-full rounded-full bg-[#2E5BFF]" style={{ width: `${Math.max(4, (x.cents / all[0].cents) * 100)}%` }} /></div></li>)}
            {!s.corridors.length && <li className="text-[13.5px] text-muted">No transfers yet.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
