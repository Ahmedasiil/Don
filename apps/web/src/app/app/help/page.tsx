"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LifeBuoy, Phone, MessageSquare, ShieldAlert } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { ago } from "@/lib/format";
import { Badge, Button, Textarea, useToast } from "@/components/ui";
import { PageTitle, Status } from "../bits";

export default function Help() {
  const toast = useToast();
  const router = useRouter();
  const { data } = useApi<{ cases: { id: string; subject: string; status: string; updatedAt: string }[] }>("/api/pay/support");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Help" sub="Our AI assistant answers right away, day and night, and brings in a person whenever you need one." />
      <section className="card space-y-3 p-5">
        <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Tell us what's going on. For example: my transfer to Egypt hasn't arrived." />
        <div className="flex items-center justify-between gap-3"><small className="flex items-center gap-1.5 text-[#667085]"><ShieldAlert className="h-4 w-4" />Never share your password, PIN or codes, even with us.</small>
          <Button variant="pri" loading={busy} disabled={text.trim().length < 2} onClick={async () => { setBusy(true); try { const r = await api<{ id: string }>("/api/pay/support", { body: { message: text } }); router.push(`/app/help/${r.id}`); } catch (e: any) { toast(e.message, "err"); setBusy(false); } }}><MessageSquare className="h-4 w-4" />Start chat</Button></div>
      </section>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Link href="/app/security" className="card flex items-center gap-3 p-4"><ShieldAlert className="h-5 w-5 text-crit" /><span className="text-[14px]"><b>Something you didn't do?</b><small className="block text-[#667085]">Freeze your account first, then chat with us.</small></span></Link>
        <div className="card flex items-center gap-3 p-4"><Phone className="h-5 w-5 text-[#2E5BFF]" /><span className="text-[14px]"><b>Prefer to call?</b><small className="block text-[#667085]">Our AI phone line can help with most questions and connect you to the team.</small></span></div>
      </div>
      {data && data.cases.length > 0 && <section className="mt-6"><h2 className="mb-2 font-display text-[16px] font-semibold text-[#0B1020]">Your conversations</h2>
        <ul className="card divide-y divide-[#EEF0F4] overflow-hidden">{data.cases.map((c) => <li key={c.id}><Link href={`/app/help/${c.id}`} className="flex items-center gap-3 p-4 hover:bg-[#F7F8FA]"><LifeBuoy className="h-4 w-4 text-[#667085]" /><span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{c.subject}</span><small className="text-[#667085]">{ago(c.updatedAt)}</small><Status status={c.status} /></Link></li>)}</ul></section>}
    </div>
  );
}
