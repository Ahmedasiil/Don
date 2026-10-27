"use client";
import { useState } from "react";
import { BadgeCheck, Snowflake, ShieldCheck } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { ago, date, dateTime } from "@/lib/format";
import { Badge, Button, ErrorNote, Field, Input, Loading, Modal, PageHeader, Tabs, cx, useToast } from "@/components/ui";
import { cents, NoteActions, SearchBox, Table, useDebounced } from "../bits";

type Row = { id: string; name: string; email: string; phone: string | null; createdAt: string; lastSeenAt: string | null; isSuperAdmin: boolean; twoFactor: boolean; balanceCents: number; payProfile: { country: string | null; tier: number; kycStatus: string; riskLevel: string; frozenAt: string | null } | null };

function Detail({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const { data: d, error, reload } = useApi<any>(`/api/admin/customers/${id}`);
  const [adj, setAdj] = useState("");
  const act = (body: Record<string, unknown>, msg: string) => async (note: string) => {
    try { await api(`/api/admin/customers/${id}`, { body: { ...body, note } }); toast(msg, "ok"); reload(); onChanged(); } catch (e: any) { toast(e.message, "err"); }
  };
  const comp = (action: string, msg: string) => async (note: string) => {
    try { await api(`/api/admin/pay/profiles/${id}`, { body: { action, note } }); toast(msg, "ok"); reload(); onChanged(); } catch (e: any) { toast(e.message, "err"); }
  };
  const c = (v: number) => cents(v, d?.currency);
  return (
    <Modal wide open onClose={onClose} title={d?.user.name ?? "Customer"}>
      {error ? <ErrorNote error={error} /> : !d ? <Loading rows={6} /> : (
        <div className="space-y-5 text-[13.5px]">
          <div className="flex flex-wrap gap-2">
            <Badge tone={d.profile.kycStatus === "VERIFIED" ? "green" : "amber"}>{d.profile.kycStatus ?? "NO PROFILE"}</Badge>
            <Badge tone="gray">Level {d.profile.tier ?? 0}</Badge>
            <Badge tone={d.user.twoFactor ? "green" : "red"}>{d.user.twoFactor ? "2-step on" : "2-step off"}</Badge>
            {d.profile.frozenAt && <Badge tone="red">Frozen: {d.profile.frozenReason}</Badge>}
            {d.profile.riskLevel === "HIGH" && <Badge tone="red">High risk</Badge>}
            {d.score && <Badge tone="blue">Score {d.score.score}</Badge>}
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {[["Wallet", c(d.wallet.balanceCents)], ["On hold", c(d.wallet.heldCents)], ["Invested (cost)", c(d.holdings.reduce((a: number, h: any) => a + h.costCents, 0))], ["Loans owed", c(d.loans.filter((l: any) => l.status === "ACTIVE").reduce((a: number, l: any) => a + l.balanceCents, 0))]].map(([k, v]) => <div key={k} className="rounded-xl bg-[#F7F8FA] p-3"><small className="text-muted">{k}</small><b className="block text-[16px] tabular-nums">{v}</b></div>)}
          </div>
          <div className="grid gap-1 sm:grid-cols-2"><span>{d.user.email}</span><span>{d.user.phone ?? "No phone"}</span><span>Joined {date(d.user.createdAt)}</span><span>Last seen {ago(d.user.lastSeenAt)}</span><span>Country {d.profile.country ?? "?"}</span><span>{d.sessions.length} signed-in device{d.sessions.length === 1 ? "" : "s"}</span></div>
          <section><h3 className="mb-2 font-semibold">Recent activity</h3><div className="max-h-56 divide-y divide-line overflow-auto rounded-xl border border-line">{d.activity.map((a: any) => <div key={a.id} className="flex justify-between gap-3 px-3 py-2"><span className="truncate">{a.memo ?? a.kind} <small className="text-muted">· {dateTime(a.at)}</small></span><b className={cx("tabular-nums", a.amountCents > 0 && "text-[#067647]")}>{c(a.amountCents)}</b></div>)}{!d.activity.length && <p className="p-4 text-muted">No activity.</p>}</div></section>
          <section className="grid gap-4 lg:grid-cols-2">
            <div><h3 className="mb-2 font-semibold">Compliance</h3><NoteActions actions={[
              d.profile.frozenAt ? { label: "Unfreeze", run: comp("unfreeze", "Unfrozen") } : { label: "Freeze", tone: "danger", run: comp("freeze", "Frozen") },
              { label: "Verify", run: comp("verify", "Verified") }, { label: "Level 2", run: comp("tier2", "Level 2") }, { label: "Rescreen", run: comp("rescreen", "Rescreened") },
            ]} /></div>
            <div><h3 className="mb-2 font-semibold">Account</h3><NoteActions actions={[{ label: "Sign out everywhere", run: act({ action: "signout" }, "Signed out") }, { label: "Reset PIN", run: act({ action: "reset_pin" }, "PIN reset") }]} /></div>
          </section>
          <section><h3 className="mb-2 font-semibold">Adjust wallet</h3><p className="mb-2 text-muted">Goodwill credits and corrections. Use a minus sign to take money back. Up to 10,000. Always logged.</p>
            <div className="grid gap-2 sm:grid-cols-[160px_1fr]"><Field label="Amount"><Input inputMode="decimal" value={adj} onChange={(e) => setAdj(e.target.value.replace(/[^\d.-]/g, ""))} placeholder="25.00" /></Field>
              <NoteActions actions={[{ label: "Apply adjustment", tone: "pri", run: async (n) => { const v = Math.round(Number(adj) * 100); if (!v) return toast("Enter an amount", "err"); await act({ action: "adjust", amountCents: v }, "Adjusted")(n); setAdj(""); } }]} /></div>
          </section>
        </div>
      )}
    </Modal>
  );
}

export default function Customers() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | "verified" | "unverified" | "frozen">("");
  const dq = useDebounced(q);
  const { data, error, reload } = useApi<{ currency: string; rows: Row[] }>(`/api/admin/customers?q=${encodeURIComponent(dq)}&status=${status}`);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Run" title="Customers" sub="Find anyone, see everything about their account, and act on it. Every action is logged." />
      <div className="flex flex-wrap items-center gap-3"><SearchBox value={q} onChange={setQ} placeholder="Name, email or phone" /><Tabs value={status} onChange={setStatus} tabs={[{ key: "", label: "All" }, { key: "verified", label: "Verified" }, { key: "unverified", label: "Not verified" }, { key: "frozen", label: "Frozen" }]} /></div>
      {error ? <ErrorNote error={error} onRetry={reload} /> : !data ? <Loading rows={8} /> : (
        <div className="card overflow-hidden">
          <Table head={["Customer", "Country", "Status", "Wallet", "Security", "Joined"]} empty={!data.rows.length}>
            {data.rows.map((r) => (
              <tr key={r.id} onClick={() => setOpen(r.id)} className="cursor-pointer hover:bg-[#FAFBFC]">
                <td className="px-5 py-3"><b className="flex items-center gap-1">{r.name}{r.payProfile?.kycStatus === "VERIFIED" && <BadgeCheck className="h-4 w-4 text-[#2E5BFF]" />}</b><small className="text-muted">{r.email}</small></td>
                <td className="px-5 py-3">{r.payProfile?.country ?? "—"}</td>
                <td className="px-5 py-3">{r.payProfile?.frozenAt ? <Badge tone="red"><Snowflake className="h-3 w-3" />Frozen</Badge> : <Badge tone={r.payProfile?.kycStatus === "VERIFIED" ? "green" : "gray"}>{(r.payProfile?.kycStatus ?? "NEW").toLowerCase()}</Badge>}{r.isSuperAdmin && <Badge tone="blue" className="ms-1">Admin</Badge>}</td>
                <td className="px-5 py-3 font-semibold tabular-nums">{cents(r.balanceCents, data.currency)}</td>
                <td className="px-5 py-3">{r.twoFactor ? <span className="flex items-center gap-1 text-[#067647]"><ShieldCheck className="h-4 w-4" />2-step</span> : <span className="text-muted">Password only</span>}</td>
                <td className="whitespace-nowrap px-5 py-3 text-muted">{date(r.createdAt)}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}
      {open && <Detail id={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </div>
  );
}
