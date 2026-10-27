"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { HandCoins, Receipt, Gift, Gauge, Plus, Send, CreditCard, Users, Plane, Sparkles, ArrowUpRight, ArrowDownLeft, LineChart, ShieldCheck, BadgeCheck, TrendingUp, TrendingDown, ChevronRight, Check, Circle } from "lucide-react";
import { useSession } from "@/components/session";
import { CardFace } from "./card-face";
import { api, useApi } from "@/lib/client/api";
import { ago } from "@/lib/format";
import { Button, ErrorNote, Input, Loading, Modal, cx, useToast } from "@/components/ui";
import { BigMoney, money, SetupBanner, type Overview, Status } from "./bits";

function Flag({ code }: { code: string }) {
  const f = code.toUpperCase().replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)));
  return <span className="absolute -bottom-0.5 -end-0.5 grid h-[18px] w-[18px] place-items-center rounded-full bg-white text-[11px] ring-2 ring-white">{f}</span>;
}

/** Balance over the last 30 days, rebuilt backwards from today's balance and the activity list. */
function balanceSeries(o: Overview) {
  const days = 30, now = Date.now(), pts: number[] = [];
  const moves = [...o.recent].sort((a, b) => +new Date(b.at) - +new Date(a.at));
  let bal = o.balanceCents, i = 0;
  for (let d = 0; d <= days; d++) {
    const edge = now - d * 86400_000;
    while (i < moves.length && +new Date(moves[i].at) > edge) bal -= moves[i++].amountCents;
    pts.unshift(Math.max(0, bal));
  }
  return pts;
}

function AreaChart({ values }: { values: number[] }) {
  const w = 600, h = 140, max = Math.max(...values, 1), min = Math.min(...values, 0);
  const x = (i: number) => (i / (values.length - 1)) * w;
  const y = (v: number) => h - 8 - ((v - min) / (max - min || 1)) * (h - 24);
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-[140px] w-full" aria-hidden>
      <defs><linearGradient id="bal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2E5BFF" stopOpacity=".18" /><stop offset="1" stopColor="#2E5BFF" stopOpacity="0" /></linearGradient></defs>
      {[0.25, 0.5, 0.75].map((g) => <line key={g} x1="0" x2={w} y1={h * g} y2={h * g} stroke="#EEF0F4" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />)}
      <path d={`${line} L${w},${h} L0,${h} Z`} fill="url(#bal)" />
      <path d={line} fill="none" stroke="#2E5BFF" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="4" fill="#2E5BFF" stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function TopUp({ open, onClose, currency }: { open: boolean; onClose: () => void; currency: string }) {
  const toast = useToast();
  const [amount, setAmount] = useState("100");
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title="Add money" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="pri" loading={busy} onClick={async () => { setBusy(true); try { const r = await api<{ url: string }>("/api/pay/topup", { body: { amountCents: Math.round(Number(amount) * 100), returnPath: "/app" } }); location.href = r.url; } catch (e: any) { toast(e.message, "err"); setBusy(false); } }}>Continue to secure payment</Button></>}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-[14px] border border-[#E7E9EF] px-4"><span className="font-display text-2xl text-[#667085]">{currency}</span><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} className="h-16 border-0 px-0 font-display text-3xl shadow-none" /></div>
        <div className="flex gap-2">{["50", "100", "250", "500"].map((a) => <button key={a} onClick={() => setAmount(a)} className={cx("flex-1 rounded-xl border py-2 text-[13.5px] font-semibold", amount === a ? "border-[#0B1020] bg-[#0B1020] text-white" : "border-[#E7E9EF]")}>{a}</button>)}</div>
        <p className="flex items-center gap-1.5 text-[12.5px] text-[#667085]"><ShieldCheck className="h-4 w-4 text-[#1FAF6B]" />Card details go straight to Stripe. oenodpay never sees them.</p>
      </div>
    </Modal>
  );
}

export default function PayHome() {
  const sp = useSearchParams();
  const toast = useToast();
  const s = useSession();
  const [topup, setTopup] = useState(false);
  const { data: o, error, reload } = useApi<Overview>("/api/pay/overview", { refreshMs: 30_000 });
  useEffect(() => { if (sp.get("topup") === "done") toast("Payment received. Your balance updates in a few seconds.", "ok"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!o) return <Loading rows={6} />;
  const series = balanceSeries(o);
  const change = series[series.length - 1] - series[0];
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const card = o.cards.find((c) => c.status === "ACTIVE") ?? o.cards[0];
  const actions = [
    { label: "Add money", icon: Plus, onClick: () => setTopup(true) },
    { label: "Send", icon: Send, href: "/app/send" },
    { label: "Request", icon: HandCoins, href: "/app/request" },
    { label: "Bills", icon: Receipt, href: "/app/bills" },
    { label: "Invest", icon: LineChart, href: "/app/invest" },
    { label: "Travel", icon: Plane, href: "/app/travel" },
    { label: "Rewards", icon: Gift, href: "/app/rewards" },
    { label: "Credit", icon: Gauge, href: "/app/credit" },
  ];
  const shields = [
    { ok: o.profile.twoStep, label: "Two-step sign-in" },
    { ok: o.profile.kycStatus === "VERIFIED", label: "Identity verified" },
    { ok: o.profile.pinSet, label: "Payment PIN" },
    { ok: true, label: "Sanctions screening" },
    { ok: true, label: "AES-256 encryption" },
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="pay-label">{new Date().toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })}</div>
          <h1 className="mt-2 font-display text-[26px] font-semibold tracking-[-.025em] sm:text-[30px]">{hello}, {s.user.name.split(" ")[0]}</h1>
        </div>
        <div className="flex gap-2"><button className="btn" onClick={() => setTopup(true)}><Plus className="h-4 w-4" />Add money</button><Link href="/app/send" className="btn-pri"><Send className="h-4 w-4" />Send money</Link></div>
      </div>
      <SetupBanner o={o} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <section className="card flex flex-col overflow-hidden">
          <div className="p-6 pb-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><span className="pay-label">Total balance</span><span className="rounded-md bg-[#F2F4F7] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#475467]">{o.currency}</span></div>
              {o.profile.kycStatus === "VERIFIED" && <span className="flex items-center gap-1 text-[12px] font-medium text-[#0E7A4F]"><BadgeCheck className="h-4 w-4" />Verified account</span>}
            </div>
            <BigMoney cents={o.availableCents} currency={o.currency} className="mt-3 block text-[44px] font-semibold leading-none sm:text-[54px]" />
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[#667085]">
              <span className={cx("inline-flex items-center gap-1 font-semibold", change >= 0 ? "text-[#0E7A4F]" : "text-[#B42318]")}>{change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}{change >= 0 ? "+" : ""}{money(change, o.currency)}</span>
              <span>last 30 days</span>
              {o.balanceCents !== o.availableCents && <span>· {money(o.balanceCents - o.availableCents, o.currency)} held for review</span>}
            </div>
          </div>
          <div className="flex min-h-[140px] flex-1 flex-col justify-end px-2"><AreaChart values={series} /></div>
          <div className="grid grid-cols-4 border-t border-[#EEF0F4] sm:grid-cols-8">
            {actions.map((a, i) => {
              const inner = <><span className="grid h-10 w-10 place-items-center rounded-full bg-[#F2F4F7] text-[#0B1020] transition group-hover:bg-[#0B1020] group-hover:text-white"><a.icon className="h-[18px] w-[18px]" strokeWidth={1.9} /></span><span className="text-[12px] font-medium text-[#344054]">{a.label}</span></>;
              const cls = cx("group flex flex-col items-center gap-2 py-4 transition hover:bg-[#FAFBFC] border-[#EEF0F4]", i % 4 && "border-s", i >= 4 && "border-t sm:border-t-0", i === 4 && "sm:border-s");
              return a.href ? <Link key={a.label} href={a.href} className={cls}>{inner}</Link> : <button key={a.label} onClick={a.onClick} className={cls}>{inner}</button>;
            })}
          </div>
        </section>

        <div className="grid gap-6">
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between"><span className="pay-label">Your card</span><Link href="/app/cards" className="flex items-center gap-0.5 text-[12.5px] font-semibold text-[#344054] hover:text-[#0B1020]">Manage<ChevronRight className="h-4 w-4" /></Link></div>
            {card ? <CardFace c={card} name={s.user.name} /> : (
              <Link href="/app/cards" className="grid aspect-[1.586] w-full place-items-center rounded-[20px] border border-dashed border-[#D0D5DD] text-center text-[13px] text-[#667085] hover:bg-[#FAFBFC]"><span><CreditCard className="mx-auto mb-2 h-6 w-6" />Get your oenodpay card</span></Link>
            )}
          </section>
          <Link href="/app/coach" className="card group p-5 transition hover:border-[#CDD2DC]">
            <div className="flex items-center justify-between"><span className="pay-label">Financial health</span><span className="flex items-center gap-1 text-[12.5px] font-semibold text-[#2E5BFF]"><Sparkles className="h-3.5 w-3.5" />Ask Oeno</span></div>
            <div className="mt-3 flex items-baseline gap-1"><span className="pay-num text-[36px] font-semibold leading-none">{o.health.score}</span><span className="text-[14px] text-[#98A2B3]">/100</span><span className="ms-auto text-[13px] font-medium text-[#344054]">{o.health.score >= 70 ? "Strong" : o.health.score >= 45 ? "Fair" : "Needs work"}</span></div>
            <div className="mt-3 grid grid-cols-4 gap-1.5">{Object.entries(o.health.parts).map(([k, v]) => <span key={k} title={k} className="h-1.5 overflow-hidden rounded-full bg-[#EEF0F4]"><i className="block h-full rounded-full" style={{ width: `${v}%`, background: v >= 70 ? "#12B76A" : v >= 45 ? "#F79009" : "#F04438" }} /></span>)}</div>
            <p className="mt-3 text-[12.5px] text-[#667085]">{o.health.bufferMonths} months of spending set aside.</p>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 pb-3 pt-5"><h2 className="pay-h">Recent transfers</h2><Link href="/app/activity" className="flex items-center gap-0.5 text-[12.5px] font-semibold text-[#344054] hover:text-[#0B1020]">View all<ChevronRight className="h-4 w-4" /></Link></div>
          {!o.transfers.length ? <p className="px-5 pb-8 pt-4 text-center text-[13.5px] text-[#667085]">Send to bank accounts, mobile wallets, InstaPay and cash pickup in 14+ countries.</p> : (
            <ul className="divide-y divide-[#EEF0F4] border-t border-[#EEF0F4]">{o.transfers.map((t) => (
              <li key={t.id} className="pay-row">
                <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F2F4F7] font-display text-[12.5px] font-semibold text-[#344054]">{t.recipient.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}<Flag code={t.recipient.country} /></span>
                <div className="min-w-0 flex-1"><b className="block truncate text-[13.5px] font-semibold">{t.recipient.name}</b><small className="block truncate text-[12.5px] text-[#667085]">{t.recipient.label ?? t.recipient.country} · {ago(t.createdAt)}</small></div>
                <div className="hidden w-28 sm:block"><Status status={t.status} /></div>
                <div className="text-end"><b className="pay-num block text-[14px] font-semibold">−{money(t.sendCents, t.sendCurrency)}</b><small className="pay-num text-[12px] text-[#667085]">{money(t.receiveCents, t.receiveCurrency)}</small></div>
              </li>
            ))}</ul>
          )}
        </section>
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 pb-3 pt-5"><h2 className="pay-h">Activity</h2><Link href="/app/markets" className="flex items-center gap-1 text-[12.5px] font-semibold text-[#344054] hover:text-[#0B1020]"><LineChart className="h-4 w-4" />Markets</Link></div>
          {!o.recent.length ? <p className="px-5 pb-8 pt-4 text-center text-[13.5px] text-[#667085]">Your payments, top-ups and card spending will show here.</p> : (
            <ul className="divide-y divide-[#EEF0F4] border-t border-[#EEF0F4]">{o.recent.slice(0, 6).map((a) => (
              <li key={a.id} className="pay-row">
                <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-full", a.amountCents >= 0 ? "bg-[#ECFDF3] text-[#0E7A4F]" : "bg-[#F2F4F7] text-[#344054]")}>{a.amountCents >= 0 ? <ArrowDownLeft className="h-[18px] w-[18px]" /> : <ArrowUpRight className="h-[18px] w-[18px]" />}</span>
                <div className="min-w-0 flex-1"><b className="block truncate text-[13.5px] font-semibold first-letter:uppercase">{a.memo ?? a.kind.toLowerCase()}</b><small className="text-[12.5px] text-[#667085]">{ago(a.at)}</small></div>
                <b className={cx("pay-num text-[14px] font-semibold", a.amountCents >= 0 && "text-[#0E7A4F]")}>{a.amountCents >= 0 ? "+" : ""}{money(a.amountCents, a.currency)}</b>
              </li>
            ))}</ul>
          )}
        </section>
      </div>

      <section className="card flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
        <span className="flex items-center gap-2 text-[13px] font-semibold"><ShieldCheck className="h-[18px] w-[18px] text-[#0E7A4F]" />Your protection</span>
        {shields.map((x) => <span key={x.label} className={cx("flex items-center gap-1.5 text-[12.5px]", x.ok ? "text-[#344054]" : "text-[#98A2B3]")}>{x.ok ? <Check className="h-3.5 w-3.5 text-[#12B76A]" strokeWidth={3} /> : <Circle className="h-3.5 w-3.5" />}{x.label}</span>)}
        <Link href="/app/security" className="ms-auto text-[12.5px] font-semibold text-[#344054] hover:text-[#0B1020]">Security settings</Link>
      </section>
      <TopUp open={topup} onClose={() => setTopup(false)} currency={o.currency} />
    </div>
  );
}
