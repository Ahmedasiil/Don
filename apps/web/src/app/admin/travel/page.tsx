"use client";
import { useState } from "react";
import { useApi } from "@/lib/client/api";
import { ago, num } from "@/lib/format";
import { Badge, ErrorNote, Loading, PageHeader, Stat, Tabs } from "@/components/ui";
import { cents, Table } from "../bits";

type D = { currency: string; feeBps: number; byKind: { kind: string; status: string; _sum: { amountCents: number | null }; _count: number }[]; esims: { status: string; _sum: { priceCents: number | null }; _count: number }[]; bookings: { id: string; kind: string; title: string; status: string; reference: string | null; amountCents: number; currency: string; providerAmount: string; failureReason: string | null; createdAt: string; customer: { name: string; email: string } | null }[] };

export default function TravelAdmin() {
  const [status, setStatus] = useState<"" | "CONFIRMED" | "PROCESSING" | "FAILED">("");
  const { data: d, error, reload } = useApi<D>(`/api/admin/travel?status=${status}`, { refreshMs: 60_000 });
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!d) return <Loading rows={6} />;
  const k = (kind: string) => d.byKind.filter((x) => x.kind === kind && x.status === "CONFIRMED").reduce((a, x) => ({ c: a.c + x._count, s: a.s + (x._sum.amountCents ?? 0) }), { c: 0, s: 0 });
  const e = d.esims.find((x) => x.status === "READY");
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Products" title="Travel" sub={`Flights and hotels through Duffel, eSIMs through Airalo. Service fee ${d.feeBps / 100}% on bookings. Keep your Duffel balance topped up.`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Flights, 30 days" value={num(k("FLIGHT").c)} hint={cents(k("FLIGHT").s, d.currency)} />
        <Stat label="Hotel stays, 30 days" value={num(k("STAY").c)} hint={cents(k("STAY").s, d.currency)} />
        <Stat label="eSIMs, 30 days" value={num(e?._count)} hint={cents(e?._sum.priceCents, d.currency)} />
        <Stat label="Booking fees, 30 days" value={cents(Math.round(((k("FLIGHT").s + k("STAY").s) * d.feeBps) / (10_000 + d.feeBps)), d.currency)} />
      </div>
      <Tabs value={status} onChange={setStatus} tabs={[{ key: "", label: "All" }, { key: "CONFIRMED", label: "Confirmed" }, { key: "PROCESSING", label: "Processing" }, { key: "FAILED", label: "Failed" }]} />
      <div className="card overflow-hidden"><Table head={["When", "Customer", "Booking", "Charged", "Provider price", "Status"]} empty={!d.bookings.length}>
        {d.bookings.map((b) => <tr key={b.id}>
          <td className="whitespace-nowrap px-5 py-3 text-muted">{ago(b.createdAt)}</td>
          <td className="px-5 py-3"><b>{b.customer?.name}</b><small className="block text-muted">{b.customer?.email}</small></td>
          <td className="px-5 py-3">{b.title}<small className="block text-muted">{b.kind.toLowerCase()}{b.reference ? ` · ${b.reference}` : ""}</small></td>
          <td className="px-5 py-3 font-semibold tabular-nums">{cents(b.amountCents, b.currency)}</td>
          <td className="px-5 py-3 tabular-nums text-muted">{b.providerAmount}</td>
          <td className="px-5 py-3"><Badge status={b.status === "CONFIRMED" ? "ACTIVE" : b.status} />{b.failureReason && <small className="block text-muted">{b.failureReason}</small>}</td>
        </tr>)}
      </Table></div>
    </div>
  );
}
