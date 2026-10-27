"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { LineChart, TrendingUp, TrendingDown, Search, Moon } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { ago } from "@/lib/format";
import { Button, ErrorNote, Field, Input, Loading, Modal, Tabs, Toggle, cx, useToast } from "@/components/ui";
import { BigMoney, money, newKey, PageTitle, PayConfirm, readiness, Row, SetupBanner, Status, toCents, type Overview } from "../bits";

type Holding = { symbol: string; kind: string; name: string; quantity: number; costCents: number; valueCents: number | null; changePct: number | null; gainCents: number | null };
type Trade = { id: string; symbol: string; side: string; amountCents: number; feeCents: number; quantity: number | null; status: string; createdAt: string; failureReason: string | null };
type P = { currency: string; rows: Holding[]; valueCents: number; costCents: number; gainCents: number; trades: Trade[]; tradable: string[]; minCents: number; feeExample: number };
type Q = { symbol: string; name: string; kind: string; price: number | null; changePct: number | null; halal: boolean };

const pct = (n: number | null) => (n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`);

function Trade({ q, side, held, currency, onClose, onDone, feeBps }: { q: Q; side: "BUY" | "SELL"; held?: Holding; currency: string; onClose: () => void; onDone: () => void; feeBps: number }) {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [all, setAll] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [key] = useState(newKey);
  const cents = all && held?.valueCents ? held.valueCents : toCents(amount);
  const fee = Math.round((cents * feeBps) / 10_000);
  return (
    <>
      <Modal open={!confirm} onClose={onClose} title={`${side === "BUY" ? "Buy" : "Sell"} ${q.name}`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="pri" disabled={cents < 100} onClick={() => setConfirm(true)}>Review</Button></>}>
        <div className="space-y-4">
          <div className="flex items-baseline justify-between"><span className="text-[#667085]">{q.symbol}</span><span><b className="pay-num text-[20px]">{q.price == null ? "—" : `US$${q.price.toLocaleString("en-US", { maximumFractionDigits: q.price < 10 ? 4 : 2 })}`}</b> <span className={cx("text-[13px] font-semibold", (q.changePct ?? 0) >= 0 ? "text-[#067647]" : "text-[#B42318]")}>{pct(q.changePct)}</span></span></div>
          {side === "SELL" && held && <div className="rounded-xl bg-[#F7F8FA] p-3 text-[13.5px]"><Row k="You own" v={`${held.quantity.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${q.symbol.split("/")[0]}`} /><Row k="Worth about" v={money(held.valueCents, currency)} /></div>}
          <Field label={`Amount in ${currency}`}><Input inputMode="decimal" value={all ? ((held?.valueCents ?? 0) / 100).toFixed(2) : amount} disabled={all} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.00" className="h-14 font-display text-2xl" autoFocus /></Field>
          {side === "BUY" ? <div className="flex gap-2">{["25", "50", "100", "500"].map((a) => <button key={a} onClick={() => setAmount(a)} className={cx("flex-1 rounded-xl border py-2 text-[13.5px] font-semibold", amount === a ? "border-[#0B1020] bg-[#0B1020] text-white" : "border-[#E7E9EF]")}>{a}</button>)}</div>
            : <Toggle checked={all} onChange={setAll} label="Sell everything" />}
          <p className="text-[12px] leading-relaxed text-[#667085]">Market order, filled at the next price. Fee {money(fee, currency)}. Prices move; you could get back less than you put in. Not investment advice.</p>
        </div>
      </Modal>
      <PayConfirm open={confirm} onClose={() => setConfirm(false)} title={side === "BUY" ? "Confirm purchase" : "Confirm sale"} summary={<><Row k={side === "BUY" ? "Buy" : "Sell"} v={q.name} /><Row k="Amount" v={money(cents, currency)} /><Row k="Fee" v={money(fee, currency)} /><Row k={side === "BUY" ? "Total from wallet" : "To your wallet"} v={money(side === "BUY" ? cents + fee : cents - fee, currency)} /></>}
        run={async (pin, code) => { await api("/api/pay/invest", { body: { side, symbol: q.symbol, amountCents: all ? undefined : cents, all: all || undefined, pin, code, idempotencyKey: key } }); toast(side === "BUY" ? "Order placed. It fills in a few seconds." : "Sell order placed.", "ok"); onDone(); onClose(); }} />
    </>
  );
}

export default function Invest() {
  const { data: o } = useApi<Overview>("/api/pay/overview");
  const { data: p, error, reload } = useApi<P>("/api/pay/invest", { refreshMs: 20_000 });
  const { data: mk } = useApi<{ quotes: Q[] }>("/api/pay/markets", { refreshMs: 30_000 });
  const [tab, setTab] = useState<"STOCK" | "CRYPTO">("STOCK");
  const [q, setQ] = useState("");
  const [halal, setHalal] = useState(false);
  const [trade, setTrade] = useState<{ q: Q; side: "BUY" | "SELL" } | null>(null);
  const list = useMemo(() => (mk?.quotes ?? []).filter((x) => x.kind === tab && (!halal || x.halal) && (!q || `${x.symbol} ${x.name}`.toLowerCase().includes(q.toLowerCase()))), [mk, tab, halal, q]);
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!p || !o) return <Loading rows={6} />;
  const feeBps = p.feeExample; // the fee on 100.00, in cents, is the rate in basis points
  const quoteFor = (h: Holding): Q => mk?.quotes.find((x) => x.symbol === h.symbol) ?? { symbol: h.symbol, name: h.name, kind: h.kind, price: null, changePct: h.changePct, halal: false };
  return (
    <div className="space-y-6">
      <PageTitle title="Invest" sub="Buy stocks, ETFs and crypto from your wallet, starting at $1. Sell any time and the money comes straight back." action={<Link href="/app/markets" className="btn"><LineChart className="h-4 w-4" />Markets and alerts</Link>} />
      {readiness(o) && <SetupBanner o={o} />}
      <section className="card p-6">
        <span className="pay-label">Portfolio value</span>
        <BigMoney cents={p.valueCents} currency={p.currency} className="mt-2 block text-[40px] font-semibold leading-none" />
        <div className={cx("mt-2 inline-flex items-center gap-1 text-[13.5px] font-semibold", p.gainCents >= 0 ? "text-[#067647]" : "text-[#B42318]")}>{p.gainCents >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}{p.gainCents >= 0 ? "+" : ""}{money(p.gainCents, p.currency)} all time{p.costCents ? ` (${pct((p.gainCents / p.costCents) * 100)})` : ""}</div>
        {p.rows.length > 0 && <div className="mt-5 divide-y divide-[#EEF0F4] border-t border-[#EEF0F4]">{p.rows.map((h) => (
          <div key={h.symbol} className="flex items-center gap-3 py-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#EEF4FF] font-display text-[11px] font-semibold text-[#2E5BFF]">{h.symbol.split("/")[0].slice(0, 4)}</span>
            <span className="min-w-0 flex-1"><b className="block truncate text-[14px]">{h.name}</b><small className="text-[12.5px] text-[#667085]">{h.quantity.toLocaleString("en-US", { maximumFractionDigits: 6 })} · cost {money(h.costCents, p.currency)}</small></span>
            <span className="text-end"><b className="pay-num block text-[14px]">{money(h.valueCents ?? h.costCents, p.currency)}</b><small className={cx("text-[12.5px] font-semibold", (h.gainCents ?? 0) >= 0 ? "text-[#067647]" : "text-[#B42318]")}>{h.gainCents == null ? "" : `${h.gainCents >= 0 ? "+" : ""}${money(h.gainCents, p.currency)}`}</small></span>
            <span className="flex gap-1.5"><Button size="sm" onClick={() => setTrade({ q: quoteFor(h), side: "SELL" })}>Sell</Button><Button size="sm" variant="pri" onClick={() => setTrade({ q: quoteFor(h), side: "BUY" })}>Buy</Button></span>
          </div>
        ))}</div>}
      </section>
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="pay-h me-2">Discover</h2>
          <Tabs value={tab} onChange={setTab} tabs={[{ key: "STOCK", label: "Stocks and ETFs" }, { key: "CRYPTO", label: "Crypto" }]} />
          <span className="flex-1" />
          <span className="flex items-center gap-2"><Moon className="h-4 w-4 text-[#1FAF6B]" /><Toggle checked={halal} onChange={setHalal} label="Halal only" /></span>
          <label className="flex h-10 items-center gap-2 rounded-xl border border-[#E7E9EF] bg-white px-3"><Search className="h-4 w-4 text-[#667085]" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="w-32 bg-transparent text-[14px] outline-none" /></label>
        </div>
        {!mk ? <Loading rows={4} /> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{list.map((x) => (
          <article key={x.symbol} className="card flex items-center gap-3 p-4">
            <span className="min-w-0 flex-1"><b className="block truncate text-[14px]">{x.name}</b><small className="text-[12.5px] text-[#667085]">{x.symbol} · <span className={cx("font-semibold", (x.changePct ?? 0) >= 0 ? "text-[#067647]" : "text-[#B42318]")}>{pct(x.changePct)}</span></small></span>
            <Button size="sm" variant="pri" disabled={!!readiness(o)} onClick={() => setTrade({ q: x, side: "BUY" })}>Buy</Button>
          </article>
        ))}</div>}
      </section>
      {p.trades.length > 0 && <section><h2 className="pay-h mb-3">Orders</h2><div className="card divide-y divide-[#EEF0F4]">{p.trades.slice(0, 15).map((t) => (
        <div key={t.id} className="flex items-center gap-3 px-5 py-3"><span className="min-w-0 flex-1"><b className="block text-[14px]">{t.side === "BUY" ? "Bought" : "Sold"} {t.symbol}</b><small className="text-[12.5px] text-[#667085]">{ago(t.createdAt)}{t.failureReason ? ` · ${t.failureReason}` : ""}</small></span><b className="pay-num text-[14px]">{money(t.amountCents, p.currency)}</b><Status status={t.status} /></div>
      ))}</div></section>}
      {trade && <Trade q={trade.q} side={trade.side} held={p.rows.find((h) => h.symbol === trade.q.symbol)} currency={p.currency} feeBps={feeBps} onClose={() => setTrade(null)} onDone={reload} />}
    </div>
  );
}
