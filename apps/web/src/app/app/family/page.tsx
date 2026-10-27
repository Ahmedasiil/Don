"use client";
import { useState } from "react";
import { Plus, Pause, Play, Moon, Globe2, ShoppingBag, CreditCard, Ban, Store, Bell } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { ago } from "@/lib/format";
import { Badge, Button, Empty, ErrorNote, Field, Input, Loading, Modal, Toggle, cx, useToast } from "@/components/ui";
import { CodePrompt, money, PageTitle, readiness, SetupBanner, type Overview, Status } from "../bits";
import { CardFace } from "../card-face";

type Member = { id: string; name: string; birthYear: number; status: string; weeklyLimitCents: number; perPurchaseLimitCents: number | null; approvalOverCents: number | null; blockedCategories: string[]; allowedMerchants: string[]; nightLock: boolean; onlineAllowed: boolean; countries: string[]; spentThisWeekCents: number; cards: { id: string; last4: string; brand: string; type: string; status: string; expMonth: number; expYear: number }[]; activity: { id: string; merchant: string; amountCents: number; currency: string; decision: string; reason: string | null; createdAt: string }[] };
type Group = { key: string; label: string; categories: string[] };
type Data = { groups: Group[]; members: Member[] };

const groupsOn = (m: Member, groups: Group[]) => groups.filter((g) => g.categories.every((c) => m.blockedCategories.includes(c))).map((g) => g.key);

function Rules({ m, groups, currency, onSave }: { m: Partial<Member>; groups: Group[]; currency: string; onSave: (body: Record<string, unknown>) => Promise<void> }) {
  const [v, setV] = useState({ weekly: String((m.weeklyLimitCents ?? 5000) / 100), per: m.perPurchaseLimitCents ? String(m.perPurchaseLimitCents / 100) : "", approve: m.approvalOverCents ? String(m.approvalOverCents / 100) : "", blocked: m.id ? groupsOn(m as Member, groups) : ["gambling", "alcohol", "tobacco", "adult", "crypto"], merchants: (m.allowedMerchants ?? []).join(", "), night: m.nightLock ?? true, online: m.onlineAllowed ?? true, countries: (m.countries ?? []).join(", ") });
  const [busy, setBusy] = useState(false);
  const toCents = (s: string) => (s ? Math.round(Number(s) * 100) : null);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={`Weekly allowance (${currency})`}><Input inputMode="decimal" value={v.weekly} onChange={(e) => setV({ ...v, weekly: e.target.value })} /></Field>
        <Field label="Max per purchase"><Input inputMode="decimal" placeholder="No limit" value={v.per} onChange={(e) => setV({ ...v, per: e.target.value })} /></Field>
        <Field label="Ask me above"><Input inputMode="decimal" placeholder="Never" value={v.approve} onChange={(e) => setV({ ...v, approve: e.target.value })} /></Field>
      </div>
      <div><b className="mb-2 flex items-center gap-1.5 text-[13.5px]"><Ban className="h-4 w-4 text-crit" />Blocked places</b>
        <div className="flex flex-wrap gap-2">{groups.map((g) => <button key={g.key} type="button" onClick={() => setV({ ...v, blocked: v.blocked.includes(g.key) ? v.blocked.filter((x) => x !== g.key) : [...v.blocked, g.key] })} className={cx("rounded-full border px-3 py-1.5 text-[13px] font-semibold", v.blocked.includes(g.key) ? "border-crit bg-[#FFF5F7] text-crit" : "border-[#E7E9EF] text-[#667085]")}>{g.label}</button>)}</div>
      </div>
      <Field label="Only allow these shops (optional)" help="Comma separated, for example: Walmart, Tim Hortons, Indigo. Leave empty to allow everywhere not blocked."><Input value={v.merchants} onChange={(e) => setV({ ...v, merchants: e.target.value })} /></Field>
      <Field label="Only in these countries (optional)" help="Two-letter codes, for example: CA, US"><Input value={v.countries} onChange={(e) => setV({ ...v, countries: e.target.value.toUpperCase() })} /></Field>
      <Toggle checked={v.night} onChange={(x) => setV({ ...v, night: x })} label="Night lock" help="No card payments from 10 pm to 6 am." />
      <Toggle checked={v.online} onChange={(x) => setV({ ...v, online: x })} label="Online shopping" help="Allow purchases on websites and apps." />
      <div className="flex justify-end"><Button variant="pri" loading={busy} onClick={async () => { setBusy(true); try { await onSave({ weeklyLimitCents: toCents(v.weekly) ?? 0, perPurchaseLimitCents: toCents(v.per), approvalOverCents: toCents(v.approve), blockedGroups: v.blocked, allowedMerchants: v.merchants.split(",").map((s) => s.trim()).filter(Boolean), countries: v.countries.split(",").map((s) => s.trim()).filter((s) => s.length === 2), nightLock: v.night, onlineAllowed: v.online }); } finally { setBusy(false); } }}>Save rules</Button></div>
    </div>
  );
}

export default function Family() {
  const toast = useToast();
  const { data: o } = useApi<Overview>("/api/pay/overview");
  const { data, error, reload } = useApi<Data>("/api/pay/family", { refreshMs: 30_000 });
  const [adding, setAdding] = useState(false);
  const [who, setWho] = useState({ name: "", birthYear: String(new Date().getFullYear() - 14) });
  const [edit, setEdit] = useState<string | null>(null);
  const [cardFor, setCardFor] = useState<Member | null>(null);
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data || !o) return <Loading rows={4} />;
  const save = (id?: string) => async (rules: Record<string, unknown>) => {
    try {
      if (id) await api(`/api/pay/family/${id}`, { method: "PATCH", body: rules });
      else await api("/api/pay/family", { body: { ...rules, name: who.name, birthYear: Number(who.birthYear) } });
      toast("Saved. Rules apply to the next purchase.", "ok"); setAdding(false); setEdit(null); reload();
    } catch (e: any) { toast(e.message, "err"); }
  };
  return (
    <div>
      <PageTitle title="Family" sub="Give your teens their own card with your rules: weekly allowance, blocked places, night lock and a notification for every purchase." action={<Button variant="pri" disabled={!!readiness(o)} onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Add a teen</Button>} />
      {readiness(o) && <div className="mb-5"><SetupBanner o={o} /></div>}
      {!data.members.length ? <Empty icon={<ShoppingBag className="h-6 w-6" />} title="No family members yet" body="Add a teen to give them a card you control." /> : (
        <div className="space-y-5">{data.members.map((m) => (
          <section key={m.id} className="card overflow-hidden">
            <header className="flex flex-wrap items-center gap-3 border-b border-[#E7E9EF] p-5">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[#0B1020] font-display text-white">{m.name[0]}</span>
              <div className="min-w-0 flex-1"><b className="block font-display text-[18px] text-[#0B1020]">{m.name}</b><small className="text-[#667085]">Age {new Date().getFullYear() - m.birthYear} · spent {money(m.spentThisWeekCents, o.currency)} of {money(m.weeklyLimitCents, o.currency)} this week</small>
                <div className="mt-2 h-2 w-full max-w-xs overflow-hidden rounded-full bg-[#F7F8FA]"><div className="h-full rounded-full bg-blue" style={{ width: `${Math.min(100, (m.spentThisWeekCents / Math.max(1, m.weeklyLimitCents)) * 100)}%` }} /></div></div>
              <Status status={m.status} />
              <Button size="sm" onClick={() => setEdit(edit === m.id ? null : m.id)}>Rules</Button>
              <Button size="sm" onClick={() => save(m.id)({ status: m.status === "ACTIVE" ? "PAUSED" : "ACTIVE" })}>{m.status === "ACTIVE" ? <><Pause className="h-4 w-4" />Pause card</> : <><Play className="h-4 w-4" />Resume</>}</Button>
            </header>
            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
              <div className="space-y-3">
                {m.cards[0] ? <CardFace c={m.cards[0]} name={m.name} teen /> : <button onClick={() => setCardFor(m)} className="grid aspect-[1.586] w-full max-w-[380px] place-items-center rounded-[18px] border-2 border-dashed border-[#E7E9EF] text-[#667085] hover:border-[#0B1020] hover:text-[#2E5BFF]"><span className="flex items-center gap-2 font-semibold"><CreditCard className="h-5 w-5" />Give {m.name} a card</span></button>}
                <div className="flex flex-wrap gap-1.5 text-[12px]">
                  {m.nightLock && <span className="flex items-center gap-1 rounded-full bg-[#F7F8FA] px-2 py-1"><Moon className="h-3.5 w-3.5" />Night lock</span>}
                  {!m.onlineAllowed && <span className="flex items-center gap-1 rounded-full bg-[#F7F8FA] px-2 py-1"><Globe2 className="h-3.5 w-3.5" />No online</span>}
                  {m.allowedMerchants.length > 0 && <span className="flex items-center gap-1 rounded-full bg-[#F7F8FA] px-2 py-1"><Store className="h-3.5 w-3.5" />{m.allowedMerchants.length} allowed shops</span>}
                  {groupsOn(m, data.groups).map((g) => <span key={g} className="rounded-full bg-[#FFF5F7] px-2 py-1 font-semibold text-crit">{data.groups.find((x) => x.key === g)?.label}</span>)}
                </div>
              </div>
              {edit === m.id ? <Rules m={m} groups={data.groups} currency={o.currency} onSave={save(m.id)} /> : (
                <div><b className="mb-2 flex items-center gap-1.5 text-[13.5px]"><Bell className="h-4 w-4" />Recent purchases</b>
                  {!m.activity.length ? <p className="text-[13.5px] text-[#667085]">Every purchase and every blocked try will show here, and on your phone.</p> : (
                    <ul className="divide-y divide-[#EEF0F4]">{m.activity.map((a) => <li key={a.id} className="flex items-center gap-3 py-2.5 text-[13.5px]"><span className="min-w-0 flex-1"><b className="block truncate">{a.merchant}</b><small className={a.decision === "DECLINED" ? "text-crit" : "text-[#667085]"}>{a.decision === "DECLINED" ? `Blocked: ${a.reason}` : ago(a.createdAt)}</small></span><b className={a.decision === "DECLINED" ? "text-[#667085] line-through" : ""}>{money(a.amountCents, a.currency)}</b></li>)}</ul>
                  )}
                </div>
              )}
            </div>
          </section>
        ))}</div>
      )}
      <Modal open={adding} onClose={() => setAdding(false)} title="Add a teen" wide>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3"><Field label="First name" required><Input value={who.name} onChange={(e) => setWho({ ...who, name: e.target.value })} /></Field><Field label="Birth year" required><Input inputMode="numeric" value={who.birthYear} onChange={(e) => setWho({ ...who, birthYear: e.target.value })} /></Field></div>
          <Rules m={{}} groups={data.groups} currency={o.currency} onSave={save()} />
        </div>
      </Modal>
      <CodePrompt open={!!cardFor} onClose={() => setCardFor(null)} title={`Card for ${cardFor?.name ?? ""}`} onConfirm={async (code) => { await api(`/api/pay/family/${cardFor!.id}/card`, { body: { type: "virtual", code } }); toast("Card ready. Add it to their phone wallet.", "ok"); setCardFor(null); reload(); }} />
    </div>
  );
}
