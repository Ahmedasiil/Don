"use client";
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, RotateCcw } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { Button, ErrorNote, Loading, cx, useToast } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { money, PageTitle } from "../bits";

type Health = { score: number; parts: Record<string, number>; inflowCents: number; outflowCents: number; availableCents: number; bufferMonths: number; currency: string };
type M = { role: "user" | "assistant"; content: string };
const STARTERS = ["Make me a budget I can stick to", "How do I build an emergency fund?", "Help me pay off my credit card faster", "How can I raise my credit score in Canada?", "What's a TFSA vs RRSP vs FHSA?", "Cheapest way to send money home every month"];
const PART: Record<string, string> = { savings: "Saving rate", buffer: "Safety buffer", steadiness: "Steady habits", fees: "Low fees" };

export default function Coach() {
  const toast = useToast();
  const { data, error, reload } = useApi<{ messages: M[]; health: Health }>("/api/pay/coach");
  const [msgs, setMsgs] = useState<M[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { if (data) setMsgs(data.messages); }, [data]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs.length, busy]);
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return <Loading rows={6} />;
  const h = data.health;
  const ask = async (q: string) => {
    if (!q.trim() || busy) return;
    setMsgs((m) => [...m, { role: "user", content: q }]); setText(""); setBusy(true);
    try { const r = await api<{ reply: string }>("/api/pay/coach", { body: { message: q } }); setMsgs((m) => [...m, { role: "assistant", content: r.reply }]); }
    catch (e: any) { toast(e.message, "err"); setMsgs((m) => m.slice(0, -1)); setText(q); }
    finally { setBusy(false); }
  };
  return (
    <div>
      <PageTitle title="Oeno, your money coach" sub="Practical, private advice from your real numbers. Budgets, debt, credit scores, saving and sending money home." action={msgs.length > 0 && <Button size="sm" variant="ghost" onClick={async () => { await api("/api/pay/coach", { method: "DELETE" }); setMsgs([]); }}><RotateCcw className="h-4 w-4" />New chat</Button>} />
      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-[24px] bg-[#0B1020] bg-[radial-gradient(90%_120%_at_100%_0%,rgba(46,91,255,.28)_0%,transparent_60%)] p-5 text-white shadow-lift">
            <span className="font-mono text-[10.5px] uppercase tracking-[.16em] text-white/60">Financial Health Score</span>
            <div className="mt-1 font-display text-[54px] font-semibold leading-none">{h.score}<span className="text-[20px] text-white/60">/100</span></div>
            <div className="mt-4 space-y-2.5">{Object.entries(h.parts).map(([k, v]) => <div key={k}><div className="flex justify-between text-[12.5px]"><span className="text-white/80">{PART[k] ?? k}</span><b>{v}</b></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-white" style={{ width: `${v}%` }} /></div></div>)}</div>
          </section>
          <section className="card space-y-1.5 p-4 text-[13.5px]">
            <div className="flex justify-between"><span className="text-[#667085]">In, 90 days</span><b>{money(h.inflowCents, h.currency)}</b></div>
            <div className="flex justify-between"><span className="text-[#667085]">Out, 90 days</span><b>{money(h.outflowCents, h.currency)}</b></div>
            <div className="flex justify-between"><span className="text-[#667085]">Safety buffer</span><b>{h.bufferMonths} months</b></div>
          </section>
        </aside>
        <section className="card flex min-h-[560px] flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-5" style={{ maxHeight: 620 }}>
            {!msgs.length && <div className="grid place-items-center gap-4 py-8 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-[14px] bg-[#F2F4F7] text-[#2E5BFF]"><Sparkles className="h-7 w-7" /></span>
              <p className="max-w-md text-[14px] text-[#667085]">Hi, I'm Oeno. Ask me anything about your money. I can see your oenodpay activity, never your passwords.</p>
              <div className="flex max-w-xl flex-wrap justify-center gap-2">{STARTERS.map((s) => <button key={s} onClick={() => ask(s)} className="rounded-full border border-[#E7E9EF] px-3 py-1.5 text-[13px] font-semibold hover:border-[#0B1020] hover:text-[#2E5BFF]">{s}</button>)}</div>
            </div>}
            {msgs.map((m, i) => <div key={i} className={cx("flex", m.role === "user" && "justify-end")}><div className={cx("max-w-[85%] rounded-[14px] px-4 py-3 text-[14px]", m.role === "user" ? "bg-[#0B1020] text-white" : "bg-[#F7F8FA]")}>{m.role === "assistant" ? <Markdown text={m.content} /> : m.content}</div></div>)}
            {busy && <div className="flex"><div className="rounded-[14px] bg-[#F7F8FA] px-4 py-3 text-[14px] text-[#667085]">Oeno is thinking…</div></div>}
            <div ref={end} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); ask(text); }} className="flex gap-2 border-t border-[#E7E9EF] p-4">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask Oeno…" className="input h-12 flex-1" maxLength={2000} />
            <Button variant="pri" type="submit" loading={busy} className="h-12 w-12 px-0" aria-label="Send"><Send className="h-5 w-5" /></Button>
          </form>
          <p className="px-4 pb-3 text-[11.5px] text-[#667085]">General education, not personal financial, tax or legal advice.</p>
        </section>
      </div>
    </div>
  );
}
