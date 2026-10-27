"use client";
import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, Lock, KeyRound } from "lucide-react";
import { Button, Input, Modal } from "@/components/ui";

export const money = (cents: number | null | undefined, currency = "CAD") =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format((cents ?? 0) / 100);

export const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export type Overview = {
  currency: string; balanceCents: number; availableCents: number;
  profile: { tier: number; kycStatus: string; name: string | null; country: string | null; frozen: boolean; pinSet: boolean; twoStep: boolean };
  limits: { perTransfer: number; daily: number; monthly: number; wallet: number; newDevice: boolean };
  health: { score: number; parts: Record<string, number>; inflowCents: number; outflowCents: number; availableCents: number; bufferMonths: number; currency: string };
  recent: { id: string; kind: string; memo: string | null; at: string; amountCents: number; currency: string }[];
  cards: { id: string; last4: string; status: string; type: string; brand: string; expMonth: number; expYear: number }[];
  familyCount: number;
  transfers: { id: string; status: string; sendCents: number; sendCurrency: string; receiveCents: number; receiveCurrency: string; createdAt: string; recipient: { name: string; country: string; label: string | null } }[];
};

/** What still stands between this person and moving money, in order. */
export function readiness(o: Overview) {
  if (o.profile.frozen) return { title: "Your account is on hold", body: "Contact support to unfreeze it.", href: "/app/help", cta: "Get help" };
  if (!o.profile.twoStep) return { title: "Turn on two-step sign-in", body: "Required to move money. It keeps your money safe even if your password leaks.", href: "/app/security", cta: "Turn it on" };
  if (o.profile.kycStatus !== "VERIFIED") return { title: o.profile.kycStatus === "PENDING" ? "Verification in progress" : "Verify your identity", body: "About two minutes with your ID and a selfie. Required by law to send money.", href: "/app/verify", cta: o.profile.kycStatus === "PENDING" ? "Check status" : "Verify now" };
  if (!o.profile.pinSet) return { title: "Create your 6-digit PIN", body: "You'll use it to confirm every payment.", href: "/app/security", cta: "Set PIN" };
  return null;
}

/** The confirm step for any money move: PIN always, plus an authenticator code when the server asks for one. */
export function ConfirmMoney({ open, onClose, title, summary, needCode, onConfirm }: { open: boolean; onClose: () => void; title: string; summary: React.ReactNode; needCode?: boolean; onConfirm: (pin: string, code?: string) => Promise<void> }) {
  const [pin, setPin] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setErr(null);
    try { await onConfirm(pin, code || undefined); setPin(""); setCode(""); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={title} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="pri" loading={busy} disabled={pin.length !== 6 || (needCode && code.length < 6)} onClick={go}><Lock className="h-4 w-4" />Confirm</Button></>}>
      <div className="space-y-4">
        <div className="rounded-[14px] bg-[#F7F8FA] p-4 text-[14px]">{summary}</div>
        <label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold"><KeyRound className="h-4 w-4" />Your 6-digit oenodpay PIN</span>
          <Input type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className="h-12 text-center font-mono text-xl tracking-[.5em]" autoFocus />
        </label>
        {needCode && <label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold"><ShieldCheck className="h-4 w-4" />Code from your authenticator app</span>
          <Input inputMode="numeric" autoComplete="one-time-code" maxLength={11} value={code} onChange={(e) => setCode(e.target.value.trim())} className="h-12 text-center font-mono text-xl tracking-[.3em]" />
        </label>}
        {err && <p className="rounded-xl bg-[#FFF5F7] px-3 py-2 text-[13px] text-crit">{err}</p>}
        <p className="flex items-center gap-1.5 text-[12px] text-[#667085]"><Lock className="h-3.5 w-3.5" />oenodpay staff will never ask for your PIN or codes.</p>
      </div>
    </Modal>
  );
}

/** Ask for an authenticator code only (adding a recipient, cards, unfreezing). */
export function CodePrompt({ open, onClose, title, onConfirm }: { open: boolean; onClose: () => void; title: string; onConfirm: (code: string) => Promise<void> }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal open={open} onClose={onClose} title={title} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="pri" loading={busy} disabled={code.length < 6} onClick={async () => { setBusy(true); setErr(null); try { await onConfirm(code); setCode(""); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } }}>Confirm</Button></>}>
      <p className="mb-3 text-[14px] text-[#667085]">For your security, enter the 6-digit code from your authenticator app.</p>
      <Input inputMode="numeric" autoComplete="one-time-code" maxLength={11} value={code} onChange={(e) => setCode(e.target.value.trim())} className="h-12 text-center font-mono text-xl tracking-[.3em]" autoFocus />
      {err && <p className="mt-3 rounded-xl bg-[#FFF5F7] px-3 py-2 text-[13px] text-crit">{err}</p>}
    </Modal>
  );
}

export function SetupBanner({ o }: { o: Overview }) {
  const r = readiness(o);
  if (!r) return null;
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[18px] border border-[#E7E9EF] bg-white p-4 ps-5 shadow-[0_1px_2px_rgba(16,24,40,.04)]">
      <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-[#0B1020] text-white"><ShieldCheck className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1"><b className="block text-[14px] font-semibold">{r.title}</b><small className="text-[13px] text-[#667085]">{r.body}</small></div>
      <Link href={r.href} className="btn-pri">{r.cta}</Link>
    </div>
  );
}

export function PageTitle({ title, sub, action, eyebrow }: { title: string; sub?: string; action?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="pay-label mb-2">{eyebrow}</div>}
        <h1 className="font-display text-[26px] font-semibold tracking-[-.025em] text-[#0B1020] sm:text-[30px]">{title}</h1>
        {sub && <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-[#667085]">{sub}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}

const STATUS: Record<string, [string, string]> = {
  DELIVERED: ["Delivered", "#12B76A"], COMPLETED: ["Completed", "#12B76A"], ACTIVE: ["Active", "#12B76A"], VERIFIED: ["Verified", "#12B76A"], RESOLVED: ["Resolved", "#12B76A"], APPROVED: ["Approved", "#12B76A"],
  SENT: ["Sent", "#2E5BFF"], PROCESSING: ["Processing", "#2E5BFF"], OPEN: ["Open", "#2E5BFF"], WAITING_CUSTOMER: ["Waiting on you", "#F79009"],
  REVIEW: ["In review", "#F79009"], PENDING: ["Pending", "#F79009"], INVITED: ["Invited", "#F79009"], PAUSED: ["Paused", "#98A2B3"], INACTIVE: ["Frozen", "#98A2B3"],
  FAILED: ["Failed", "#F04438"], REJECTED: ["Rejected", "#F04438"], DECLINED: ["Declined", "#F04438"], CANCELLED: ["Cancelled", "#98A2B3"], CANCELED: ["Cancelled", "#98A2B3"], REFUNDED: ["Refunded", "#98A2B3"],
};
/** A quiet status label: a coloured dot and a word. */
export function Status({ status, className }: { status: string; className?: string }) {
  const [label, color] = STATUS[status] ?? [status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " "), "#98A2B3"];
  return <span className={"inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#E7E9EF] bg-white px-2 py-[3px] text-[11.5px] font-medium text-[#344054] " + (className ?? "")}><i className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{label}</span>;
}

/** Money with smaller cents, for headline figures. */
export function BigMoney({ cents, currency, className }: { cents: number; currency: string; className?: string }) {
  const s = money(cents, currency);
  const m = s.match(/^(.*?)([.,]\d{2})(\D*)$/);
  return <span className={"pay-num " + (className ?? "")}>{m ? <>{m[1]}<span className="text-[.55em] font-medium text-current/60 align-[.55em] opacity-50">{m[2]}</span>{m[3]}</> : s}</span>;
}

/** ConfirmMoney that asks for the authenticator code by itself when the server wants one. */
export function PayConfirm({ open, onClose, title, summary, run }: { open: boolean; onClose: () => void; title: string; summary: React.ReactNode; run: (pin: string, code?: string) => Promise<void> }) {
  const [needCode, setNeedCode] = useState(false);
  return <ConfirmMoney open={open} onClose={() => { setNeedCode(false); onClose(); }} title={title} summary={summary} needCode={needCode} onConfirm={async (pin, code) => {
    try { await run(pin, code); setNeedCode(false); }
    catch (e: any) { if (e?.code === "STEP_UP_REQUIRED") { setNeedCode(true); throw new Error("Enter the code from your authenticator app to finish."); } throw e; }
  }} />;
}

export const Row = ({ k, v }: { k: React.ReactNode; v: React.ReactNode }) => <div className="flex justify-between gap-4 py-0.5"><span className="text-[#667085]">{k}</span><b className="text-end">{v}</b></div>;

/** Dollars typed by a person to cents. */
export const toCents = (s: string) => Math.round(Number(s.replace(/[^\d.]/g, "") || 0) * 100);
