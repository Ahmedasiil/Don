"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, ExternalLink, KeyRound, Lock, Search } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { Badge, Button, Callout, ErrorNote, Field, Input, Loading, Modal, PageHeader, cx, useToast } from "@/components/ui";

type F = { key: string; label: string; secret?: boolean; placeholder?: string; help?: string; set: boolean; source: "admin" | "hosting" | null; preview: string | null };
type P = { key: string; name: string; group: string; color: string; description: string; docs?: string; test?: boolean; enabled: boolean; fields: F[] };

export default function PluginCentre() {
  const { data, error, reload } = useApi<{ data: P[] }>("/api/admin/plugins");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<P | null>(null);
  // /admin/plugins#pricing opens that plugin straight away.
  useEffect(() => { const k = location.hash.slice(1); if (data && k) setOpen(data.data.find((p) => p.key === k) ?? null); }, [data]);
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return <Loading rows={6} />;
  const list = data.data.filter((p) => !q || `${p.name} ${p.group} ${p.description}`.toLowerCase().includes(q.toLowerCase()));
  const groups = Array.from(new Set(list.map((p) => p.group)));
  const on = data.data.filter((p) => p.enabled).length;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Platform" title="Plugin centre" sub={`The services oenodpay runs on: money movement, cards, identity, email, SMS and AI. ${on} of ${data.data.length} connected.`} />
      <Callout tone="info" title="Keys stay secret">Keys you enter here are encrypted before they're stored and are never shown again, only their last four characters. You can also set them as environment variables in your hosting. A value saved here takes priority; remove it to fall back to the hosting value.</Callout>
      <label className="flex h-10 max-w-sm items-center gap-2 rounded-xl border border-line bg-paper px-3 shadow-card"><Search className="h-4 w-4 text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a service" className="w-full bg-transparent outline-none" /></label>
      {groups.map((g) => (
        <section key={g}>
          <h2 className="eyebrow mb-3">{g}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.filter((p) => p.group === g).map((p) => (
              <button key={p.key} onClick={() => setOpen(p)} className="card flex items-start gap-3 p-4 text-start transition hover:-translate-y-0.5 hover:shadow-lift">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display text-[15px] font-bold text-white" style={{ background: p.color }}>{p.name.charAt(0)}</span>
                <span className="min-w-0 flex-1"><b className="block text-[14px]">{p.name}</b><small className="line-clamp-2 text-[12.5px] text-muted">{p.description}</small></span>
                {p.enabled ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[#1FAF6B]" aria-label="Connected" /> : <Circle className="h-5 w-5 shrink-0 text-line" aria-label="Not connected" />}
              </button>
            ))}
          </div>
        </section>
      ))}
      {open && <PluginModal p={open} onClose={() => setOpen(null)} onSaved={(np) => { reload(); if (np) setOpen(np); }} />}
    </div>
  );
}

function PluginModal({ p, onClose, onSaved }: { p: P; onClose: () => void; onSaved: (p: P | null) => void }) {
  const toast = useToast();
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const changed = Object.entries(vals).filter(([, v]) => v.trim() !== "");
  const save = async () => {
    setBusy("save"); setResult(null);
    try {
      const r = await api<{ plugin: P; test: { ok: boolean; message: string } | null }>("/api/admin/plugins", { method: "PUT", body: { plugin: p.key, values: Object.fromEntries(changed.map(([k, v]) => [k, v.trim()])) } });
      setVals({}); setResult(r.test); toast(`${p.name} saved`, "ok"); onSaved(r.plugin);
    } catch (e: any) { toast(e.message, "err"); } finally { setBusy(null); }
  };
  const remove = async (key: string) => {
    try { const r = await api<{ plugin: P }>("/api/admin/plugins", { method: "PUT", body: { plugin: p.key, values: { [key]: null } } }); onSaved(r.plugin); } catch (e: any) { toast(e.message, "err"); }
  };
  const test = async () => {
    setBusy("test");
    try { setResult(await api("/api/admin/plugins", { body: { plugin: p.key } })); } catch (e: any) { setResult({ ok: false, message: e.message }); } finally { setBusy(null); }
  };
  const origin = typeof window !== "undefined" ? location.origin : "";
  return (
    <Modal open onClose={onClose} title={p.name} footer={<>{p.test && <Button variant="ghost" loading={busy === "test"} onClick={test}>Test connection</Button>}<Button variant="pri" loading={busy === "save"} disabled={!changed.length} onClick={save}>Save</Button></>}>
      <div className="space-y-4">
        <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-[16px] font-bold text-white" style={{ background: p.color }}>{p.name.charAt(0)}</span><p className="flex-1 text-[13.5px] text-muted">{p.description}</p>{p.enabled ? <Badge tone="green">Connected</Badge> : <Badge>Not connected</Badge>}</div>
        {p.docs && <a href={p.docs} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-semibold text-blue">Where to find these keys<ExternalLink className="h-3.5 w-3.5" /></a>}
        {p.fields.map((f) => (
          <Field key={f.key} label={<span className="flex items-center gap-1.5">{f.secret ? <Lock className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}{f.label}</span>} help={f.help?.replace("{APP_URL}", origin)}>
            <Input type={f.secret ? "password" : "text"} autoComplete="off" spellCheck={false} value={vals[f.key] ?? ""} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} placeholder={f.set ? `${f.preview ?? "Saved"} (leave blank to keep)` : f.placeholder} className="font-mono text-[13px]" />
            {f.set && <div className="mt-1.5 flex items-center gap-2 text-[12px] text-muted"><span className={cx("h-1.5 w-1.5 rounded-full", "bg-[#1FAF6B]")} />{f.source === "hosting" ? "Set in your hosting environment" : "Saved here"}{f.source === "admin" && <button onClick={() => remove(f.key)} className="font-semibold text-crit">Remove</button>}</div>}
          </Field>
        ))}
        {result && <p className={cx("rounded-xl px-3 py-2 text-[13px]", result.ok ? "bg-[#EAFBF2] text-[#0E7A47]" : "bg-[#FFF5F7] text-crit")}>{result.message}</p>}
      </div>
    </Modal>
  );
}
