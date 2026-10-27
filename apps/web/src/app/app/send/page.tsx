"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Clock, Plus, Search, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/client/api";
import { ago } from "@/lib/format";
import { Badge, Button, ErrorNote, Field, Input, Loading, Select, cx, useToast } from "@/components/ui";
import { CodePrompt, ConfirmMoney, money, newKey, PageTitle, readiness, SetupBanner, type Overview, Status } from "../bits";

type Opt = { method: string; label: string; networks?: string[]; eta: string; fields: string[] };
type Corridor = { country: string; name: string; currency: string; flag: string; options: Opt[] };
type Recipient = { id: string; name: string; country: string; currency: string; method: string; network: string | null; label: string | null };
type Quote = { sendCents: number; sendCurrency: string; feeCents: number; totalCents: number; rate: number; receiveCents: number; receiveCurrency: string; eta: string };

const LABEL: Record<string, string> = { accountNumber: "Account number", iban: "IBAN", swift: "SWIFT / BIC or routing number", bankName: "Bank name", phone: "Mobile number (with country code)", ipa: "InstaPay address (name@instapay)", cardNumber: "Card number", walletId: "Wallet or UPI ID" };

export default function SendMoney() {
  const toast = useToast();
  const { data: o } = useApi<Overview>("/api/pay/overview");
  const { data: cs } = useApi<{ from: string; corridors: Corridor[] }>("/api/pay/corridors");
  const { data: rs, reload: reloadRs } = useApi<{ recipients: Recipient[] }>("/api/pay/recipients");
  const [country, setCountry] = useState("EG");
  const [method, setMethod] = useState("");
  const [amount, setAmount] = useState("200");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [qErr, setQErr] = useState<string | null>(null);
  const [recipient, setRecipient] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ name: "" });
  const [network, setNetwork] = useState("");
  const [codeFor, setCodeFor] = useState<null | "recipient">(null);
  const [confirm, setConfirm] = useState(false);
  const [needCode, setNeedCode] = useState(false);
  const [done, setDone] = useState<{ status: string; receiveCents: number; receiveCurrency: string } | null>(null);
  const [key, setKey] = useState(newKey);
  const [q, setQ] = useState("");

  const c = cs?.corridors.find((x) => x.country === country);
  const opt = c?.options.find((x) => x.method === method) ?? c?.options[0];
  useEffect(() => { setMethod(c?.options[0]?.method ?? ""); setNetwork(""); setRecipient(""); }, [country]); // eslint-disable-line react-hooks/exhaustive-deps
  const cents = Math.round(Number(amount || 0) * 100);
  useEffect(() => {
    if (!opt || cents < 500) { setQuote(null); return; }
    const t = setTimeout(() => api<Quote>("/api/pay/quote", { body: { country, method: opt.method, sendCents: cents } }).then((r) => { setQuote(r); setQErr(null); }, (e) => { setQuote(null); setQErr(e.message); }), 350);
    return () => clearTimeout(t);
  }, [country, opt?.method, cents]); // eslint-disable-line react-hooks/exhaustive-deps

  const mine = useMemo(() => (rs?.recipients ?? []).filter((r) => r.country === country && r.method === opt?.method), [rs, country, opt]);
  const blocked = o ? readiness(o) : null;

  const addRecipient = async (code: string) => {
    const details = Object.fromEntries((opt?.fields ?? []).map((f) => [f, form[f] ?? ""]));
    const r = await api<{ id: string }>("/api/pay/recipients", { body: { name: form.name, country, method: opt!.method, network: network || null, details, code } });
    toast("Recipient saved", "ok"); setCodeFor(null); setAdding(false); setForm({ name: "" }); await reloadRs(); setRecipient(r.id);
  };
  const send = async (pin: string, code?: string) => {
    try {
      const t = await api<{ status: string; receiveCents: number; receiveCurrency: string }>("/api/pay/transfers", { body: { recipientId: recipient, sendCents: cents, pin, code, idempotencyKey: key } });
      setConfirm(false); setNeedCode(false); setDone(t); setKey(newKey());
    } catch (e) {
      if (e instanceof ApiError && e.code === "STEP_UP_REQUIRED") { setNeedCode(true); throw new Error("Enter the code from your authenticator app to finish."); }
      throw e;
    }
  };

  if (!cs || !o) return <Loading rows={6} />;
  if (done) return (
    <div className="mx-auto max-w-md py-10 text-center">
      <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#EEFAF4] text-[#1FAF6B]"><Check className="h-10 w-10" /></span>
      <h1 className="mt-5 font-display text-[28px] font-semibold text-[#0B1020]">{done.status === "REVIEW" ? "Sent for a quick check" : "Money is on its way"}</h1>
      <p className="mt-2 text-[14.5px] text-[#667085]">{done.status === "REVIEW" ? "Our compliance team reviews some transfers before they leave, usually within one business day. Your money is held safely until then." : `They'll receive ${money(done.receiveCents, done.receiveCurrency)}. We'll notify you when it arrives.`}</p>
      <div className="mt-6 flex justify-center gap-2"><Link href="/app" className="btn">Home</Link><Button variant="pri" onClick={() => setDone(null)}>Send another</Button></div>
    </div>
  );
  const corridors = cs.corridors.filter((x) => !q || x.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageTitle title="Send money" sub="To bank accounts, mobile wallets, InstaPay, cards and cash pickup. You see the exact rate and fee before you pay." />
      {blocked && <div className="mb-5"><SetupBanner o={o} /></div>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2.5 pay-h"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#0B1020] font-sans text-[11px] font-semibold text-white">1</span>Where to?</h2>
            <label className="mb-3 flex h-10 items-center gap-2 rounded-xl border border-[#E7E9EF] px-3"><Search className="h-4 w-4 text-[#667085]" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search countries" className="h-full w-full bg-transparent text-[14px] outline-none" /></label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{corridors.map((x) => (
              <button key={x.country} onClick={() => setCountry(x.country)} className={cx("flex items-center gap-2 rounded-xl border px-3 py-2.5 text-start text-[13.5px] font-semibold transition", country === x.country ? "border-[#0B1020] bg-[#0B1020] text-white" : "border-[#E7E9EF] hover:border-[#C9D4FF]")}><span className="text-lg">{x.flag}</span><span className="truncate">{x.name}</span></button>
            ))}</div>
          </section>
          {c && <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2.5 pay-h"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#0B1020] font-sans text-[11px] font-semibold text-white">2</span>How will they get it?</h2>
            <div className="grid gap-2 sm:grid-cols-2">{c.options.map((x) => (
              <button key={x.method} onClick={() => { setMethod(x.method); setRecipient(""); setNetwork(""); }} className={cx("rounded-xl border p-3 text-start transition", opt?.method === x.method ? "border-[#0B1020] bg-[#F7F8FA] ring-1 ring-[#0B1020]" : "border-[#E7E9EF] hover:border-[#C9D4FF]")}>
                <b className="block text-[14px]">{x.label}</b><small className="flex items-center gap-1 text-[#667085]"><Clock className="h-3.5 w-3.5" />{x.eta}{x.networks ? ` · ${x.networks.join(", ")}` : ""}</small>
              </button>
            ))}</div>
          </section>}
          {opt && <section className="card p-5">
            <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2.5 pay-h"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#0B1020] font-sans text-[11px] font-semibold text-white">3</span>Who are you sending to?</h2>{!adding && <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4" />New recipient</Button>}</div>
            {adding ? (
              <div className="space-y-3">
                <Field label="Full legal name (as on their ID or account)" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                {opt.networks && <Field label="Network" required><Select value={network} onChange={(e) => setNetwork(e.target.value)} placeholder="Choose…" options={opt.networks} /></Field>}
                {opt.fields.map((f) => <Field key={f} label={LABEL[f] ?? f} required><Input value={form[f] ?? ""} onChange={(e) => setForm({ ...form, [f]: e.target.value })} autoComplete="off" /></Field>)}
                <p className="flex items-center gap-1.5 text-[12.5px] text-[#667085]"><ShieldCheck className="h-4 w-4 text-[#1FAF6B]" />Account details are encrypted. Every recipient is screened against sanctions lists.</p>
                <div className="flex justify-end gap-2"><Button onClick={() => setAdding(false)}>Cancel</Button><Button variant="pri" disabled={!!blocked || form.name.trim().length < 2 || (!!opt.networks && !network)} onClick={() => setCodeFor("recipient")}>Save recipient</Button></div>
              </div>
            ) : !mine.length ? <p className="py-4 text-center text-[13.5px] text-[#667085]">No saved recipients for {opt.label.toLowerCase()} in {c?.name} yet.</p> : (
              <ul className="space-y-2">{mine.map((r) => (
                <li key={r.id}><button onClick={() => setRecipient(r.id)} className={cx("flex w-full items-center gap-3 rounded-xl border p-3 text-start", recipient === r.id ? "border-[#0B1020] bg-[#F7F8FA] ring-1 ring-[#0B1020]" : "border-[#E7E9EF] hover:border-[#C9D4FF]")}>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-[#F7F8FA]"><UserRound className="h-4 w-4 text-[#667085]" /></span>
                  <span className="min-w-0 flex-1"><b className="block text-[14px]">{r.name}</b><small className="text-[#667085]">{r.label}</small></span>
                  <span role="button" tabIndex={0} aria-label="Remove recipient" onClick={async (e) => { e.stopPropagation(); try { await api(`/api/pay/recipients/${r.id}`, { method: "DELETE" }); reloadRs(); } catch (er: any) { toast(er.message, "err"); } }} className="p-1 text-[#667085] hover:text-crit"><Trash2 className="h-4 w-4" /></span>
                </button></li>
              ))}</ul>
            )}
          </section>}
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <section className="overflow-hidden rounded-[18px] border border-[#E7E9EF] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]">
            <div className="bg-[#0B1020] bg-[radial-gradient(90%_120%_at_100%_0%,rgba(46,91,255,.28)_0%,transparent_60%)] p-5 text-white">
              <span className="text-[11px] font-semibold uppercase tracking-[.12em] text-white/55">You send</span>
              <div className="mt-1 flex items-baseline gap-2"><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} className="w-full bg-transparent font-display text-[40px] font-semibold outline-none" /><span className="font-display text-xl text-white/60">{cs.from}</span></div>
              <small className="text-white/60">Available {money(o.availableCents, o.currency)}</small>
            </div>
            <div className="space-y-2.5 p-5 text-[14px]">
              {qErr ? <p className="flex gap-2 rounded-[12px] border border-[#FEDF89] bg-[#FFFAEB] px-3.5 py-3 text-[13px] leading-relaxed text-[#93370D]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />{qErr}</p> : !quote ? <p className="text-[#667085]">Enter at least 5.00 to see your rate.</p> : <>
                <div className="flex justify-between"><span className="text-[#667085]">Exchange rate</span><b>1 {quote.sendCurrency} = {quote.rate} {quote.receiveCurrency}</b></div>
                <div className="flex justify-between"><span className="text-[#667085]">Our fee</span><b>{quote.feeCents ? money(quote.feeCents, quote.sendCurrency) : "Free"}</b></div>
                <div className="flex justify-between"><span className="text-[#667085]">Total to pay</span><b>{money(quote.totalCents, quote.sendCurrency)}</b></div>
                <div className="flex justify-between"><span className="text-[#667085]">Arrives</span><b>{quote.eta}</b></div>
                <div className="mt-3 rounded-[14px] bg-[#F7F8FA] p-4"><span className="text-[12px] font-semibold uppercase tracking-wide text-[#667085]">They receive</span><div className="font-display text-[28px] font-semibold text-[#0B1020]">{money(quote.receiveCents, quote.receiveCurrency)}</div></div>
              </>}
              <Button variant="pri" className="mt-2 h-12 w-full" disabled={!quote || !recipient || !!blocked} onClick={() => setConfirm(true)}>Review and send<ArrowRight className="h-4 w-4 rtl:rotate-180" /></Button>
              <p className="flex items-center justify-center gap-1.5 pt-1 text-[11.5px] text-[#98A2B3]"><ShieldCheck className="h-3.5 w-3.5" />Confirmed with your PIN · screened for your safety</p>
              {o.limits.newDevice && <p className="text-[12px] text-warn">New device: up to {money(o.limits.perTransfer, o.currency)} per transfer for the first 24 hours.</p>}
            </div>
          </section>
          {o.transfers.length > 0 && <section className="card mt-4 p-5"><h3 className="pay-label mb-3">Recent</h3><ul className="space-y-3 text-[13px]">{o.transfers.slice(0, 4).map((t) => <li key={t.id} className="flex justify-between gap-2"><span className="truncate">{t.recipient.name} · {ago(t.createdAt)}</span><Status status={t.status} /></li>)}</ul></section>}
        </aside>
      </div>
      <CodePrompt open={codeFor === "recipient"} onClose={() => setCodeFor(null)} title="Confirm new recipient" onConfirm={addRecipient} />
      <ConfirmMoney open={confirm} onClose={() => { setConfirm(false); setNeedCode(false); }} title="Confirm transfer" needCode={needCode}
        summary={quote && <><div className="flex justify-between"><span>To</span><b>{mine.find((r) => r.id === recipient)?.name}</b></div><div className="flex justify-between"><span>You pay</span><b>{money(quote.totalCents, quote.sendCurrency)}</b></div><div className="flex justify-between"><span>They get</span><b>{money(quote.receiveCents, quote.receiveCurrency)}</b></div></>}
        onConfirm={send} />
    </div>
  );
}
