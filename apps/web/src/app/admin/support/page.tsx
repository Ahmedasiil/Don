"use client";
import { useEffect, useRef, useState } from "react";
import { Headphones, Phone, MessageSquare, Bot, Sparkles, Send, Lock, User as UserIcon, ShieldAlert } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { ago, dateTime } from "@/lib/format";
import { Badge, Button, Card, Empty, ErrorNote, Loading, PageHeader, Select, Stat, Tabs, Textarea, Toggle, cx, useToast } from "@/components/ui";
import { cents } from "../bits";

type Case = { id: string; subject: string; channel: string; status: string; priority: string; category: string | null; name: string | null; email: string | null; phone: string | null; aiSummary: string | null; sentiment: string | null; updatedAt: string; assigneeId: string | null; _count: { messages: number } };
type List = { cases: Case[]; counts: Record<string, number>; today: Record<string, number>; csat: number | null; aiResolutionRate: number | null; phone: string | null };
type Msg = { id: string; from: string; body: string; internal: boolean; createdAt: string };
type Full = Case & { messages: Msg[]; agents: { id: string; name: string }[]; customer: { user: { name: string; email: string; phone: string | null; createdAt: string; totpEnabledAt: string | null } | null; profile: { tier: number; kycStatus: string; legalName: string | null; country: string | null; riskLevel: string; frozenAt: string | null; frozenReason: string | null; pinLockedUntil: string | null } | null; transfers: { id: string; sendCents: number; sendCurrency: string; status: string; createdAt: string; recipient: { name: string; country: string } }[]; cards: { id: string; last4: string; status: string; type: string; familyId: string | null }[]; history: { id: string; subject: string; status: string; createdAt: string }[] } };

const CH: Record<string, typeof Phone> = { VOICE: Phone, CHAT: MessageSquare, APP: MessageSquare, EMAIL: MessageSquare };
const PRI: Record<string, string> = { URGENT: "bg-crit text-white", HIGH: "bg-[#FFE2E6] text-crit", NORMAL: "bg-bg text-muted", LOW: "bg-bg text-muted" };
const MOOD: Record<string, string> = { ANGRY: "text-crit", FRUSTRATED: "text-warn", CONFUSED: "text-blue", CALM: "text-[#1FAF6B]" };

function CaseView({ id, onChange }: { id: string; onChange: () => void }) {
  const toast = useToast();
  const { data: c, error, reload } = useApi<Full>(`/api/admin/support/${id}`, { refreshMs: 10_000 });
  const [text, setText] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [c?.messages.length]);
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!c) return <Loading rows={6} />;
  const act = async (k: string, fn: () => Promise<unknown>, ok?: string) => { setBusy(k); try { await fn(); if (ok) toast(ok, "ok"); reload(); onChange(); } catch (e: any) { toast(e.message, "err"); } finally { setBusy(null); } };
  const p = c.customer.profile;
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <Card pad={false} className="flex min-h-[560px] flex-col">
        <header className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <div className="min-w-0 flex-1"><b className="block truncate text-[15px]">{c.subject}</b><small className="text-muted">{c.channel === "VOICE" ? `Phone call from ${c.phone}` : c.email} · {dateTime(c.messages[0]?.createdAt)}</small></div>
          <Select value={c.priority} onChange={(e) => act("pri", () => api(`/api/admin/support/${id}`, { method: "PATCH", body: { priority: e.target.value } }))} options={["LOW", "NORMAL", "HIGH", "URGENT"]} className="!h-9 w-28" />
          <Select value={c.assigneeId ?? ""} onChange={(e) => act("as", () => api(`/api/admin/support/${id}`, { method: "PATCH", body: { assigneeId: e.target.value || null } }))} options={[{ value: "", label: "Unassigned" }, ...c.agents.map((a) => ({ value: a.id, label: a.name }))]} className="!h-9 w-36" />
          <Button size="sm" variant={c.status === "RESOLVED" ? "default" : "pri"} loading={busy === "res"} onClick={() => act("res", () => api(`/api/admin/support/${id}`, { method: "PATCH", body: { status: c.status === "RESOLVED" ? "WAITING_AGENT" : "RESOLVED" } }), c.status === "RESOLVED" ? "Reopened" : "Resolved")}>{c.status === "RESOLVED" ? "Reopen" : "Resolve"}</Button>
        </header>
        {c.aiSummary && <div className="border-b border-line bg-sky/50 px-4 py-2.5 text-[13px]"><Sparkles className="me-1 inline h-3.5 w-3.5 text-blue" /><b>AI summary: </b>{c.aiSummary}{c.sentiment && <b className={cx("ms-2", MOOD[c.sentiment])}>· {c.sentiment.toLowerCase()}</b>}</div>}
        <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: 520 }}>
          {c.messages.filter((m) => m.body !== "silence").map((m) => (
            <div key={m.id} className={cx("flex gap-2", m.from === "CUSTOMER" ? "" : "flex-row-reverse")}>
              <span className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-full", m.from === "AI" ? "bg-sky text-blue" : m.from === "AGENT" ? "bg-navy text-white" : "bg-bg text-muted")}>{m.from === "AI" ? <Bot className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}</span>
              <div className={cx("max-w-[78%] rounded-2xl px-3.5 py-2.5 text-[14px]", m.internal ? "border border-dashed border-[#F5DDAF] bg-[#FFF9EC]" : m.from === "CUSTOMER" ? "bg-bg" : m.from === "AI" ? "bg-sky/70" : "bg-navy text-white")}>
                {m.internal && <small className="mb-1 flex items-center gap-1 font-bold text-[#7A4B00]"><Lock className="h-3 w-3" />Internal note</small>}
                <p className="whitespace-pre-wrap">{m.body}</p>
                <small className={cx("mt-1 block text-[11px]", m.from === "AGENT" && !m.internal ? "text-white/60" : "text-muted")}>{m.from === "AI" ? "AI agent" : m.from === "AGENT" ? "Agent" : "Customer"} · {ago(m.createdAt)}</small>
              </div>
            </div>
          ))}
          <div ref={end} />
        </div>
        <footer className="space-y-2 border-t border-line p-4">
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={internal ? "Note for the team (the customer won't see it)" : c.channel === "VOICE" && !c.email ? "This caller has no email on file. Reply by calling them back, or leave an internal note." : "Reply to the customer"} />
          <div className="flex flex-wrap items-center gap-2">
            <Toggle checked={internal} onChange={setInternal} label="Internal note" />
            <span className="flex-1" />
            <Button size="sm" loading={busy === "sum"} onClick={() => act("sum", () => api(`/api/admin/support/${id}/ai`, { body: { kind: "summary" } }), "Summary updated")}><Sparkles className="h-4 w-4" />Summarize</Button>
            <Button size="sm" loading={busy === "draft"} onClick={async () => { setBusy("draft"); try { const r = await api<{ draft: string }>(`/api/admin/support/${id}/ai`, { body: { kind: "draft" } }); setText(r.draft); setInternal(false); } catch (e: any) { toast(e.message, "err"); } finally { setBusy(null); } }}><Bot className="h-4 w-4" />Draft reply</Button>
            <Button size="sm" variant="pri" loading={busy === "send"} disabled={!text.trim()} onClick={() => act("send", async () => { await api(`/api/admin/support/${id}`, { body: { message: text, internal } }); setText(""); }, internal ? "Note saved" : "Reply sent")}><Send className="h-4 w-4" />{internal ? "Save note" : "Send"}</Button>
          </div>
        </footer>
      </Card>
      <div className="space-y-4">
        <Card title="Customer">
          {!c.customer.user ? <p className="text-[13.5px] text-muted">{c.channel === "VOICE" ? "Unverified caller. Account details are never discussed by phone." : "Not signed in."}</p> : (
            <dl className="space-y-1.5 text-[13.5px]">
              <div><b>{p?.legalName ?? c.customer.user.name}</b><small className="block text-muted">{c.customer.user.email}</small></div>
              <div className="flex flex-wrap gap-1 pt-1">
                <Badge status={p?.kycStatus ?? "NONE"} />{p && <Badge tone="gray">Level {p.tier}</Badge>}{c.customer.user.totpEnabledAt ? <Badge tone="green">2-step on</Badge> : <Badge tone="amber">No 2-step</Badge>}
                {p?.frozenAt && <Badge tone="red">Frozen</Badge>}{p?.pinLockedUntil && new Date(p.pinLockedUntil) > new Date() && <Badge tone="amber">PIN locked</Badge>}{p?.riskLevel === "HIGH" && <Badge tone="red">High risk</Badge>}
              </div>
              {p?.frozenReason && <p className="text-[12.5px] text-crit"><ShieldAlert className="me-1 inline h-3.5 w-3.5" />{p.frozenReason}</p>}
            </dl>
          )}
        </Card>
        {c.customer.transfers.length > 0 && <Card title="Recent transfers"><ul className="space-y-2 text-[13px]">{c.customer.transfers.map((t) => <li key={t.id} className="flex items-center justify-between gap-2"><span className="min-w-0 truncate">{t.recipient.name} <span className="text-muted">· {t.recipient.country}</span></span><span className="flex shrink-0 items-center gap-1.5">{cents(t.sendCents, t.sendCurrency)}<Badge status={t.status} /></span></li>)}</ul></Card>}
        {c.customer.cards.length > 0 && <Card title="Cards"><ul className="space-y-1.5 text-[13px]">{c.customer.cards.map((k) => <li key={k.id} className="flex justify-between"><span>•••• {k.last4} {k.familyId ? "(teen)" : ""}</span><Badge status={k.status} /></li>)}</ul></Card>}
        {c.customer.history.length > 0 && <Card title="Earlier conversations"><ul className="space-y-1.5 text-[13px]">{c.customer.history.map((h) => <li key={h.id} className="flex justify-between gap-2"><span className="truncate">{h.subject}</span><small className="shrink-0 text-muted">{ago(h.createdAt)}</small></li>)}</ul></Card>}
      </div>
    </div>
  );
}

export default function SupportDesk() {
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const { data, error, reload } = useApi<List>(`/api/admin/support${status ? `?status=${status}` : ""}`, { refreshMs: 10_000 });
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return <Loading rows={6} />;
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Customers" title="AI call center and support desk" sub={data.phone ? `Customers call ${data.phone} or chat in the app. The AI agent answers first and hands over to your team when needed.` : "Add your support phone number in Plugin centre, AI call center, to switch on the phone line."} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Waiting for an agent" value={data.counts.WAITING_AGENT ?? 0} tone={(data.counts.WAITING_AGENT ?? 0) > 0 ? "warn" : undefined} />
        <Stat label="AI handling now" value={data.counts.AI_HANDLING ?? 0} />
        <Stat label="Calls today" value={data.today.VOICE ?? 0} hint={`${(data.today.APP ?? 0) + (data.today.CHAT ?? 0)} chats`} />
        <Stat label="Solved by AI, 30 days" value={data.aiResolutionRate == null ? "—" : `${Math.round(data.aiResolutionRate * 100)}%`} />
        <Stat label="Satisfaction" value={data.csat == null ? "—" : `${data.csat.toFixed(1)} / 5`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-3">
          <Tabs value={status} onChange={setStatus} tabs={[{ key: "", label: "Open" }, { key: "WAITING_AGENT", label: "Needs agent" }, { key: "RESOLVED", label: "Solved" }]} />
          {!data.cases.length ? <Empty icon={<Headphones className="h-6 w-6" />} title="No conversations here" /> : (
            <ul className="card divide-y divide-line overflow-hidden">
              {data.cases.map((c) => { const I = CH[c.channel] ?? MessageSquare; return (
                <li key={c.id}><button onClick={() => setOpen(c.id)} className={cx("flex w-full items-start gap-3 p-3.5 text-start transition hover:bg-bg", open === c.id && "bg-sky/50")}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-bg"><I className="h-4 w-4 text-muted" /></span>
                  <span className="min-w-0 flex-1"><b className="block truncate text-[14px]">{c.subject}</b><small className="block truncate text-muted">{c.aiSummary ?? c.name ?? c.phone ?? c.email}</small>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5"><Badge status={c.status} />{c.priority !== "NORMAL" && <span className={cx("rounded-full px-2 py-0.5 text-[10.5px] font-bold", PRI[c.priority])}>{c.priority}</span>}{c.sentiment && <small className={cx("text-[11px] font-bold", MOOD[c.sentiment])}>{c.sentiment.toLowerCase()}</small>}</span></span>
                  <small className="shrink-0 text-[11px] text-muted">{ago(c.updatedAt)}</small>
                </button></li>
              ); })}
            </ul>
          )}
        </div>
        {open ? <CaseView id={open} onChange={reload} /> : <Card><Empty icon={<Headphones className="h-6 w-6" />} title="Pick a conversation" body="Phone calls are transcribed live. You see what the AI said, the customer's account status and their recent transfers." /></Card>}
      </div>
    </div>
  );
}
