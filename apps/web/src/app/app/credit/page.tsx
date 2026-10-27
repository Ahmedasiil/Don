"use client";
import { useEffect, useState } from "react";
import { Gauge, Landmark, Info, CheckCircle2, AlertCircle } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { date } from "@/lib/format";
import { Button, Field, Input, Loading, Modal, Select, Textarea, cx, useToast } from "@/components/ui";
import { money, PageTitle, PayConfirm, readiness, Row, SetupBanner, Status, toCents, type Overview } from "../bits";

type Factor = { key: string; label: string; value: number; tip: string };
type Loan = { id: string; principalCents: number; aprBps: number; termMonths: number; paymentCents: number; status: string; balanceCents: number; nextDueAt: string | null; decisionNote: string | null; createdAt: string; payments: { id: string; dueAt: string; amountCents: number; status: string }[] };
type C = { score: number; band: string; factors: Factor[]; at: string; history: { at: string; score: number }[]; offer: { maxCents: number; aprBps: number; terms: number[]; currency: string } | null; lendingOpen: boolean; loans: Loan[] };
const BAND: Record<string, [string, string]> = { EXCELLENT: ["Excellent", "#12B76A"], VERY_GOOD: ["Very good", "#32D583"], GOOD: ["Good", "#2E5BFF"], FAIR: ["Fair", "#F79009"], POOR: ["Building", "#F04438"] };

function Dial({ score, band }: { score: number; band: string }) {
  const t = (score - 300) / 600, a = Math.PI * (1 - t), r = 80, cx0 = 100, cy0 = 96;
  const [, color] = BAND[band] ?? BAND.POOR;
  return (
    <svg viewBox="0 0 200 110" className="w-full max-w-[260px]" aria-label={`Score ${score} out of 900`}>
      <path d={`M20,${cy0} A${r},${r} 0 0 1 180,${cy0}`} fill="none" stroke="#EEF0F4" strokeWidth="14" strokeLinecap="round" />
      <path d={`M20,${cy0} A${r},${r} 0 0 1 ${(cx0 + r * Math.cos(a)).toFixed(1)},${(cy0 - r * Math.sin(a)).toFixed(1)}`} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" />
      <text x="100" y="82" textAnchor="middle" className="fill-[#0B1020] font-display" fontSize="38" fontWeight="600">{score}</text>
      <text x="100" y="104" textAnchor="middle" fill="#667085" fontSize="11">out of 900</text>
    </svg>
  );
}

export default function Credit() {
  const toast = useToast();
  const { data: o } = useApi<Overview>("/api/pay/overview");
  const { data: c, reload } = useApi<C>("/api/pay/credit");
  const [apply, setApply] = useState(false);
  const [amount, setAmount] = useState("");
  const [term, setTerm] = useState("12");
  const [purpose, setPurpose] = useState("");
  const [quote, setQuote] = useState<{ paymentCents: number | null; totalCents?: number } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [payLoan, setPayLoan] = useState<Loan | null>(null);
  const cents = toCents(amount);
  useEffect(() => { if (!apply || cents < 50_000) { setQuote(null); return; } const t = setTimeout(() => api("/api/pay/credit?quote", { body: { amountCents: cents, termMonths: Number(term) } }).then(setQuote).catch(() => setQuote(null)), 300); return () => clearTimeout(t); }, [apply, cents, term]);
  if (!c || !o) return <Loading rows={6} />;
  const [bandLabel, bandColor] = BAND[c.band] ?? BAND.POOR;
  const open = c.loans.find((l) => ["REVIEW", "APPROVED", "ACTIVE"].includes(l.status));
  return (
    <div className="space-y-6">
      <PageTitle title="Credit" sub="Your oenodpay credit score updates every day from how you use your account. A good score unlocks bigger loans at lower rates." />
      {readiness(o) && <SetupBanner o={o} />}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="card flex flex-col items-center p-6 text-center">
          <span className="pay-label mb-2 flex items-center gap-1.5"><Gauge className="h-4 w-4" />oenodpay score</span>
          <Dial score={c.score} band={c.band} />
          <span className="mt-1 rounded-full px-3 py-1 text-[13px] font-semibold text-white" style={{ background: bandColor }}>{bandLabel}</span>
          <small className="mt-3 text-[12px] text-[#667085]">Updated {date(c.at)}. This is oenodpay's own score, not a credit bureau score, and checking it never lowers it.</small>
        </section>
        <section className="card p-5">
          <h2 className="pay-h mb-3">What shapes your score</h2>
          <ul className="space-y-3.5">{c.factors.map((f) => (
            <li key={f.key} className="flex gap-3">{f.value >= 70 ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#12B76A]" /> : f.value >= 40 ? <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#2E5BFF]" /> : <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#F79009]" />}
              <span className="min-w-0 flex-1"><span className="flex items-center gap-3"><b className="flex-1 text-[14px]">{f.label}</b><span className="h-1.5 w-24 overflow-hidden rounded-full bg-[#EEF0F4]"><i className="block h-full rounded-full" style={{ width: `${f.value}%`, background: f.value >= 70 ? "#12B76A" : f.value >= 40 ? "#2E5BFF" : "#F79009" }} /></span></span><small className="text-[13px] text-[#667085]">{f.tip}</small></span></li>
          ))}</ul>
        </section>
      </div>

      <section className="card p-5">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-[#0B1020] text-white"><Landmark className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="pay-h">Personal loan</h2>
            <p className="text-[13.5px] text-[#667085]">{!c.lendingOpen ? "Loans are opening soon. Keep building your score." : open ? "You have a loan open." : c.offer ? `You can borrow up to ${money(c.offer.maxCents, c.offer.currency)} at ${(c.offer.aprBps / 100).toFixed(2)}% a year. Fixed monthly payments, no fee to pay it off early.` : "Keep building your score to unlock a loan offer."}</p>
          </div>
          {c.offer && !open && <Button variant="pri" disabled={!!readiness(o)} onClick={() => setApply(true)}>Check my offer</Button>}
        </div>
        {c.loans.map((l) => (
          <div key={l.id} className="mt-4 rounded-[14px] border border-[#EEF0F4] p-4">
            <div className="flex flex-wrap items-center gap-3"><b className="flex-1 text-[15px]">{money(l.principalCents, o.currency)} over {l.termMonths} months</b><Status status={l.status} /></div>
            <div className="mt-2 grid gap-1 text-[13.5px] sm:grid-cols-3"><Row k="Monthly" v={money(l.paymentCents, o.currency)} /><Row k="Still owed" v={money(l.balanceCents, o.currency)} /><Row k="Next payment" v={l.nextDueAt ? date(l.nextDueAt) : "—"} /></div>
            {l.decisionNote && <p className="mt-2 text-[13px] text-[#667085]">{l.decisionNote}</p>}
            {l.status === "ACTIVE" && <div className="mt-3 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-[#EEF0F4]"><div className="h-full bg-[#2E5BFF]" style={{ width: `${Math.round((1 - l.balanceCents / l.principalCents) * 100)}%` }} /></div><Button size="sm" onClick={() => setPayLoan(l)}>Pay now</Button></div>}
          </div>
        ))}
      </section>

      <Modal open={apply && !confirm} onClose={() => setApply(false)} title="Your loan" footer={<><Button onClick={() => setApply(false)}>Cancel</Button><Button variant="pri" disabled={!quote?.paymentCents} onClick={() => setConfirm(true)}>Apply</Button></>}>
        {c.offer && <div className="space-y-4">
          <Field label="How much?" help={`From ${money(50_000, o.currency)} to ${money(c.offer.maxCents, o.currency)}`}><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} className="h-14 font-display text-2xl" placeholder="0.00" autoFocus /></Field>
          <Field label="Over"><Select value={term} onChange={(e) => setTerm(e.target.value)} options={c.offer.terms.map((t) => ({ value: String(t), label: `${t} months` }))} /></Field>
          <Field label="What's it for? (optional)"><Textarea rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} /></Field>
          {quote?.paymentCents && <div className="rounded-[14px] bg-[#F7F8FA] p-4 text-[14px]"><Row k="Monthly payment" v={money(quote.paymentCents, o.currency)} /><Row k="Rate" v={`${(c.offer.aprBps / 100).toFixed(2)}% APR`} /><Row k="Total you'll repay" v={money(quote.totalCents, o.currency)} /></div>}
          <p className="text-[12px] text-[#667085]">A person on our credit team reviews every application. Payments come out of your wallet automatically each month.</p>
        </div>}
      </Modal>
      <PayConfirm open={confirm} onClose={() => setConfirm(false)} title="Apply for loan" summary={<><Row k="Amount" v={money(cents, o.currency)} /><Row k="Term" v={`${term} months`} /><Row k="Monthly" v={money(quote?.paymentCents, o.currency)} /></>}
        run={async (pin, code) => { await api("/api/pay/credit", { body: { amountCents: cents, termMonths: Number(term), purpose: purpose || undefined, pin, code } }); setConfirm(false); setApply(false); toast("Application sent. We'll let you know soon.", "ok"); reload(); }} />
      <PayConfirm open={!!payLoan} onClose={() => setPayLoan(null)} title="Pay your loan" summary={payLoan && <><Row k="Payment" v={money(payLoan.paymentCents, o.currency)} /><Row k="Still owed after" v={money(Math.max(0, payLoan.balanceCents - payLoan.paymentCents), o.currency)} /></>}
        run={async (pin) => { await api(`/api/pay/credit/loans/${payLoan!.id}`, { body: { pin } }); setPayLoan(null); toast("Payment made", "ok"); reload(); }} />
    </div>
  );
}
