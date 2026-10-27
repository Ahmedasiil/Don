"use client";
import { useState } from "react";
import { Plane, Wifi, QrCode, Copy, Search } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/client/api";
import { date } from "@/lib/format";
import { Badge, Button, Empty, ErrorNote, Loading, Modal, cx, useToast } from "@/components/ui";
import { ConfirmMoney, money, readiness, type Overview, Status } from "../bits";

type Pkg = { id: string; title: string; data: string; days: number; priceCents: number; currency: string; operator: string; country: string; image?: string | null };
type Order = { id: string; title: string; dataLabel: string; days: number; country: string; priceCents: number; currency: string; status: string; qrcodeUrl: string | null; lpa: string | null; iccid: string | null; createdAt: string };

const POPULAR = [["EG", "Egypt", "🇪🇬"], ["US", "United States", "🇺🇸"], ["AE", "UAE", "🇦🇪"], ["SA", "Saudi Arabia", "🇸🇦"], ["TR", "Türkiye", "🇹🇷"], ["GB", "United Kingdom", "🇬🇧"], ["FR", "France", "🇫🇷"], ["MX", "Mexico", "🇲🇽"], ["JP", "Japan", "🇯🇵"], ["MA", "Morocco", "🇲🇦"], ["IT", "Italy", "🇮🇹"], ["ES", "Spain", "🇪🇸"]];

function Install({ o, onClose }: { o: Order; onClose: () => void }) {
  const toast = useToast();
  return (
    <Modal open onClose={onClose} title="Install your eSIM">
      <div className="space-y-4 text-center">
        {o.qrcodeUrl ? <img src={o.qrcodeUrl} alt="eSIM QR code" className="mx-auto h-56 w-56 rounded-[14px] border border-[#E7E9EF] p-2" /> : <p className="text-[#667085]">QR code is being prepared.</p>}
        <p className="text-[14px] text-[#667085]">On your phone: Settings, Mobile data, Add eSIM, then scan this code. Install before you travel; it starts when you land.</p>
        {o.lpa && <button onClick={() => { navigator.clipboard.writeText(o.lpa!); toast("Activation code copied", "ok"); }} className="mx-auto flex items-center gap-2 rounded-xl bg-[#F7F8FA] px-3 py-2 font-mono text-[12px]"><Copy className="h-3.5 w-3.5" />Copy manual code</button>}
      </div>
    </Modal>
  );
}

export function Esim() {
  const toast = useToast();
  const { data: o } = useApi<Overview>("/api/pay/overview");
  const [country, setCountry] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const { data, error } = useApi<{ packages: Pkg[]; currency: string }>(country ? `/api/pay/esim?country=${country}` : null);
  const { data: orders, reload } = useApi<{ orders: Order[] }>("/api/pay/esim/orders");
  const [buy, setBuy] = useState<Pkg | null>(null);
  const [show, setShow] = useState<Order | null>(null);
  if (!o) return <Loading rows={5} />;
  const code = q.trim().toUpperCase();
  return (
    <div>
      <p className="mb-5 text-[14px] text-[#667085]">Data in 200+ countries without roaming fees. Buy in seconds, scan a QR code, and you're online when you land.</p>
      {orders && orders.orders.length > 0 && <section className="mb-5"><h2 className="mb-2 font-display text-[16px] font-semibold text-[#0B1020]">Your eSIMs</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{orders.orders.map((x) => (
        <button key={x.id} onClick={() => x.status === "READY" && setShow(x)} className="card flex items-center gap-3 p-4 text-start"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#F2F4F7] text-[#2E5BFF]"><Wifi className="h-5 w-5" /></span><span className="min-w-0 flex-1"><b className="block truncate text-[14px]">{x.dataLabel} · {x.days} days · {x.country}</b><small className="text-[#667085]">{date(x.createdAt)}</small></span>{x.status === "READY" ? <QrCode className="h-5 w-5 text-[#2E5BFF]" /> : <Status status={x.status} />}</button>
      ))}</div></section>}
      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3"><h2 className="flex-1 font-display text-[16px] font-semibold text-[#0B1020]">Where are you going?</h2>
          <form onSubmit={(e) => { e.preventDefault(); if (/^[A-Z]{2}$/.test(code)) setCountry(code); }} className="flex h-10 items-center gap-2 rounded-xl border border-[#E7E9EF] px-3"><Search className="h-4 w-4 text-[#667085]" /><input value={q} onChange={(e) => setQ(e.target.value.toUpperCase())} placeholder="Country code, e.g. DE" maxLength={2} className="w-40 bg-transparent text-[14px] outline-none placeholder:normal-case" /></form></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">{POPULAR.map(([c, n, f]) => <button key={c} onClick={() => setCountry(c)} className={cx("flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[13.5px] font-semibold", country === c ? "border-[#0B1020] bg-[#0B1020] text-white" : "border-[#E7E9EF] hover:border-[#C9D4FF]")}><span className="text-lg">{f}</span>{n}</button>)}</div>
      </section>
      {country && <section className="mt-5">{error ? <ErrorNote error={error} /> : !data ? <Loading rows={3} /> : !data.packages.length ? <Empty icon={<Plane className="h-6 w-6" />} title="No plans for this country yet" /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.packages.slice(0, 18).map((p) => (
          <article key={p.id} className="card flex flex-col p-5">
            <div className="flex items-center gap-2">{p.image && <img src={p.image} alt="" className="h-8 w-12 rounded object-cover" />}<small className="text-[#667085]">{p.operator}</small></div>
            <div className="mt-3 font-display text-[26px] font-semibold text-[#0B1020]">{p.data}</div>
            <small className="text-[#667085]">{p.days} days</small>
            <div className="mt-4 flex items-center justify-between"><b className="text-[18px]">{money(p.priceCents, p.currency)}</b><Button variant="pri" size="sm" disabled={!!readiness(o)} onClick={() => setBuy(p)}>Buy</Button></div>
          </article>
        ))}</div>
      )}</section>}
      <ConfirmMoney open={!!buy} onClose={() => setBuy(null)} title="Buy eSIM" summary={buy && <><div className="flex justify-between"><span>Plan</span><b>{buy.data} · {buy.days} days</b></div><div className="flex justify-between"><span>Price</span><b>{money(buy.priceCents, buy.currency)}</b></div></>}
        onConfirm={async (pin) => { try { const r = await api<Order>("/api/pay/esim", { body: { country: buy!.country, packageId: buy!.id, pin } }); setBuy(null); reload(); setShow(r); } catch (e) { if (e instanceof ApiError) throw e; throw e; } }} />
      {show && <Install o={show} onClose={() => setShow(null)} />}
    </div>
  );
}
