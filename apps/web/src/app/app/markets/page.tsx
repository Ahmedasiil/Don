"use client";
import { useState } from "react";
import { Star, TrendingUp, TrendingDown, Bell, Moon } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { Button, ErrorNote, Field, Input, Loading, Modal, Sparkline, Tabs, Toggle, cx, useToast } from "@/components/ui";
import { PageTitle } from "../bits";

type Q = { symbol: string; name: string; kind: string; price: number | null; changePct: number | null; currency: string; halal: boolean; source: string; at: string };
type W = { id: string; symbol: string; alertAbove: number | null; alertBelow: number | null };

const fmt = (p: number | null, cur: string) => (p == null ? "—" : new Intl.NumberFormat("en-CA", { style: "currency", currency: cur.length === 3 ? cur : "USD", currencyDisplay: "narrowSymbol", maximumFractionDigits: p < 10 ? 4 : 2 }).format(p));

function Detail({ q, w, onClose, onSaved }: { q: Q; w?: W; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { data } = useApi<{ closes: number[] }>(`/api/pay/markets/${encodeURIComponent(q.symbol)}`);
  const [above, setAbove] = useState(w?.alertAbove ? String(w.alertAbove) : "");
  const [below, setBelow] = useState(w?.alertBelow ? String(w.alertBelow) : "");
  return (
    <Modal open onClose={onClose} title={`${q.name} (${q.symbol})`} footer={<>{w && <Button variant="ghost" onClick={async () => { await api(`/api/pay/watchlist?symbol=${encodeURIComponent(q.symbol)}`, { method: "DELETE" }); onSaved(); onClose(); }}>Remove from watchlist</Button>}<Button variant="pri" onClick={async () => { try { await api("/api/pay/watchlist", { body: { symbol: q.symbol, alertAbove: above ? Number(above) : null, alertBelow: below ? Number(below) : null } }); toast("Saved to your watchlist", "ok"); onSaved(); onClose(); } catch (e: any) { toast(e.message, "err"); } }}><Star className="h-4 w-4" />{w ? "Save alerts" : "Watch"}</Button></>}>
      <div className="space-y-4">
        <div className="flex items-end justify-between"><div className="font-display text-[34px] font-semibold text-[#0B1020]">{fmt(q.price, q.currency)}</div>{q.changePct != null && <span className={cx("font-bold", q.changePct >= 0 ? "text-[#1FAF6B]" : "text-crit")}>{q.changePct >= 0 ? "+" : ""}{q.changePct.toFixed(2)}% today</span>}</div>
        {data?.closes?.length ? <Sparkline values={data.closes} className="h-28 w-full" color={data.closes.at(-1)! >= data.closes[0] ? "#1FAF6B" : "#D9334C"} /> : <div className="grid h-28 place-items-center rounded-xl bg-[#F7F8FA] text-[13px] text-[#667085]">30-day chart loading…</div>}
        <div className="grid grid-cols-2 gap-3"><Field label="Alert me above"><Input inputMode="decimal" value={above} onChange={(e) => setAbove(e.target.value)} /></Field><Field label="Alert me below"><Input inputMode="decimal" value={below} onChange={(e) => setBelow(e.target.value)} /></Field></div>
        <p className="text-[12px] text-[#667085]">Source: {q.source}. Prices may be delayed and are for information only, not investment advice.</p>
      </div>
    </Modal>
  );
}

const KIND_TONE: Record<string, string> = { STOCK: "bg-[#EEF4FF] text-[#2E5BFF]", CRYPTO: "bg-[#FFF6ED] text-[#C4320A]", METAL: "bg-[#FEF7C3] text-[#854A0E]", FX: "bg-[#F0FDF9] text-[#107569]" };
const KIND_LABEL: Record<string, string> = { STOCK: "Stock / ETF", CRYPTO: "Crypto", METAL: "Precious metal", FX: "Currency" };

export default function Markets() {
  const [tab, setTab] = useState("ALL");
  const [halal, setHalal] = useState(false);
  const [open, setOpen] = useState<Q | null>(null);
  const { data, error, reload } = useApi<{ quotes: Q[]; note: string }>("/api/pay/markets", { refreshMs: 30_000 });
  const { data: wl, reload: reloadW } = useApi<{ watch: W[] }>("/api/pay/watchlist");
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return <Loading rows={8} />;
  const watched = new Set(wl?.watch.map((w) => w.symbol));
  const list = data.quotes.filter((q) => (tab === "ALL" || (tab === "WATCH" ? watched.has(q.symbol) : q.kind === tab)) && (!halal || q.halal));
  return (
    <div>
      <PageTitle title="Markets" sub="Live stocks, crypto, gold and currencies. Watch what matters and get an alert when a price moves." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={tab} onChange={setTab} tabs={[{ key: "ALL", label: "All" }, { key: "WATCH", label: "Watchlist", count: wl?.watch.length }, { key: "STOCK", label: "Stocks" }, { key: "CRYPTO", label: "Crypto" }, { key: "METAL", label: "Gold & silver" }, { key: "FX", label: "Currencies" }]} />
        <span className="flex-1" />
        <span className="flex items-center gap-2"><Moon className="h-4 w-4 text-[#1FAF6B]" /><Toggle checked={halal} onChange={setHalal} label="Halal only" /></span>
      </div>
      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[minmax(0,1fr)_120px_150px_110px] gap-4 border-b border-[#EEF0F4] bg-[#FAFBFC] px-5 py-2.5 sm:grid"><span className="pay-label">Asset</span><span className="pay-label">Type</span><span className="pay-label text-end">Price</span><span className="pay-label text-end">24h</span></div>
        <div className="divide-y divide-[#EEF0F4]">
        {list.map((q) => {
          const w = wl?.watch.find((x) => x.symbol === q.symbol);
          return (
          <button key={q.symbol} onClick={() => setOpen(q)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5 text-start transition hover:bg-[#FAFBFC] sm:grid-cols-[minmax(0,1fr)_120px_150px_110px]">
            <span className="flex min-w-0 items-center gap-3">
              <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-[11px] font-semibold", KIND_TONE[q.kind])}>{q.symbol.split("/")[0].slice(0, 4)}</span>
              <span className="min-w-0"><b className="flex items-center gap-1.5 truncate text-[14px] font-semibold">{q.name}{watched.has(q.symbol) && <Star className="h-3.5 w-3.5 shrink-0 fill-[#F5B60A] text-[#F5B60A]" />}{(w?.alertAbove || w?.alertBelow) && <Bell className="h-3.5 w-3.5 shrink-0 text-[#2E5BFF]" />}</b>
                <small className="flex items-center gap-1.5 text-[12.5px] text-[#667085]">{q.symbol}{q.halal && <span className="rounded-[5px] bg-[#ECFDF3] px-1.5 py-px text-[10.5px] font-semibold text-[#067647]">Halal</span>}</small></span>
            </span>
            <span className="hidden text-[13px] text-[#475467] sm:block">{KIND_LABEL[q.kind]}</span>
            <span className="pay-num hidden text-end text-[14px] font-semibold sm:block">{q.price == null ? <span className="font-sans text-[12.5px] font-normal text-[#98A2B3]">Updating…</span> : fmt(q.price, q.currency)}</span>
            <span className="text-end">
              <b className="pay-num block text-[14px] font-semibold sm:hidden">{fmt(q.price, q.currency)}</b>
              {q.changePct != null ? <span className={cx("pay-num inline-flex items-center gap-0.5 rounded-[6px] px-1.5 py-0.5 text-[12.5px] font-semibold", q.changePct >= 0 ? "bg-[#ECFDF3] text-[#067647]" : "bg-[#FEF3F2] text-[#B42318]")}>{q.changePct >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}{q.changePct >= 0 ? "+" : ""}{q.changePct.toFixed(2)}%</span> : <span className="text-[12.5px] text-[#98A2B3]">—</span>}
            </span>
          </button>
          );
        })}
        </div>
        {!list.length && <p className="p-10 text-center text-[13.5px] text-[#667085]">Nothing here yet. Tap any price to add it to your watchlist.</p>}
      </div>
      <p className="mt-3 text-[12px] text-[#667085]">{data.note} Halal flags follow common Shariah screens and are a guide only.</p>
      {open && <Detail q={open} w={wl?.watch.find((w) => w.symbol === open.symbol)} onClose={() => setOpen(null)} onSaved={reloadW} />}
    </div>
  );
}
