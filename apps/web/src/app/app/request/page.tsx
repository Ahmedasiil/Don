"use client";
import { useState } from "react";
import { HandCoins, Check, X } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { ago } from "@/lib/format";
import { Button, Field, Input, Loading, Tabs, Textarea, useToast } from "@/components/ui";
import { money, PageTitle, PayConfirm, Row, Status, toCents } from "../bits";

type Req = { id: string; amountCents: number; currency: string; note: string | null; status: string; createdAt: string; expiresAt: string; person: { name: string; email: string } | null };

export default function RequestMoney() {
  const toast = useToast();
  const { data, reload } = useApi<{ sent: Req[]; received: Req[] }>("/api/pay/requests");
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState<Req | null>(null);
  const ask = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { await api("/api/pay/requests", { body: { email, amountCents: toCents(amount), note: note || undefined } }); toast("Request sent", "ok"); setEmail(""); setAmount(""); setNote(""); setTab("sent"); reload(); }
    catch (er: any) { toast(er.message, "err"); } finally { setBusy(false); }
  };
  const act = async (r: Req, action: "decline" | "cancel") => { try { await api(`/api/pay/requests/${r.id}`, { body: { action } }); reload(); } catch (e: any) { toast(e.message, "err"); } };
  const pending = data?.received.filter((r) => r.status === "PENDING").length ?? 0;
  const list = data?.[tab] ?? [];
  return (
    <div>
      <PageTitle title="Request money" sub="Ask anyone with oenodpay to pay you. They get a notification and pay with one tap and their PIN." />
      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <form onSubmit={ask} className="card space-y-4 self-start p-5">
          <h2 className="pay-h">New request</h2>
          <Field label="Their email" required><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@email.com" /></Field>
          <Field label="Amount" required><Input inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.00" className="h-12 font-display text-xl" /></Field>
          <Field label="What's it for?"><Textarea rows={2} maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Dinner on Friday" /></Field>
          <Button variant="pri" type="submit" loading={busy} disabled={!email || toCents(amount) < 100} className="w-full"><HandCoins className="h-4 w-4" />Send request</Button>
        </form>
        <section>
          <div className="mb-3"><Tabs value={tab} onChange={setTab} tabs={[{ key: "received", label: "Asked of you", count: pending || undefined }, { key: "sent", label: "You asked" }]} /></div>
          {!data ? <Loading rows={4} /> : (
            <div className="card divide-y divide-[#EEF0F4]">
              {list.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <span className="min-w-0 flex-1"><b className="block truncate text-[14px]">{tab === "received" ? `${r.person?.name ?? "Someone"} asked you` : `You asked ${r.person?.name ?? "someone"}`}</b><small className="text-[12.5px] text-[#667085]">{r.note ? `“${r.note}” · ` : ""}{ago(r.createdAt)}</small></span>
                  <b className="pay-num text-[15px]">{money(r.amountCents, r.currency)}</b>
                  {r.status === "PENDING" && tab === "received" ? <span className="flex gap-2"><Button size="sm" onClick={() => act(r, "decline")}><X className="h-4 w-4" />Decline</Button><Button size="sm" variant="pri" onClick={() => setPay(r)}><Check className="h-4 w-4" />Pay</Button></span>
                    : r.status === "PENDING" ? <Button size="sm" variant="ghost" onClick={() => act(r, "cancel")}>Cancel</Button> : <Status status={r.status} />}
                </div>
              ))}
              {!list.length && <p className="p-10 text-center text-[13.5px] text-[#667085]">{tab === "received" ? "No one has asked you for money." : "You haven't asked anyone yet."}</p>}
            </div>
          )}
        </section>
      </div>
      <PayConfirm open={!!pay} onClose={() => setPay(null)} title="Pay request" summary={pay && <><Row k="To" v={pay.person?.name} /><Row k="Amount" v={money(pay.amountCents, pay.currency)} />{pay.note && <Row k="For" v={pay.note} />}</>}
        run={async (pin, code) => { await api(`/api/pay/requests/${pay!.id}`, { body: { action: "pay", pin, code } }); setPay(null); toast("Paid", "ok"); reload(); }} />
    </div>
  );
}
