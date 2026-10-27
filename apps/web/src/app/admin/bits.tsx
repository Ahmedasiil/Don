"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import { money } from "@/lib/format";

/** Platform amounts are stored in cents. */
export const cents = (c: number | null | undefined, currency = "CAD") => money((c ?? 0) / 100, currency);

export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 px-5 py-3 text-[13px] text-muted">
      <button className="btn btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="h-4 w-4 rtl:rotate-180" /></button>
      Page {page} of {pages}
      <button className="btn btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronRight className="h-4 w-4 rtl:rotate-180" /></button>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-line bg-paper px-3 shadow-card sm:max-w-sm">
      <Search className="h-4 w-4 shrink-0 text-muted" /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-full w-full bg-transparent text-[14px] outline-none" />
    </label>
  );
}

/** A plain table shell with consistent header styling. */
export function Table({ head, children, empty }: { head: React.ReactNode[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-[13.5px]">
        <thead><tr className="border-b border-line text-[11.5px] uppercase tracking-wide text-muted">{head.map((h, i) => <th key={i} className="whitespace-nowrap px-5 py-2.5 text-start font-semibold">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {empty && <p className="p-10 text-center text-[13.5px] text-muted">Nothing here yet.</p>}
    </div>
  );
}

export function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

/** A reason box with decision buttons. The note goes to the audit log. */
export function NoteActions({ actions }: { actions: { label: string; tone?: "pri" | "danger"; run: (note: string) => Promise<void> }[] }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Textarea rows={2} className="min-h-[60px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for your decision (kept in the audit log)" />
      <div className="flex flex-wrap justify-end gap-2">
        {actions.map((a) => <Button key={a.label} variant={a.tone === "pri" ? "pri" : a.tone === "danger" ? "danger" : "default"} size="sm" loading={busy === a.label} onClick={async () => { setBusy(a.label); try { await a.run(note); setNote(""); } finally { setBusy(null); } }}>{a.label}</Button>)}
      </div>
    </div>
  );
}
