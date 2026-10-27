"use client";
import { Snowflake } from "lucide-react";
import { cx } from "@/components/ui";

type Card = { last4: string; brand: string; type: string; status: string; expMonth: number; expYear: number };

/** The oenodpay card: brushed graphite metal for adults, deep cobalt for teen cards. */
export function CardFace({ c, name, teen }: { c: Card; name: string; teen?: boolean }) {
  const metal = teen
    ? "linear-gradient(135deg,#2A47F0 0%,#16249A 42%,#0B1259 100%)"
    : "linear-gradient(135deg,#2B2F3A 0%,#12141B 38%,#1C1F28 62%,#090A0F 100%)";
  return (
    <div className={cx("relative aspect-[1.586] w-full max-w-[380px] select-none overflow-hidden rounded-[20px] p-[22px] text-white shadow-[0_30px_60px_-28px_rgba(8,11,20,.65),0_2px_6px_rgba(8,11,20,.25)] ring-1 ring-white/10", c.status !== "ACTIVE" && "grayscale")} style={{ background: metal }}>
      <div className="pointer-events-none absolute inset-0 opacity-[.35]" style={{ background: "repeating-linear-gradient(90deg,rgba(255,255,255,.035) 0 1px,transparent 1px 3px)" }} />
      <div className="pointer-events-none absolute -end-1/4 -top-1/2 h-[140%] w-[70%] rotate-[18deg] bg-gradient-to-b from-white/[.10] to-transparent" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between">
          <img src="/brand/oenodpay-logo-white.svg" alt="oenodpay" className="h-[18px] opacity-95" />
          <span className="text-[10px] font-semibold uppercase tracking-[.18em] text-white/55">{teen ? "Teen" : c.type === "PHYSICAL" ? "Metal" : "Virtual"}</span>
        </div>
        <div className="mt-auto flex items-center gap-3">
          <span className="h-[30px] w-[40px] rounded-[6px] bg-[linear-gradient(135deg,#E9EDF5,#9AA3B5_55%,#D6DBE6)] opacity-90 ring-1 ring-black/10" />
          <svg viewBox="0 0 24 24" className="h-5 w-5 rotate-90 text-white/70" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8.5 14.5a4 4 0 0 1 0-5M12 17a8 8 0 0 0 0-10M15.5 19.5a12 12 0 0 0 0-15" /></svg>
        </div>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[12.5px] font-medium uppercase tracking-[.08em] text-white/90">{name}</div>
            <div className="mt-1 font-mono text-[13px] tracking-[.14em] text-white/70">•• {c.last4} <span className="ms-2 tracking-normal text-white/45">{String(c.expMonth).padStart(2, "0")}/{String(c.expYear).slice(-2)}</span></div>
          </div>
          <span className="font-display text-[22px] font-bold italic leading-none tracking-tight text-white/95">{c.brand.toUpperCase() === "MASTERCARD" ? "mastercard" : "VISA"}</span>
        </div>
      </div>
      {c.status !== "ACTIVE" && <span className="absolute inset-0 grid place-items-center bg-[#080B14]/55 backdrop-blur-[1px] font-display text-[15px] font-semibold"><span className="flex items-center gap-2"><Snowflake className="h-4 w-4" />{c.status === "CANCELED" ? "Cancelled" : "Frozen"}</span></span>}
    </div>
  );
}
