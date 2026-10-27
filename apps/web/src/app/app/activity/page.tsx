"use client";
import { useState } from "react";
import { Download, Search, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useApi } from "@/lib/client/api";
import { dateTime } from "@/lib/format";
import { ErrorNote, Input, Loading, Tabs, cx } from "@/components/ui";
import { money, PageTitle } from "../bits";

type R = { rows: { id: string; kind: string; memo: string | null; at: string; amountCents: number; currency: string }[]; inCents: number; outCents: number; currency: string };
const TYPES = [{ key: "", label: "All" }, { key: "in", label: "Money in" }, { key: "transfers", label: "Transfers" }, { key: "cards", label: "Card" }, { key: "bills", label: "Bills" }, { key: "invest", label: "Investing" }, { key: "travel", label: "Travel" }, { key: "loans", label: "Loans" }];
const KIND: Record<string, string> = { TOPUP: "Added money", TRANSFER: "Transfer", REVERSAL: "Returned", CARD: "Card", CARD_REFUND: "Card refund", BILL: "Bill payment", BILL_REFUND: "Bill refund", INVEST_BUY: "Bought", INVEST_SELL: "Sold", INVEST_REFUND: "Order returned", TRAVEL: "Travel", TRAVEL_REFUND: "Travel refund", ESIM: "eSIM", ESIM_REFUND: "eSIM refund", LOAN_OUT: "Loan", LOAN_PAYMENT: "Loan payment", REWARD: "Rewards", REQUEST_IN: "Request paid to you", REQUEST_OUT: "You paid a request", ADJUSTMENT: "Adjustment" };
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function Activity() {
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState(iso(new Date(Date.now() - 90 * 86400_000)));
  const [to, setTo] = useState(iso(new Date()));
  const qs = new URLSearchParams({ type, q, from, to }).toString();
  const { data, error, reload } = useApi<R>(`/api/pay/activity?${qs}`);
  return (
    <div>
      <PageTitle title="Activity and statements" sub="Every movement on your wallet. Download a statement for any dates you need." action={<a href={`/api/pay/activity?${qs}&format=csv`} className="btn"><Download className="h-4 w-4" />Download statement (CSV)</a>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={type} onChange={setType} tabs={TYPES} />
        <span className="flex-1" />
        <label className="flex h-10 items-center gap-2 rounded-xl border border-[#E7E9EF] bg-white px-3"><Search className="h-4 w-4 text-[#667085]" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="w-36 bg-transparent text-[14px] outline-none" /></label>
        <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-10 w-auto" aria-label="From" />
        <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-10 w-auto" aria-label="To" />
      </div>
      {error ? <ErrorNote error={error} onRetry={reload} /> : !data ? <Loading rows={8} /> : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
            <div className="card p-4"><span className="pay-label">Money in</span><b className="pay-num mt-1 block text-[20px] text-[#067647]">+{money(data.inCents, data.currency)}</b></div>
            <div className="card p-4"><span className="pay-label">Money out</span><b className="pay-num mt-1 block text-[20px]">−{money(data.outCents, data.currency)}</b></div>
          </div>
          <div className="card divide-y divide-[#EEF0F4]">
            {data.rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-5 py-3.5">
                <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-full", r.amountCents > 0 ? "bg-[#ECFDF3] text-[#067647]" : "bg-[#F2F4F7] text-[#344054]")}>{r.amountCents > 0 ? <ArrowDownLeft className="h-[18px] w-[18px]" /> : <ArrowUpRight className="h-[18px] w-[18px]" />}</span>
                <span className="min-w-0 flex-1"><b className="block truncate text-[14px] font-semibold">{r.memo ?? KIND[r.kind] ?? r.kind}</b><small className="text-[12.5px] text-[#667085]">{KIND[r.kind] ?? r.kind} · {dateTime(r.at)}</small></span>
                <b className={cx("pay-num text-[14.5px]", r.amountCents > 0 && "text-[#067647]")}>{r.amountCents > 0 ? "+" : "−"}{money(Math.abs(r.amountCents), r.currency)}</b>
              </div>
            ))}
            {!data.rows.length && <p className="p-10 text-center text-[13.5px] text-[#667085]">Nothing in these dates.</p>}
          </div>
        </>
      )}
    </div>
  );
}
