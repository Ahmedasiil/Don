"use client";
import { useState } from "react";
import { Receipt, Plus, Zap, Flame, Droplets, Phone, Wifi, Tv, Landmark, Shield, CreditCard, GraduationCap, CalendarClock, Repeat } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { date } from "@/lib/format";
import { Button, Empty, Field, Input, Loading, Modal, Select, Toggle, useToast } from "@/components/ui";
import { money, newKey, PageTitle, PayConfirm, readiness, Row, SetupBanner, Status, toCents, type Overview } from "../bits";

type Biller = { id: string; name: string; category: string; accountLabel: string; accountHint: string | null };
type Payee = { id: string; nickname: string | null; label: string; biller: { name: string; category: string } };
type Payment = { id: string; amountCents: number; feeCents: number; currency: string; status: string; scheduledFor: string; repeat: string | null; confirmation: string | null; failureReason: string | null; payee: { label: string; nickname: string | null } };
type D = { billers: Biller[]; payees: Payee[]; payments: Payment[]; feeCents: number };
const ICON: Record<string, typeof Zap> = { ELECTRICITY: Zap, GAS: Flame, WATER: Droplets, PHONE: Phone, INTERNET: Wifi, TV: Tv, TAX: Landmark, INSURANCE: Shield, CREDIT_CARD: CreditCard, EDUCATION: GraduationCap };
const today = () => new Date().toISOString().slice(0, 10);

export default function Bills() {
  const toast = useToast();
  const { data: o } = useApi<Overview>("/api/pay/overview");
  const { data, reload } = useApi<D>("/api/pay/bills");
  const [adding, setAdding] = useState(false);
  const [nb, setNb] = useState({ billerId: "", account: "", nickname: "" });
  const [pay, setPay] = useState<Payee | null>(null);
  const [amount, setAmount] = useState("");
  const [when, setWhen] = useState(today());
  const [monthly, setMonthly] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [key, setKey] = useState(newKey);
  if (!data || !o) return <Loading rows={6} />;
  const biller = data.billers.find((b) => b.id === nb.billerId);
  const upcoming = data.payments.filter((p) => p.status === "SCHEDULED");
  const past = data.payments.filter((p) => p.status !== "SCHEDULED");
  const cancel = async (id: string) => { try { await api(`/api/pay/bills/${id}`, { method: "DELETE" }); toast("Cancelled", "ok"); reload(); } catch (e: any) { toast(e.message, "err"); } };
  return (
    <div className="space-y-6">
      <PageTitle title="Pay bills" sub="Hydro, phone, internet, taxes and more, paid from your wallet. Schedule them or set them to repeat every month." action={<Button variant="pri" onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Add a biller</Button>} />
      {readiness(o) && <SetupBanner o={o} />}
      {!data.payees.length ? <Empty icon={<Receipt className="h-6 w-6" />} title="Add your first bill" body="Pick the company and enter your account number from your bill." action={<Button variant="pri" onClick={() => setAdding(true)}>Add a biller</Button>} /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.payees.map((p) => { const I = ICON[p.biller.category] ?? Receipt; return (
          <article key={p.id} className="card flex items-center gap-3 p-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-[#F2F4F7]"><I className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><b className="block truncate text-[14px]">{p.nickname ?? p.biller.name}</b><small className="text-[12.5px] text-[#667085]">{p.label}</small></span>
            <Button size="sm" variant="pri" disabled={!!readiness(o)} onClick={() => { setPay(p); setAmount(""); setWhen(today()); setMonthly(false); }}>Pay</Button>
          </article>
        ); })}</div>
      )}
      {upcoming.length > 0 && <section><h2 className="pay-h mb-3">Upcoming</h2><div className="card divide-y divide-[#EEF0F4]">{upcoming.map((p) => (
        <div key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5"><CalendarClock className="h-5 w-5 text-[#2E5BFF]" /><span className="min-w-0 flex-1"><b className="block text-[14px]">{p.payee.nickname ?? p.payee.label}</b><small className="flex items-center gap-1 text-[12.5px] text-[#667085]">{date(p.scheduledFor)}{p.repeat && <><Repeat className="ms-1 h-3 w-3" />Every month</>}</small></span><b className="pay-num">{money(p.amountCents, p.currency)}</b><Button size="sm" variant="ghost" onClick={() => cancel(p.id)}>Cancel</Button></div>
      ))}</div></section>}
      {past.length > 0 && <section><h2 className="pay-h mb-3">History</h2><div className="card divide-y divide-[#EEF0F4]">{past.map((p) => (
        <div key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5"><span className="min-w-0 flex-1"><b className="block text-[14px]">{p.payee.nickname ?? p.payee.label}</b><small className="text-[12.5px] text-[#667085]">{date(p.scheduledFor)}{p.confirmation ? ` · Confirmation ${p.confirmation}` : ""}{p.failureReason ? ` · ${p.failureReason}` : ""}</small></span><b className="pay-num">{money(p.amountCents, p.currency)}</b><Status status={p.status} /></div>
      ))}</div></section>}
      <p className="text-[12px] text-[#667085]">Payments usually reach the biller in 1 to 3 business days. Pay a few days before your due date.</p>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a biller" footer={<><Button onClick={() => setAdding(false)}>Cancel</Button><Button variant="pri" disabled={!nb.billerId || nb.account.length < 4} onClick={async () => { try { await api("/api/pay/bills/payees", { body: { ...nb, nickname: nb.nickname || undefined } }); setAdding(false); setNb({ billerId: "", account: "", nickname: "" }); reload(); } catch (e: any) { toast(e.message, "err"); } }}>Save</Button></>}>
        <div className="space-y-4">
          <Field label="Company"><Select value={nb.billerId} onChange={(e) => setNb({ ...nb, billerId: e.target.value })} placeholder="Choose" options={data.billers.map((b) => ({ value: b.id, label: `${b.name} (${b.category.replace("_", " ").toLowerCase()})` }))} /></Field>
          <Field label={biller?.accountLabel ?? "Account number"} help={biller?.accountHint ?? "It's on your bill."}><Input value={nb.account} onChange={(e) => setNb({ ...nb, account: e.target.value })} autoComplete="off" /></Field>
          <Field label="Nickname (optional)"><Input value={nb.nickname} onChange={(e) => setNb({ ...nb, nickname: e.target.value })} placeholder="Home hydro" /></Field>
        </div>
      </Modal>
      <Modal open={!!pay && !confirm} onClose={() => setPay(null)} title={`Pay ${pay?.nickname ?? pay?.biller.name ?? ""}`} footer={<><Button onClick={() => setPay(null)}>Cancel</Button><Button variant="pri" disabled={toCents(amount) < 100} onClick={() => setConfirm(true)}>Review</Button></>}>
        <div className="space-y-4">
          <Field label="Amount"><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.00" className="h-14 font-display text-2xl" autoFocus /></Field>
          <Field label="Pay on"><Input type="date" min={today()} value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
          <Toggle checked={monthly} onChange={setMonthly} label="Repeat every month" help="Same amount, same day each month. Cancel any time." />
        </div>
      </Modal>
      <PayConfirm open={confirm} onClose={() => setConfirm(false)} title="Confirm bill payment" summary={pay && <><Row k="To" v={pay.label} /><Row k="Amount" v={money(toCents(amount), o.currency)} />{data.feeCents > 0 && <Row k="Fee" v={money(data.feeCents, o.currency)} />}<Row k="Date" v={when === today() ? "Today" : date(when)} />{monthly && <Row k="Repeats" v="Every month" />}</>}
        run={async (pin, code) => { await api("/api/pay/bills", { body: { payeeId: pay!.id, amountCents: toCents(amount), date: when, repeat: monthly ? "MONTHLY" : null, pin, code, idempotencyKey: key } }); setConfirm(false); setPay(null); setKey(newKey()); toast(when === today() ? "Bill paid. We'll confirm when the biller has it." : "Payment scheduled", "ok"); reload(); }} />
    </div>
  );
}
