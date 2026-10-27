"use client";
import { useEffect, useRef, useState } from "react";
import { Plane, BedDouble, Wifi, Sparkles, Send, ArrowRight, RotateCcw, Star, Luggage, MapPin } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { date, dateTime } from "@/lib/format";
import { Button, Empty, ErrorNote, Field, Input, Loading, Modal, Select, Tabs, cx, useToast } from "@/components/ui";
import { money, newKey, PageTitle, PayConfirm, readiness, Row, SetupBanner, Status, type Overview } from "../bits";
import { Esim } from "./esim";

type Price = { totalCents: number; feeCents: number; currency: string };
type Flight = { id: string; airline: string; logo: string | null; expiresAt: string; passengers: number; price: Price; refundable: boolean; changeable: boolean; slices: { from: string; fromCity: string | null; to: string; toCity: string | null; duration: string | null; stops: number; departAt: string; arriveAt: string; flights: string[] }[] };
type Stay = { id: string; name: string; rating: number | null; reviewScore: number | null; photo: string | null; address: string; price: Price };
type Booking = { id: string; kind: string; title: string; status: string; reference: string | null; amountCents: number; currency: string; createdAt: string; failureReason: string | null; details: any };
type Place = { id: string; name: string; type: string; iata: string | null; city: string | null; country: string };
type Msg = { role: "user" | "assistant"; content: string };
type Tab = "ai" | "flights" | "stays" | "esim" | "trips";

const day = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);
const hm = (s: string) => new Date(s).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });

function PlaceBox({ label, value, onChange }: { label: string; value: string; onChange: (iata: string) => void }) {
  const [q, setQ] = useState(value);
  const [opts, setOpts] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (q.length < 2 || q === value) { setOpts([]); return; } const t = setTimeout(() => api<{ places: Place[] }>(`/api/pay/travel?q=${encodeURIComponent(q)}`).then((r) => setOpts(r.places)).catch(() => {}), 250); return () => clearTimeout(t); }, [q, value]);
  return (
    <Field label={label} className="relative">
      <Input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder="City or airport" />
      {open && opts.length > 0 && <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-xl border border-[#E7E9EF] bg-white shadow-lg">{opts.filter((p) => p.iata).map((p) => (
        <button key={p.id} type="button" onMouseDown={() => { onChange(p.iata!); setQ(`${p.city ?? p.name} (${p.iata})`); setOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-start text-[13.5px] hover:bg-[#F7F8FA]">{p.type === "airport" ? <Plane className="h-4 w-4 text-[#667085]" /> : <MapPin className="h-4 w-4 text-[#667085]" />}<span className="flex-1 truncate">{p.name}</span><b className="font-mono text-[12px]">{p.iata}</b></button>
      ))}</div>}
    </Field>
  );
}

function FlightCard({ f, onBook, disabled }: { f: Flight; onBook: () => void; disabled?: boolean }) {
  return (
    <article className="card p-4">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex w-40 items-center gap-2">{f.logo ? <img src={f.logo} alt="" className="h-7 w-7" /> : <Plane className="h-6 w-6" />}<b className="truncate text-[13.5px]">{f.airline}</b></span>
        <div className="min-w-0 flex-1 space-y-2">{f.slices.map((s, i) => (
          <div key={i} className="flex items-center gap-3 text-[14px]">
            <span className="text-end"><b className="pay-num block">{hm(s.departAt)}</b><small className="text-[#667085]">{s.from}</small></span>
            <span className="flex flex-1 flex-col items-center text-[11.5px] text-[#667085]"><span>{s.duration}</span><span className="relative my-0.5 h-px w-full bg-[#D0D5DD]"><i className="absolute -top-[3px] end-0 h-[7px] w-[7px] rounded-full bg-[#D0D5DD]" /></span><span>{s.stops ? `${s.stops} stop${s.stops > 1 ? "s" : ""}` : "Direct"}</span></span>
            <span><b className="pay-num block">{hm(s.arriveAt)}</b><small className="text-[#667085]">{s.to}</small></span>
          </div>
        ))}</div>
        <div className="text-end"><b className="pay-num block text-[20px]">{money(f.price.totalCents, f.price.currency)}</b><small className="text-[12px] text-[#667085]">{f.passengers > 1 ? `${f.passengers} travellers · ` : ""}{f.refundable ? "Refundable" : "Non-refundable"}</small><Button variant="pri" size="sm" className="mt-2" disabled={disabled} onClick={onBook}>Book</Button></div>
      </div>
    </article>
  );
}

function StayCard({ s, onPick }: { s: Stay; onPick: () => void }) {
  return (
    <article className="card overflow-hidden">
      {s.photo ? <img src={s.photo} alt="" className="h-40 w-full object-cover" /> : <div className="grid h-40 place-items-center bg-[#F2F4F7]"><BedDouble className="h-8 w-8 text-[#98A2B3]" /></div>}
      <div className="p-4">
        <b className="block truncate text-[15px]">{s.name}</b>
        <small className="flex items-center gap-1 text-[12.5px] text-[#667085]">{s.rating ? <>{Array.from({ length: s.rating }, (_, i) => <Star key={i} className="h-3 w-3 fill-[#F5B60A] text-[#F5B60A]" />)}<span className="ms-1" /></> : null}{s.reviewScore ? `${s.reviewScore}/10 · ` : ""}<span className="truncate">{s.address}</span></small>
        <div className="mt-3 flex items-center justify-between"><span><small className="block text-[11.5px] text-[#667085]">Total from</small><b className="pay-num text-[18px]">{money(s.price.totalCents, s.price.currency)}</b></span><Button size="sm" variant="pri" onClick={onPick}>See rooms</Button></div>
      </div>
    </article>
  );
}

function BookFlight({ f, onClose, onDone, email }: { f: Flight; onClose: () => void; onDone: () => void; email: string }) {
  const toast = useToast();
  const blank = { title: "mr", given_name: "", family_name: "", born_on: "", gender: "m", email, phone_number: "" };
  const [t, setT] = useState(() => Array.from({ length: f.passengers }, (_, i) => ({ ...blank, email: i ? "" : email })));
  const [confirm, setConfirm] = useState(false);
  const [key] = useState(newKey);
  const ok = t.every((x) => x.given_name && x.family_name && x.born_on && /^\+\d{7,15}$/.test(x.phone_number) && /@/.test(x.email));
  const set = (i: number, k: string, v: string) => setT((a) => a.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <>
      <Modal wide open={!confirm} onClose={onClose} title="Who's flying?" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="pri" disabled={!ok} onClick={() => setConfirm(true)}>Review and pay</Button></>}>
        <p className="mb-4 text-[13px] text-[#667085]">Names exactly as on each passport.</p>
        <div className="space-y-5">{t.map((x, i) => (
          <fieldset key={i} className="grid gap-3 rounded-[14px] border border-[#EEF0F4] p-4 sm:grid-cols-6">
            <legend className="px-1 text-[12.5px] font-semibold">Traveller {i + 1}</legend>
            <Field label="Title" className="sm:col-span-1"><Select value={x.title} onChange={(e) => set(i, "title", e.target.value)} options={[{ value: "mr", label: "Mr" }, { value: "ms", label: "Ms" }, { value: "mrs", label: "Mrs" }, { value: "miss", label: "Miss" }, { value: "dr", label: "Dr" }]} /></Field>
            <Field label="Given names" className="sm:col-span-2"><Input value={x.given_name} onChange={(e) => set(i, "given_name", e.target.value)} /></Field>
            <Field label="Family name" className="sm:col-span-3"><Input value={x.family_name} onChange={(e) => set(i, "family_name", e.target.value)} /></Field>
            <Field label="Date of birth" className="sm:col-span-2"><Input type="date" value={x.born_on} onChange={(e) => set(i, "born_on", e.target.value)} /></Field>
            <Field label="Gender on passport" className="sm:col-span-1"><Select value={x.gender} onChange={(e) => set(i, "gender", e.target.value)} options={[{ value: "m", label: "M" }, { value: "f", label: "F" }]} /></Field>
            <Field label="Email" className="sm:col-span-3"><Input type="email" value={x.email} onChange={(e) => set(i, "email", e.target.value)} /></Field>
            <Field label="Mobile" className="sm:col-span-3"><Input type="tel" value={x.phone_number} onChange={(e) => set(i, "phone_number", e.target.value.replace(/[^\d+]/g, ""))} placeholder="+14165551234" /></Field>
          </fieldset>
        ))}</div>
      </Modal>
      <PayConfirm open={confirm} onClose={() => setConfirm(false)} title="Pay for your flight" summary={<><Row k="Airline" v={f.airline} /><Row k="Route" v={f.slices.map((s) => `${s.from} → ${s.to}`).join(", ")} /><Row k="Departs" v={dateTime(f.slices[0].departAt)} /><Row k="Includes service fee" v={money(f.price.feeCents, f.price.currency)} /><Row k="Total from wallet" v={money(f.price.totalCents, f.price.currency)} /></>}
        run={async (pin, code) => { const b = await api<Booking>("/api/pay/travel/book", { body: { kind: "FLIGHT", offerId: f.id, travellers: t, pin, code, idempotencyKey: key } }); toast(`Booked. Reference ${b.reference}`, "ok"); onDone(); onClose(); }} />
    </>
  );
}

function BookStay({ s, q, onClose, onDone, name }: { s: Stay; q: { checkIn: string; checkOut: string }; onClose: () => void; onDone: () => void; name: string }) {
  const toast = useToast();
  const { data, error } = useApi<{ name: string; rooms: { name: string; rates: { id: string; board: string; refundable: boolean; price: Price }[] }[] }>(`/api/pay/travel/stays/${s.id}`);
  const [rate, setRate] = useState<{ id: string; label: string; price: Price } | null>(null);
  const [guest, setGuest] = useState({ given_name: name.split(" ")[0] ?? "", family_name: name.split(" ").slice(1).join(" ") });
  const [phone, setPhone] = useState("");
  const [key] = useState(newKey);
  return (
    <>
      <Modal wide open={!rate} onClose={onClose} title={s.name}>
        {error ? <ErrorNote error={error} /> : !data ? <Loading rows={3} /> : <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3"><Field label="Guest given name"><Input value={guest.given_name} onChange={(e) => setGuest({ ...guest, given_name: e.target.value })} /></Field><Field label="Family name"><Input value={guest.family_name} onChange={(e) => setGuest({ ...guest, family_name: e.target.value })} /></Field><Field label="Mobile"><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))} placeholder="+14165551234" /></Field></div>
          {data.rooms.map((r) => <div key={r.name} className="rounded-[14px] border border-[#EEF0F4] p-4"><b className="text-[14px]">{r.name}</b><div className="mt-2 divide-y divide-[#EEF0F4]">{r.rates.map((x) => (
            <div key={x.id} className="flex items-center gap-3 py-2 text-[13.5px]"><span className="flex-1">{x.board.replace(/_/g, " ").toLowerCase()} · {x.refundable ? "Free cancellation" : "Non-refundable"}</span><b className="pay-num">{money(x.price.totalCents, x.price.currency)}</b><Button size="sm" variant="pri" disabled={!guest.given_name || !guest.family_name || !/^\+\d{7,15}$/.test(phone)} onClick={() => setRate({ id: x.id, label: r.name, price: x.price })}>Choose</Button></div>
          ))}</div></div>)}
        </div>}
      </Modal>
      <PayConfirm open={!!rate} onClose={() => setRate(null)} title="Pay for your stay" summary={rate && <><Row k="Hotel" v={s.name} /><Row k="Room" v={rate.label} /><Row k="Dates" v={`${date(q.checkIn)} to ${date(q.checkOut)}`} /><Row k="Includes service fee" v={money(rate.price.feeCents, rate.price.currency)} /><Row k="Total from wallet" v={money(rate.price.totalCents, rate.price.currency)} /></>}
        run={async (pin, code) => { const b = await api<Booking>("/api/pay/travel/book", { body: { kind: "STAY", rateId: rate!.id, hotel: s.name, checkIn: q.checkIn, checkOut: q.checkOut, guest, phone, pin, code, idempotencyKey: key } }); toast(`Booked. Confirmation ${b.reference}`, "ok"); onDone(); onClose(); }} />
    </>
  );
}

function Agent({ o, onBookFlight, onPickStay, initial }: { o: Overview; onBookFlight: (f: Flight) => void; onPickStay: (s: Stay, q: { checkIn: string; checkOut: string }) => void; initial: Msg[] }) {
  const toast = useToast();
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [found, setFound] = useState<{ flights?: Flight[]; stays?: { results: Stay[] }; search?: any }>({});
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [msgs, busy]);
  const send = async (m: string) => {
    if (!m.trim()) return;
    setMsgs((x) => [...x, { role: "user", content: m }]); setText(""); setBusy(true);
    try { const r = await api<{ reply: string; flights?: Flight[]; stays?: { results: Stay[] }; search?: any }>("/api/pay/travel/chat", { body: { message: m } }); setMsgs((x) => [...x, { role: "assistant", content: r.reply }]); if (r.flights || r.stays) setFound(r); }
    catch (e: any) { toast(e.message, "err"); setMsgs((x) => x.slice(0, -1)); setText(m); } finally { setBusy(false); }
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="card flex h-[560px] flex-col">
        <div className="flex items-center gap-2 border-b border-[#EEF0F4] px-5 py-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#4C6BFF] to-[#1B2A8A] text-white"><Sparkles className="h-4 w-4" /></span><b className="flex-1 text-[14px]">Your travel agent</b><button onClick={async () => { await api("/api/pay/travel", { method: "DELETE" }); setMsgs([]); setFound({}); }} className="flex items-center gap-1 text-[12.5px] font-semibold text-[#667085] hover:text-[#0B1020]"><RotateCcw className="h-3.5 w-3.5" />New trip</button></div>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {!msgs.length && <div className="space-y-2"><p className="text-[14px] text-[#475467]">Tell me where and when. I'll find real flights and hotels, compare them, and you book with one tap.</p>{["Toronto to Cairo in March, 2 weeks, cheapest", "Weekend in New York next month, hotel near Central Park", "Business class Vancouver to Dubai on the 10th"].map((s) => <button key={s} onClick={() => send(s)} className="block w-full rounded-xl border border-[#E7E9EF] px-3 py-2 text-start text-[13.5px] hover:border-[#C9D4FF]">{s}</button>)}</div>}
          {msgs.map((m, i) => <div key={i} className={cx("max-w-[85%] whitespace-pre-wrap rounded-[16px] px-4 py-2.5 text-[14px] leading-relaxed", m.role === "user" ? "ms-auto bg-[#0B1020] text-white" : "bg-[#F2F4F7] text-[#0B1020]")}>{m.content}</div>)}
          {busy && <div className="w-fit rounded-[16px] bg-[#F2F4F7] px-4 py-2.5 text-[13.5px] text-[#667085]">Searching live fares…</div>}
          <div ref={end} />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex gap-2 border-t border-[#EEF0F4] p-3"><Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Where to?" maxLength={1000} disabled={busy} /><Button variant="pri" type="submit" disabled={busy || !text.trim()} aria-label="Send"><Send className="h-4 w-4" /></Button></form>
      </section>
      <section className="space-y-3">
        {found.flights?.slice(0, 6).map((f) => <FlightCard key={f.id} f={f} disabled={!!readiness(o)} onBook={() => onBookFlight(f)} />)}
        {found.stays && <div className="grid gap-3 sm:grid-cols-2">{found.stays.results.slice(0, 6).map((s) => <StayCard key={s.id} s={s} onPick={() => onPickStay(s, { checkIn: found.search.checkIn, checkOut: found.search.checkOut })} />)}</div>}
        {!found.flights && !found.stays && <Empty icon={<Luggage className="h-6 w-6" />} title="Options show up here" body="Live prices in your wallet currency, fees included. The agent never books or pays; you always confirm with your PIN." />}
      </section>
    </div>
  );
}

export default function Travel() {
  const { data: o } = useApi<Overview>("/api/pay/overview");
  const { data: me } = useApi<{ email: string; name: string }>("/api/pay/profile");
  const { data: mine, reload } = useApi<{ bookings: Booking[]; messages: Msg[] }>("/api/pay/travel");
  const [tab, setTab] = useState<Tab>("ai");
  const [fq, setFq] = useState({ from: "", to: "", depart: day(21), back: day(28), adults: 1, cabin: "economy", round: true });
  const [sq, setSq] = useState({ place: "", checkIn: day(21), checkOut: day(24), adults: 2 });
  const [flights, setFlights] = useState<Flight[] | null>(null);
  const [stays, setStays] = useState<Stay[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [bookF, setBookF] = useState<Flight | null>(null);
  const [bookS, setBookS] = useState<{ s: Stay; q: { checkIn: string; checkOut: string } } | null>(null);
  if (!o || !mine) return <Loading rows={5} />;
  const search = async (fn: () => Promise<void>) => { setBusy(true); setErr(null); try { await fn(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } };
  return (
    <div>
      <PageTitle title="Travel" sub="Flights, hotels and data abroad, paid from your wallet. Or just tell the AI travel agent what you want." />
      {readiness(o) && <div className="mb-5"><SetupBanner o={o} /></div>}
      <div className="mb-5"><Tabs value={tab} onChange={setTab} tabs={[{ key: "ai", label: "AI agent" }, { key: "flights", label: "Flights" }, { key: "stays", label: "Hotels" }, { key: "esim", label: "eSIM" }, { key: "trips", label: "My trips", count: mine.bookings.filter((b) => b.status === "CONFIRMED").length || undefined }]} /></div>
      {tab === "ai" && <Agent o={o} initial={mine.messages} onBookFlight={setBookF} onPickStay={(s, q) => setBookS({ s, q })} />}
      {tab === "flights" && <>
        <form onSubmit={(e) => { e.preventDefault(); search(async () => setFlights((await api<{ offers: Flight[] }>("/api/pay/travel/flights", { body: { from: fq.from, to: fq.to, depart: fq.depart, back: fq.round ? fq.back : undefined, adults: fq.adults, cabin: fq.cabin } })).offers)); }} className="card grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_160px_160px_110px_150px_auto] lg:items-end">
          <PlaceBox label="From" value={fq.from} onChange={(v) => setFq({ ...fq, from: v })} />
          <PlaceBox label="To" value={fq.to} onChange={(v) => setFq({ ...fq, to: v })} />
          <Field label="Depart"><Input type="date" min={day(1)} value={fq.depart} onChange={(e) => setFq({ ...fq, depart: e.target.value })} /></Field>
          <Field label={<label className="flex items-center gap-2"><input type="checkbox" checked={fq.round} onChange={(e) => setFq({ ...fq, round: e.target.checked })} />Return</label>}><Input type="date" disabled={!fq.round} min={fq.depart} value={fq.back} onChange={(e) => setFq({ ...fq, back: e.target.value })} /></Field>
          <Field label="Travellers"><Select value={String(fq.adults)} onChange={(e) => setFq({ ...fq, adults: Number(e.target.value) })} options={["1", "2", "3", "4", "5", "6"]} /></Field>
          <Field label="Cabin"><Select value={fq.cabin} onChange={(e) => setFq({ ...fq, cabin: e.target.value })} options={[{ value: "economy", label: "Economy" }, { value: "premium_economy", label: "Premium" }, { value: "business", label: "Business" }, { value: "first", label: "First" }]} /></Field>
          <Button variant="pri" type="submit" loading={busy} disabled={fq.from.length !== 3 || fq.to.length !== 3} className="h-11">Search<ArrowRight className="h-4 w-4" /></Button>
        </form>
        {err && <div className="mt-4"><ErrorNote error={{ message: err }} /></div>}
        <div className="mt-5 space-y-3">{flights?.map((f) => <FlightCard key={f.id} f={f} disabled={!!readiness(o)} onBook={() => setBookF(f)} />)}{flights && !flights.length && <Empty icon={<Plane className="h-6 w-6" />} title="No flights for those dates" body="Try nearby dates or airports." />}</div>
      </>}
      {tab === "stays" && <>
        <form onSubmit={(e) => { e.preventDefault(); search(async () => setStays((await api<{ results: Stay[] }>("/api/pay/travel/stays", { body: sq })).results)); }} className="card grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-[1.5fr_160px_160px_110px_auto] lg:items-end">
          <Field label="Where"><Input value={sq.place} onChange={(e) => setSq({ ...sq, place: e.target.value })} placeholder="City, e.g. Cairo" /></Field>
          <Field label="Check in"><Input type="date" min={day(0)} value={sq.checkIn} onChange={(e) => setSq({ ...sq, checkIn: e.target.value })} /></Field>
          <Field label="Check out"><Input type="date" min={sq.checkIn} value={sq.checkOut} onChange={(e) => setSq({ ...sq, checkOut: e.target.value })} /></Field>
          <Field label="Guests"><Select value={String(sq.adults)} onChange={(e) => setSq({ ...sq, adults: Number(e.target.value) })} options={["1", "2", "3", "4"]} /></Field>
          <Button variant="pri" type="submit" loading={busy} disabled={sq.place.length < 2} className="h-11">Search<ArrowRight className="h-4 w-4" /></Button>
        </form>
        {err && <div className="mt-4"><ErrorNote error={{ message: err }} /></div>}
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{stays?.map((s) => <StayCard key={s.id} s={s} onPick={() => setBookS({ s, q: { checkIn: sq.checkIn, checkOut: sq.checkOut } })} />)}</div>
        {stays && !stays.length && <Empty icon={<BedDouble className="h-6 w-6" />} title="No hotels found" body="Try another city or dates." />}
      </>}
      {tab === "esim" && <Esim />}
      {tab === "trips" && (!mine.bookings.length ? <Empty icon={<Luggage className="h-6 w-6" />} title="No trips yet" body="Flights and hotels you book show up here." /> : (
        <div className="card divide-y divide-[#EEF0F4]">{mine.bookings.map((b) => (
          <div key={b.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#F2F4F7]">{b.kind === "FLIGHT" ? <Plane className="h-[18px] w-[18px]" /> : <BedDouble className="h-[18px] w-[18px]" />}</span>
            <span className="min-w-0 flex-1"><b className="block truncate text-[14px]">{b.title}</b><small className="text-[12.5px] text-[#667085]">{b.reference ? `Reference ${b.reference} · ` : ""}{b.failureReason ?? date(b.createdAt)}</small></span>
            <b className="pay-num">{money(b.amountCents, b.currency)}</b><Status status={b.status === "CONFIRMED" ? "COMPLETED" : b.status} />
          </div>
        ))}</div>
      ))}
      {bookF && me && <BookFlight f={bookF} email={me.email} onClose={() => setBookF(null)} onDone={() => { reload(); setTab("trips"); }} />}
      {bookS && me && <BookStay s={bookS.s} q={bookS.q} name={me.name} onClose={() => setBookS(null)} onDone={() => { reload(); setTab("trips"); }} />}
    </div>
  );
}
