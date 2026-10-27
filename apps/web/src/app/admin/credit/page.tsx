"use client";
import { useState } from "react";
import Link from "next/link";
import { api, useApi } from "@/lib/client/api";
import { date, num } from "@/lib/format";
import { Badge, Callout, ErrorNote, Loading, PageHeader, Stat, Tabs, useToast } from "@/components/ui";
import { cents, NoteActions, Table } from "../bits";

type L = { id: string; principalCents: number; aprBps: number; termMonths: number; paymentCents: number; purpose: string | null; status: string; scoreAtApply: number | null; balanceCents: number; nextDueAt: string | null; missed: number; decisionNote: string | null; createdAt: string; customer: { name: string; email: string; createdAt: string } | null };
type D = { currency: string; lendingOn: boolean; book: { status: string; _count: number; _sum: { balanceCents: number | null; principalCents: number | null } }[]; capitalOutCents: number; scores: { band: string; _count: number }[]; loans: L[] };

export default function CreditAdmin() {
  const toast = useToast();
  const [status, setStatus] = useState<"REVIEW" | "ACTIVE" | "DEFAULTED" | "ALL">("REVIEW");
  const { data: d, error, reload } = useApi<D>(`/api/admin/credit?status=${status}`);
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!d) return <Loading rows={6} />;
  const b = (s: string) => d.book.find((x) => x.status === s);
  const decide = (id: string, approve: boolean) => async (note: string) => { try { await api(`/api/admin/credit/${id}`, { body: { approve, note: note || undefined } }); toast(approve ? "Approved and paid out" : "Declined", "ok"); reload(); } catch (e: any) { toast(e.message, "err"); } };
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Products" title="Credit and loans" sub="Every loan is decided by a person. Approval pays the money into the customer's wallet from company lending capital." />
      {!d.lendingOn && <Callout tone="warn" title="Loan applications are off">Turn on "Accept loan applications" in <Link href="/admin/plugins#pricing" className="underline">Plugin centre, Pricing</Link> when your lending licence and capital are ready.</Callout>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Waiting for a decision" value={num(b("REVIEW")?._count)} tone={b("REVIEW")?._count ? "warn" : undefined} />
        <Stat label="Active loans" value={num(b("ACTIVE")?._count)} hint={`${cents(b("ACTIVE")?._sum.balanceCents, d.currency)} owed`} />
        <Stat label="Capital lent out" value={cents(d.capitalOutCents, d.currency)} />
        <Stat label="Defaulted" value={num(b("DEFAULTED")?._count)} tone={b("DEFAULTED")?._count ? "crit" : undefined} />
      </div>
      <Tabs value={status} onChange={setStatus} tabs={[{ key: "REVIEW", label: "To decide", count: b("REVIEW")?._count }, { key: "ACTIVE", label: "Active" }, { key: "DEFAULTED", label: "Defaulted" }, { key: "ALL", label: "All" }]} />
      <div className="card overflow-hidden"><Table head={["Applied", "Customer", "Loan", "Score", "Status", status === "REVIEW" ? "Decision" : "Owed"]} empty={!d.loans.length}>
        {d.loans.map((l) => <tr key={l.id} className="align-top">
          <td className="whitespace-nowrap px-5 py-3 text-muted">{date(l.createdAt)}</td>
          <td className="px-5 py-3"><b>{l.customer?.name}</b><small className="block text-muted">{l.customer?.email} · customer since {date(l.customer?.createdAt)}</small></td>
          <td className="px-5 py-3"><b className="tabular-nums">{cents(l.principalCents, d.currency)}</b> over {l.termMonths} months<small className="block text-muted">{(l.aprBps / 100).toFixed(2)}% · {cents(l.paymentCents, d.currency)}/month{l.purpose ? ` · ${l.purpose}` : ""}</small></td>
          <td className="px-5 py-3 tabular-nums">{l.scoreAtApply ?? "—"}</td>
          <td className="px-5 py-3"><Badge status={l.status} />{l.missed > 0 && <small className="block text-crit">{l.missed} missed</small>}{l.decisionNote && <small className="block text-muted">{l.decisionNote}</small>}</td>
          <td className="min-w-[280px] px-5 py-3">{l.status === "REVIEW" ? <NoteActions actions={[{ label: "Decline", tone: "danger", run: decide(l.id, false) }, { label: "Approve and pay out", tone: "pri", run: decide(l.id, true) }]} /> : <span className="tabular-nums">{cents(l.balanceCents, d.currency)}{l.nextDueAt && <small className="block text-muted">next {date(l.nextDueAt)}</small>}</span>}</td>
        </tr>)}
      </Table></div>
    </div>
  );
}
