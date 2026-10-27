"use client";
import { useState } from "react";
import { ShieldCheck, AlertTriangle, UserX } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { ago, date } from "@/lib/format";
import { Badge, Button, Callout, Empty, ErrorNote, Loading, PageHeader, Tabs, Textarea, cx, useToast } from "@/components/ui";
import { cents, NoteActions } from "../bits";

type Who = { user: { id: string; name: string; email: string; phone: string | null; createdAt: string } | null; profile: { legalName: string | null; country: string | null; tier: number; kycStatus: string; riskLevel: string; sanctionsHit: boolean; pepHit: boolean; frozenAt: string | null; frozenReason: string | null; dob: string | null } | null };
type T = Who & { id: string; userId: string; sendCents: number; sendCurrency: string; receiveCents: number; receiveCurrency: string; feeCents: number; riskFlags: string[]; createdAt: string; ip: string | null; recipient: { name: string; country: string; method: string; network: string | null; label: string | null; sanctionsHit: boolean } };
type R = Who & { id: string; userId: string; kind: string; severity: string; entity: string | null; entityId: string | null; details: any; status: string; note: string | null; createdAt: string };
type K = { id: string; userId: string; legalName: string | null; country: string | null; tier: number; kycStatus: string; riskLevel: string; sanctionsHit: boolean; pepHit: boolean; frozenAt: string | null; frozenReason: string | null; kycReport: any; user: Who["user"] };
type D = { transfers: T[]; risks: R[]; kyc: K[] };

const FLAG: Record<string, string> = { LARGE_TRANSFER: "Large amount", NEW_RECIPIENT_LARGE: "Large first payment to a new recipient", VELOCITY: "Many transfers in a short time", STRUCTURING: "Possible structuring under the report limit", REPORTABLE: "Over the FINTRAC report threshold", HIGH_RISK_COUNTRY: "Higher-risk country", NEW_RECIPIENT_BURST: "Several new recipients at once", NEW_ACCOUNT_LARGE: "Large amount from a new account", PEP_MATCH: "Possible politically exposed person", RECIPIENT_PEP: "Recipient may be a PEP" };
const SEV: Record<string, string> = { CRITICAL: "bg-crit text-white", HIGH: "bg-[#FFE2E6] text-crit", MEDIUM: "bg-[#FFF3D6] text-[#7A4B00]", LOW: "bg-bg text-muted" };

function Person({ w }: { w: Who }) {
  return (
    <div className="text-[13.5px]">
      <b className="block">{w.profile?.legalName ?? w.user?.name ?? "Unknown"}</b>
      <small className="text-muted">{w.user?.email} · {w.profile?.country ?? "?"} · level {w.profile?.tier ?? 0} · joined {date(w.user?.createdAt)}</small>
      <div className="mt-1 flex flex-wrap gap-1">
        {w.profile?.sanctionsHit && <Badge tone="red">Sanctions match</Badge>}
        {w.profile?.pepHit && <Badge tone="amber">PEP</Badge>}
        {w.profile?.riskLevel === "HIGH" && <Badge tone="red">High risk</Badge>}
        {w.profile?.frozenAt && <Badge tone="gray">Frozen</Badge>}
      </div>
    </div>
  );
}

export default function Compliance() {
  const toast = useToast();
  const [tab, setTab] = useState<"transfers" | "risks" | "kyc">("transfers");
  const [riskStatus, setRiskStatus] = useState("OPEN");
  const { data, error, reload } = useApi<D>(`/api/admin/pay/compliance?status=${riskStatus}`, { refreshMs: 30_000 });
  const run = (fn: () => Promise<unknown>, msg: string) => async () => { try { await fn(); toast(msg, "ok"); reload(); } catch (e: any) { toast(e.message, "err"); throw e; } };
  const profile = (userId: string, action: string, note: string) => run(() => api(`/api/admin/pay/profiles/${userId}`, { body: { action, note } }), "Saved")();

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Trust" title="Compliance" sub="Anti-money-laundering queue. Every transfer is screened; anything risky waits here with the money held until you decide." />
      <Callout title="How decisions work">Approve sends the held money to the payout partner. Reject returns the money and fee to the customer. Mark a risk event <b>Reported</b> only after filing a suspicious transaction report with FINTRAC (Canada) or FinCEN (US).</Callout>
      <Tabs value={tab} onChange={setTab} tabs={[{ key: "transfers", label: "Held transfers", count: data?.transfers.length }, { key: "risks", label: "Risk alerts", count: data?.risks.length }, { key: "kyc", label: "Customers to check", count: data?.kyc.length }]} />
      {error ? <ErrorNote error={error} onRetry={reload} /> : !data ? <Loading /> : tab === "transfers" ? (
        !data.transfers.length ? <Empty icon={<ShieldCheck className="h-6 w-6" />} title="No transfers waiting" body="Held transfers show up here." /> : (
          <div className="grid gap-4">{data.transfers.map((t) => (
            <article key={t.id} className="card overflow-hidden">
              <header className="flex flex-wrap items-start gap-4 border-b border-line bg-[#FAFBFC] p-5">
                <div className="min-w-0 flex-1"><Person w={t} /></div>
                <div className="text-end"><div className="mb-1 inline-flex items-center gap-1 rounded-full bg-[#FFFAEB] px-2 py-0.5 text-[11px] font-semibold text-[#B54708]">Money held</div><div className="font-display text-[28px] font-semibold tabular-nums tracking-[-.02em]">{cents(t.sendCents, t.sendCurrency)}</div><small className="text-muted">{ago(t.createdAt)} · they get {cents(t.receiveCents, t.receiveCurrency)}</small></div>
              </header>
              <div className="grid items-start gap-4 p-5 md:grid-cols-2">
                <div className="text-[13.5px]"><div className="mb-1 text-[11px] font-semibold uppercase tracking-[.1em] text-muted">Recipient</div><b>{t.recipient.name}</b> <span className="text-muted">· {t.recipient.country} · {t.recipient.label ?? t.recipient.method}</span>{t.recipient.sanctionsHit && <Badge tone="red" className="ms-2">Recipient on a list</Badge>}</div>
                <div><div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.1em] text-muted">Why it was held</div><div className="flex flex-wrap gap-1.5">{t.riskFlags.map((f) => <span key={f} className="inline-flex items-center gap-1 rounded-[6px] bg-[#FFFAEB] px-2 py-1 text-[12px] font-semibold text-[#B54708] ring-1 ring-[#FEDF89]"><AlertTriangle className="h-3 w-3" />{FLAG[f] ?? f.replace(/_/g, " ").toLowerCase()}</span>)}</div></div>
              </div>
              <footer className="border-t border-line bg-bg/50 p-5">
                <NoteActions actions={[
                  { label: "Freeze customer", tone: "danger", run: (n) => profile(t.userId, "freeze", n || "Frozen during transfer review") },
                  { label: "Reject and refund", run: (n) => run(() => api(`/api/admin/pay/transfers/${t.id}`, { body: { approve: false, note: n } }), "Rejected, money returned")() },
                  { label: "Approve and send", tone: "pri", run: (n) => run(() => api(`/api/admin/pay/transfers/${t.id}`, { body: { approve: true, note: n } }), "Approved and sent")() },
                ]} />
              </footer>
            </article>
          ))}</div>
        )
      ) : tab === "risks" ? (
        <div className="space-y-3">
          <Tabs value={riskStatus} onChange={setRiskStatus} tabs={[{ key: "OPEN", label: "Open" }, { key: "ESCALATED", label: "Escalated" }, { key: "REPORTED", label: "Reported" }, { key: "CLEARED", label: "Cleared" }]} />
          {!data.risks.length ? <Empty icon={<AlertTriangle className="h-6 w-6" />} title="No alerts here" /> : data.risks.map((r) => (
            <article key={r.id} className="card p-5">
              <div className="flex flex-wrap items-start gap-3">
                <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-bold", SEV[r.severity])}>{r.severity}</span>
                <div className="min-w-0 flex-1"><b className="text-[15px]">{r.kind.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase())}</b><small className="ms-2 text-muted">{ago(r.createdAt)}{r.entity ? ` · ${r.entity}` : ""}</small><div className="mt-2"><Person w={r} /></div></div>
              </div>
              {r.details && <pre className="mt-3 max-h-48 overflow-auto rounded-xl bg-bg p-3 text-[12px]">{JSON.stringify(r.details, null, 2)}</pre>}
              {r.note && <p className="mt-2 text-[13px] text-muted">Note: {r.note}</p>}
              {r.status === "OPEN" || r.status === "ESCALATED" ? (
                <div className="mt-3"><NoteActions actions={[
                  { label: "Freeze customer", tone: "danger", run: (n) => profile(r.userId, "freeze", n || r.kind) },
                  { label: "Escalate", run: (n) => run(() => api(`/api/admin/pay/risk/${r.id}`, { body: { status: "ESCALATED", note: n } }), "Escalated")() },
                  { label: "Mark reported", run: (n) => run(() => api(`/api/admin/pay/risk/${r.id}`, { body: { status: "REPORTED", note: n } }), "Marked reported")() },
                  { label: "Clear", tone: "pri", run: (n) => run(() => api(`/api/admin/pay/risk/${r.id}`, { body: { status: "CLEARED", note: n } }), "Cleared")() },
                ]} /></div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        !data.kyc.length ? <Empty icon={<UserX className="h-6 w-6" />} title="Nobody to check" /> : (
          <div className="grid gap-3">{data.kyc.map((k) => (
            <article key={k.id} className="card p-5">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1"><Person w={{ user: k.user, profile: { ...k, dob: null } }} />{k.frozenReason && <p className="mt-1 text-[13px] text-crit">Frozen: {k.frozenReason}</p>}</div>
                <Badge status={k.kycStatus} />
              </div>
              {k.kycReport && <pre className="mt-3 max-h-40 overflow-auto rounded-xl bg-bg p-3 text-[12px]">{JSON.stringify(k.kycReport, null, 2)}</pre>}
              <div className="mt-3"><NoteActions actions={[
                { label: "Re-screen", run: (n) => profile(k.userId, "rescreen", n || "Manual re-screen") },
                ...(k.frozenAt ? [{ label: "Unfreeze", run: (n: string) => profile(k.userId, "unfreeze", n) }] : [{ label: "Freeze", tone: "danger" as const, run: (n: string) => profile(k.userId, "freeze", n) }]),
                { label: "Reject identity", run: (n) => profile(k.userId, "reject", n) },
                { label: "Verify identity", tone: "pri", run: (n) => profile(k.userId, "verify", n) },
              ]} /></div>
            </article>
          ))}</div>
        )
      )}
    </div>
  );
}
