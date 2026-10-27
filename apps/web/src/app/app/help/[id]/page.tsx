"use client";
import { use, useEffect, useRef, useState } from "react";
import { Bot, Send, Star, User as UserIcon } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { ago } from "@/lib/format";
import { Badge, Button, ErrorNote, Loading, cx, useToast } from "@/components/ui";
import { PageTitle, Status } from "../../bits";

type C = { id: string; subject: string; status: string; csat: number | null; messages: { id: string; from: string; body: string; createdAt: string }[] };

export default function Conversation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const { data: c, error, reload } = useApi<C>(`/api/pay/support/${id}`, { refreshMs: 8_000 });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [c?.messages.length]);
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!c) return <Loading rows={5} />;
  const send = async () => { setBusy(true); try { await api(`/api/pay/support/${id}`, { body: { message: text } }); setText(""); reload(); } catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); } };
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title={c.subject} action={<Status status={c.status} />} />
      <section className="card flex min-h-[480px] flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto p-5" style={{ maxHeight: 560 }}>
          {c.messages.map((m) => (
            <div key={m.id} className={cx("flex gap-2", m.from === "CUSTOMER" && "flex-row-reverse")}>
              <span className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-full", m.from === "AI" ? "bg-[#F2F4F7] text-[#2E5BFF]" : m.from === "AGENT" ? "bg-[#0B1020] text-white" : "bg-[#F7F8FA]")}>{m.from === "AI" ? <Bot className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}</span>
              <div className={cx("max-w-[80%] rounded-[14px] px-4 py-2.5 text-[14px]", m.from === "CUSTOMER" ? "bg-[#0B1020] text-white" : "bg-[#F7F8FA]")}><p className="whitespace-pre-wrap">{m.body}</p><small className={cx("mt-1 block text-[11px]", m.from === "CUSTOMER" ? "text-white/60" : "text-[#667085]")}>{m.from === "AI" ? "oenodpay assistant" : m.from === "AGENT" ? "oenodpay team" : "You"} · {ago(m.createdAt)}</small></div>
            </div>
          ))}
          {c.status === "WAITING_AGENT" && <p className="text-center text-[12.5px] text-[#667085]">A member of our team will reply here. We'll notify you.</p>}
          <div ref={end} />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) send(); }} className="flex gap-2 border-t border-[#E7E9EF] p-4">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message" className="input h-12 flex-1" maxLength={4000} />
          <Button variant="pri" type="submit" loading={busy} className="h-12 w-12 px-0" aria-label="Send"><Send className="h-5 w-5" /></Button>
        </form>
      </section>
      {c.status === "RESOLVED" && !c.csat && <div className="mt-4 flex items-center justify-center gap-1"><span className="me-2 text-[13.5px] text-[#667085]">How did we do?</span>{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={async () => { await api(`/api/pay/support/${id}`, { body: { csat: n } }); toast("Thanks for the feedback", "ok"); reload(); }} aria-label={`${n} stars`}><Star className="h-6 w-6 text-[#FFB020] hover:fill-[#FFB020]" /></button>)}</div>}
    </div>
  );
}
