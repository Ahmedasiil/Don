"use client";
import { useState } from "react";
import { api, useApi } from "@/lib/client/api";
import { ago, num } from "@/lib/format";
import { Badge, Button, Card, ErrorNote, Loading, PageHeader, Stat, Tabs, useToast } from "@/components/ui";
import { cents, Table } from "../bits";

type D = { currency: string; custodyCents: number; volume: { side: string; _sum: { amountCents: number | null; feeCents: number | null }; _count: number }[]; holdings: { symbol: string; kind: string; quantity: number; costCents: number; holders: number }[]; trades: { id: string; symbol: string; side: string; amountCents: number; feeCents: number; quantity: number | null; status: string; providerRef: string | null; failureReason: string | null; createdAt: string; customer: { name: string; email: string } | null }[] };

export default function InvestAdmin() {
  const toast = useToast();
  const [status, setStatus] = useState<"" | "PENDING" | "FILLED" | "FAILED">("");
  const { data: d, error, reload } = useApi<D>(`/api/admin/invest?status=${status}`, { refreshMs: 30_000 });
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!d) return <Loading rows={6} />;
  const v = (s: string) => d.volume.find((x) => x.side === s);
  const act = async (id: string, action: "recheck" | "fail") => { const note = action === "fail" ? prompt("Reason (the customer sees it)") ?? "" : undefined; try { await api(`/api/admin/invest/${id}`, { body: { action, note } }); toast("Done", "ok"); reload(); } catch (e: any) { toast(e.message, "err"); } };
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Products" title="Investing" sub="Orders go to the Alpaca account. What customers hold here must match the positions there." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Cash at broker for customers" value={cents(d.custodyCents, d.currency)} />
        <Stat label="Bought, 30 days" value={cents(v("BUY")?._sum.amountCents, d.currency)} hint={`${num(v("BUY")?._count)} orders`} />
        <Stat label="Sold, 30 days" value={cents(v("SELL")?._sum.amountCents, d.currency)} hint={`${num(v("SELL")?._count)} orders`} />
        <Stat label="Trading fees, 30 days" value={cents((v("BUY")?._sum.feeCents ?? 0) + (v("SELL")?._sum.feeCents ?? 0), d.currency)} />
      </div>
      <Card title="Customer positions (match these to Alpaca)" pad={false}>
        <Table head={["Symbol", "Type", "Units held", "Cost", "Customers"]} empty={!d.holdings.length}>
          {d.holdings.map((h) => <tr key={h.symbol}><td className="px-5 py-3 font-semibold">{h.symbol}</td><td className="px-5 py-3">{h.kind.toLowerCase()}</td><td className="px-5 py-3 tabular-nums">{h.quantity.toLocaleString("en-US", { maximumFractionDigits: 6 })}</td><td className="px-5 py-3 tabular-nums">{cents(h.costCents, d.currency)}</td><td className="px-5 py-3">{h.holders}</td></tr>)}
        </Table>
      </Card>
      <Tabs value={status} onChange={setStatus} tabs={[{ key: "", label: "All orders" }, { key: "PENDING", label: "Pending" }, { key: "FILLED", label: "Filled" }, { key: "FAILED", label: "Failed" }]} />
      <div className="card overflow-hidden"><Table head={["When", "Customer", "Order", "Amount", "Status", ""]} empty={!d.trades.length}>
        {d.trades.map((t) => <tr key={t.id}>
          <td className="whitespace-nowrap px-5 py-3 text-muted">{ago(t.createdAt)}</td>
          <td className="px-5 py-3"><b>{t.customer?.name}</b><small className="block text-muted">{t.customer?.email}</small></td>
          <td className="px-5 py-3">{t.side === "BUY" ? "Buy" : "Sell"} <b>{t.symbol}</b>{t.quantity != null && <small className="block text-muted">{t.quantity.toLocaleString("en-US", { maximumFractionDigits: 6 })} units</small>}</td>
          <td className="px-5 py-3 tabular-nums">{cents(t.amountCents, d.currency)}<small className="block text-muted">fee {cents(t.feeCents, d.currency)}</small></td>
          <td className="px-5 py-3"><Badge status={t.status} />{t.failureReason && <small className="block text-muted">{t.failureReason}</small>}</td>
          <td className="whitespace-nowrap px-5 py-3 text-end">{t.status === "PENDING" && <span className="flex justify-end gap-2"><Button size="sm" onClick={() => act(t.id, "recheck")}>Check broker</Button><Button size="sm" variant="danger" onClick={() => act(t.id, "fail")}>Cancel and refund</Button></span>}</td>
        </tr>)}
      </Table></div>
    </div>
  );
}
