"use client";
import { useState } from "react";
import { Plus, Copy } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { date } from "@/lib/format";
import { Badge, Button, Callout, ErrorNote, Field, Input, Loading, Modal, PageHeader, Select, Tabs, Toggle, copyText, useToast } from "@/components/ui";
import { cents, NoteActions, Table } from "../bits";

type Biller = { id: string; name: string; country: string; category: string; provider: string; providerCode: string | null; accountLabel: string; accountHint: string | null; active: boolean; _count: { payees: number } };
type Pay = { id: string; userId: string; amountCents: number; feeCents: number; currency: string; status: string; scheduledFor: string; repeat: string | null; confirmation: string | null; failureReason: string | null; account: string | null; customer: { name: string; email: string } | null; payee: { label: string; biller: Biller } };
type D = { categories: string[]; billers: Biller[]; payments: Pay[]; counts: { status: string; _count: number; _sum: { amountCents: number | null } }[] };
const blank = { name: "", country: "CA", category: "ELECTRICITY", provider: "ops", providerCode: "", accountLabel: "Account number", accountHint: "", active: true };

function Settle({ p, onDone }: { p: Pay; onDone: () => void }) {
  const toast = useToast();
  const [conf, setConf] = useState("");
  return (
    <div className="space-y-2">
      <div className="flex gap-2"><Input value={conf} onChange={(e) => setConf(e.target.value)} placeholder="Biller confirmation number" className="h-9" /><Button size="sm" variant="pri" disabled={conf.length < 3} onClick={async () => { try { await api(`/api/admin/bills/payments/${p.id}`, { body: { paid: true, confirmation: conf } }); toast("Marked paid", "ok"); onDone(); } catch (e: any) { toast(e.message, "err"); } }}>Mark paid</Button></div>
      <NoteActions actions={[{ label: "Couldn't pay, refund", tone: "danger", run: async (reason) => { try { await api(`/api/admin/bills/payments/${p.id}`, { body: { paid: false, reason } }); toast("Refunded to customer", "ok"); onDone(); } catch (e: any) { toast(e.message, "err"); } } }]} />
    </div>
  );
}

export default function BillsAdmin() {
  const toast = useToast();
  const [tab, setTab] = useState<"PROCESSING" | "SCHEDULED" | "PAID" | "ALL" | "billers">("PROCESSING");
  const { data, error, reload } = useApi<D>(`/api/admin/bills?status=${tab === "billers" ? "PROCESSING" : tab}`);
  const [edit, setEdit] = useState<(typeof blank & { id?: string }) | null>(null);
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return <Loading rows={6} />;
  const count = (s: string) => data.counts.find((c) => c.status === s)?._count ?? 0;
  const save = async () => { try { const { id, ...b } = edit!; const body = { ...b, providerCode: b.providerCode || null, accountHint: b.accountHint || null }; await api(id ? `/api/admin/bills/billers/${id}` : "/api/admin/bills/billers", { method: id ? "PATCH" : "POST", body }); setEdit(null); reload(); toast("Saved", "ok"); } catch (e: any) { toast(e.message, "err"); } };
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Products" title="Bill pay" sub="Customers' money is already taken. Pay each bill through the company bank, then record the biller's confirmation number." actions={<Button variant="pri" onClick={() => setEdit({ ...blank })}><Plus className="h-4 w-4" />Add biller</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: "PROCESSING", label: "To pay now", count: count("PROCESSING") }, { key: "SCHEDULED", label: "Scheduled", count: count("SCHEDULED") }, { key: "PAID", label: "Paid" }, { key: "ALL", label: "All" }, { key: "billers", label: "Billers", count: data.billers.length }]} />
      {tab === "PROCESSING" && count("PROCESSING") > 0 && <Callout tone="warn" title="Pay within one business day">Customers were told it takes 1 to 3 business days. The full account number shows only on this tab.</Callout>}
      {tab === "billers" ? (
        <div className="card overflow-hidden"><Table head={["Biller", "Country", "Category", "Paid via", "Customers", ""]} empty={!data.billers.length}>
          {data.billers.map((b) => <tr key={b.id}><td className="px-5 py-3"><b>{b.name}</b>{!b.active && <Badge tone="gray" className="ms-2">Hidden</Badge>}</td><td className="px-5 py-3">{b.country}</td><td className="px-5 py-3">{b.category.replace("_", " ").toLowerCase()}</td><td className="px-5 py-3">{b.provider}{b.providerCode ? ` · ${b.providerCode}` : ""}</td><td className="px-5 py-3">{b._count.payees}</td><td className="px-5 py-3 text-end"><Button size="sm" onClick={() => setEdit({ ...b, providerCode: b.providerCode ?? "", accountHint: b.accountHint ?? "" })}>Edit</Button></td></tr>)}
        </Table></div>
      ) : (
        <div className="card overflow-hidden"><Table head={["Due", "Customer", "Biller and account", "Amount", "Status", tab === "PROCESSING" ? "Record outcome" : ""]} empty={!data.payments.length}>
          {data.payments.map((p) => (
            <tr key={p.id} className="align-top">
              <td className="whitespace-nowrap px-5 py-3">{date(p.scheduledFor)}{p.repeat && <small className="block text-muted">Monthly</small>}</td>
              <td className="px-5 py-3"><b>{p.customer?.name}</b><small className="block text-muted">{p.customer?.email}</small></td>
              <td className="px-5 py-3"><b>{p.payee.biller.name}</b>{p.account ? <button onClick={() => { copyText(p.account!); toast("Account copied", "ok"); }} className="mt-0.5 flex items-center gap-1 font-mono text-[12.5px]">{p.account}<Copy className="h-3 w-3" /></button> : <small className="block text-muted">{p.payee.label}</small>}{p.payee.biller.providerCode && <small className="block text-muted">Biller code {p.payee.biller.providerCode}</small>}</td>
              <td className="whitespace-nowrap px-5 py-3 font-semibold tabular-nums">{cents(p.amountCents, p.currency)}</td>
              <td className="px-5 py-3"><Badge status={p.status} />{p.confirmation && <small className="block text-muted">#{p.confirmation}</small>}{p.failureReason && <small className="block text-muted">{p.failureReason}</small>}</td>
              <td className="min-w-[280px] px-5 py-3">{p.status === "PROCESSING" && <Settle p={p} onDone={reload} />}</td>
            </tr>
          ))}
        </Table></div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit biller" : "Add biller"} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="pri" disabled={!edit?.name} onClick={save}>Save</Button></>}>
        {edit && <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" className="sm:col-span-2"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <Field label="Country (2 letters)"><Input value={edit.country} maxLength={2} onChange={(e) => setEdit({ ...edit, country: e.target.value.toUpperCase() })} /></Field>
          <Field label="Category"><Select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} options={data.categories} /></Field>
          <Field label="Paid via"><Select value={edit.provider} onChange={(e) => setEdit({ ...edit, provider: e.target.value })} options={[{ value: "ops", label: "Our team, by bank" }, { value: "fawry", label: "Fawry (Egypt)" }]} /></Field>
          <Field label="Biller code at the bank"><Input value={edit.providerCode} onChange={(e) => setEdit({ ...edit, providerCode: e.target.value })} /></Field>
          <Field label="Account field label"><Input value={edit.accountLabel} onChange={(e) => setEdit({ ...edit, accountLabel: e.target.value })} /></Field>
          <Field label="Hint for customers"><Input value={edit.accountHint} onChange={(e) => setEdit({ ...edit, accountHint: e.target.value })} placeholder="12 digits, top right of your bill" /></Field>
          <div className="sm:col-span-2"><Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Show to customers" /></div>
        </div>}
      </Modal>
    </div>
  );
}
