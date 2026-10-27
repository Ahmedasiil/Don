"use client";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";
import { Check, Loader2, X, AlertTriangle, Info } from "lucide-react";

export const cx = clsx;

// ---------- Buttons ----------
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "pri" | "blue" | "ghost" | "danger" | "default"; size?: "sm" | "md"; loading?: boolean };
export function Button({ variant = "default", size = "md", loading, className, children, disabled, ...p }: BtnProps) {
  const base = variant === "pri" ? "btn-pri" : variant === "blue" ? "btn-blue" : variant === "ghost" ? "btn-ghost" : variant === "danger" ? "btn-danger" : "btn";
  return (
    <button {...p} disabled={disabled || loading} className={cx(base, size === "sm" && "btn-sm", className)}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

/** Two-step button for destructive actions (the browser's confirm() is not used). */
export function ConfirmButton({ onConfirm, children, confirmLabel, variant = "danger", size = "sm", className }: { onConfirm: () => Promise<unknown> | unknown; children: React.ReactNode; confirmLabel?: string; variant?: BtnProps["variant"]; size?: BtnProps["size"]; className?: string }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!armed) return; const x = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(x); }, [armed]);
  if (!armed) return <Button size={size} variant={variant === "danger" ? "default" : variant} className={className} onClick={() => setArmed(true)}>{children}</Button>;
  return (
    <span className="inline-flex items-center gap-1">
      <Button size={size} variant={variant} loading={busy} onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); setArmed(false); } }}>{confirmLabel ?? "Yes"}</Button>
      <Button size={size} variant="ghost" onClick={() => setArmed(false)}>{"Cancel"}</Button>
    </span>
  );
}

// ---------- Form fields ----------
export function Field({ label, help, error, children, required, className }: { label?: React.ReactNode; help?: React.ReactNode; error?: string | null; children: React.ReactNode; required?: boolean; className?: string }) {
  return (
    <label className={cx("block min-w-0", className)}>
      {label && <span className="label">{label}{required && <span className="text-crit"> *</span>}</span>}
      {children}
      {error ? <span className="mt-1 block text-xs font-semibold text-crit">{error}</span> : help ? <span className="mt-1 block text-xs text-muted">{help}</span> : null}
    </label>
  );
}
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) => <input {...p} className={cx("input", p.className)} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx("input", p.className)} />;
export function Select({ options, placeholder, ...p }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: (string | { value: string; label: string })[]; placeholder?: string }) {
  return (
    <select {...p} className={cx("input appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%235E6785%22 stroke-width=%222.5%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:12px] bg-[position:right_12px_center] bg-no-repeat pe-8 rtl:bg-[position:left_12px_center]", p.className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => typeof o === "string" ? <option key={o} value={o}>{humanize(o)}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
export function Toggle({ checked, onChange, label, help, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: React.ReactNode; help?: React.ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <button id={id} type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
        className={cx("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50", checked ? "bg-navy" : "bg-[#D5DBEA]")}>
        <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "start-[22px]" : "start-0.5")} />
      </button>
      {(label || help) && <label htmlFor={id} className="min-w-0 cursor-pointer"><span className="block text-sm font-semibold">{label}</span>{help && <span className="block text-xs text-muted">{help}</span>}</label>}
    </div>
  );
}

// ---------- Display ----------
const TONES: Record<string, string> = {
  green: "bg-[#E7F7EF] text-ok", amber: "bg-[#FFF4DF] text-warn", red: "bg-[#FDECEF] text-crit", blue: "bg-sky text-navy", gray: "bg-bg text-muted", navy: "bg-navy text-white",
  ok: "bg-[#E7F7EF] text-ok", warn: "bg-[#FFF4DF] text-warn", crit: "bg-[#FDECEF] text-crit",
};
const STATUS_TONE: Record<string, keyof typeof TONES> = {
  ACTIVE: "green", PAID: "green", APPROVED: "green", DONE: "green", COMPLETED: "green", PUBLISHED: "green", WON: "green", VERIFIED: "green", ON_TRACK: "green", CONNECTED: "green", LIVE: "green", OPEN: "blue", MOVING: "green", RESOLVED: "green", ACCEPTED: "green", HIRED: "green",
  PENDING: "amber", SUBMITTED: "amber", REVIEW: "amber", NEEDS_APPROVAL: "amber", AT_RISK: "amber", PARTIAL: "amber", TRIALING: "amber", IDLE: "amber", DOING: "blue", IN_PROGRESS: "blue", SENT: "blue", SCHEDULED: "blue", ONBOARDING: "blue", NEGOTIATION: "blue", PROPOSAL: "blue", QUALIFIED: "blue", INTERVIEW: "blue", READ_ONLY: "amber",
  OVERDUE: "red", REJECTED: "red", FAILED: "red", BLOCKED: "red", OFF_TRACK: "red", PAST_DUE: "red", CANCELED: "red", CANCELLED: "gray", LOST: "red", ERROR: "red", CRITICAL: "red", HIGH: "red", URGENT: "red", REVOKED: "red", MAINTENANCE: "red",
};
export function Badge({ children, tone, status, className }: { children?: React.ReactNode; tone?: keyof typeof TONES; status?: string | null; className?: string }) {
  const tn = tone ?? (status ? STATUS_TONE[status] ?? "gray" : "gray");
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold", TONES[tn], className)}>{children ?? humanize(status ?? "")}</span>;
}
export function Card({ title, action, children, className, pad = true, eyebrow }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean; eyebrow?: React.ReactNode }) {
  return (
    <section className={cx("card min-w-0", pad && "p-5", className)}>
      {(title || action) && (
        <header className={cx("mb-4 flex items-center justify-between gap-3", !pad && "px-5 pt-5")}>
          <div className="min-w-0">{eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}{title && <h3 className="h3 truncate">{title}</h3>}</div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
export function Stat({ label, value, delta, hint, spark, tone }: { label: string; value: React.ReactNode; delta?: number | null; hint?: React.ReactNode; spark?: number[]; tone?: "warn" | "crit" }) {
  return (
    <div className="card relative min-w-0 overflow-hidden p-4 transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className={cx("mt-1 font-display text-[24px] font-semibold tabular-nums tracking-tight", tone === "crit" && "text-crit", tone === "warn" && "text-warn")}>{value}</div>
      <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px]">
        {delta != null && <span className={delta >= 0 ? "text-ok" : "text-crit"}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%</span>}
        {hint && <span className="text-muted">{hint}</span>}
      </div>
      {spark && spark.length > 1 && <Sparkline values={spark} className="absolute bottom-0 end-0 h-11 w-1/2 opacity-90" />}
    </div>
  );
}
export function Sparkline({ values, className, color = "#2342E0" }: { values: number[]; className?: string; color?: string }) {
  const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${40 - ((v - min) / (max - min || 1)) * 36}`).join(" ");
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className={className} aria-hidden>
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".22" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <polygon points={`0,40 ${pts} 100,40`} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
/** Simple, accessible bar + line chart for daily series. */
export function TrendChart({ data, bar, line, barLabel, lineLabel, format = (n) => String(n) }: { data: Record<string, any>[]; bar: string; line?: string; barLabel: string; lineLabel?: string; format?: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const maxB = Math.max(...data.map((d) => d[bar] ?? 0), 1);
  const maxL = line ? Math.max(...data.map((d) => d[line] ?? 0), 1) : 1;
  const w = 100 / Math.max(data.length, 1);
  const h = hover != null ? data[hover] : null;
  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap gap-4 text-xs font-semibold text-muted">
        <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-navy" />{barLabel}</span>
        {line && <span className="inline-flex items-center gap-2"><i className="h-0.5 w-3.5 rounded bg-blue" />{lineLabel}</span>}
        {h && <span className="ms-auto font-mono text-ink">{h.date}: {format(h[bar])}{line ? ` · ${h[line]}` : ""}</span>}
      </div>
      <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="h-56 w-full" onMouseLeave={() => setHover(null)} role="img" aria-label={barLabel}>
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1="0" x2="100" y1={50 * g} y2={50 * g} stroke="#E4E8F2" strokeWidth=".2" />)}
        {data.map((d, i) => {
          const bh = ((d[bar] ?? 0) / maxB) * 46;
          return <g key={i} onMouseEnter={() => setHover(i)}><rect x={i * w} y="0" width={w} height="50" fill="transparent" /><rect x={i * w + w * 0.18} y={50 - bh} width={w * 0.64} height={bh} rx=".6" fill={hover === i ? "#2342E0" : "#000F55"} opacity={hover == null || hover === i ? 1 : 0.55} /></g>;
        })}
        {line && <polyline fill="none" stroke="#2342E0" strokeWidth=".5" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 2 }} points={data.map((d, i) => `${i * w + w / 2},${50 - ((d[line] ?? 0) / maxL) * 44}`).join(" ")} />}
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-muted"><span>{data[0]?.date}</span><span>{data.at(-1)?.date}</span></div>
    </div>
  );
}
export function Avatar({ name, src, size = 32, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const hue = [...name].reduce((s, c) => s + c.charCodeAt(0), 0) % 4;
  const bg = ["#000F55", "#2342E0", "#0A0C17", "#1B34B8"][hue];
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img src={src} alt="" className={cx("shrink-0 rounded-[10px] object-cover", className)} style={{ width: size, height: size }} />;
  return <span className={cx("grid shrink-0 place-items-center rounded-[10px] font-bold text-white", className)} style={{ width: size, height: size, background: bg, fontSize: size * 0.36 }}>{ini}</span>;
}
export function Empty({ icon, title, body, action }: { icon?: React.ReactNode; title: string; body?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      {icon && <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-sky text-navy">{icon}</div>}
      <div className="font-display text-base font-semibold">{title}</div>
      {body && <p className="mt-1 max-w-md text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export const Spinner = ({ className = "h-5 w-5" }: { className?: string }) => <Loader2 className={cx("animate-spin text-blue", className)} />;
export function Loading({ rows = 4 }: { rows?: number }) {
  return <div className="space-y-2">{Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton h-12" style={{ opacity: 1 - i * 0.15 }} />)}</div>;
}
export function ErrorNote({ error, onRetry }: { error: { message: string } | null | undefined; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#F3C5CD] bg-[#FFF5F7] px-4 py-3 text-sm text-crit">
      <AlertTriangle className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1">{error.message}</span>
      {onRetry && <Button size="sm" onClick={onRetry}>{"Try again"}</Button>}
    </div>
  );
}
export function Callout({ tone = "info", children, title }: { tone?: "info" | "warn" | "ok"; children: React.ReactNode; title?: string }) {
  const c = tone === "warn" ? "border-[#F5DDAF] bg-[#FFF9EC] text-[#7A4B00]" : tone === "ok" ? "border-[#BFE8D3] bg-[#EEFAF4] text-[#09653F]" : "border-[#D6DEFF] bg-sky/60 text-navy";
  const I = tone === "warn" ? AlertTriangle : tone === "ok" ? Check : Info;
  return <div className={cx("flex gap-3 rounded-xl border px-4 py-3 text-sm", c)}><I className="mt-0.5 h-4 w-4 shrink-0" /><div className="min-w-0">{title && <b className="block">{title}</b>}{children}</div></div>;
}

export function PageHeader({ title, sub, eyebrow, actions }: { title: React.ReactNode; sub?: React.ReactNode; eyebrow?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h1 className="h1 text-balance">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { key: T; label: React.ReactNode; count?: number }[]; value: T; onChange: (k: T) => void }) {
  return (
    <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-paper p-1" role="tablist">
      {tabs.map((t) => (
        <button key={t.key} role="tab" aria-selected={value === t.key} onClick={() => onChange(t.key)}
          className={cx("inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition", value === t.key ? "bg-ink text-white" : "text-muted hover:text-ink")}>
          {t.label}{t.count != null && <span className={cx("rounded-full px-1.5 font-mono text-[10px]", value === t.key ? "bg-white/20" : "bg-bg")}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---------- Overlays ----------
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    ref.current?.querySelector<HTMLElement>("input,select,textarea,button")?.focus();
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-ink/40 backdrop-blur-[2px] sm:place-items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal className={cx("flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-paper shadow-lift sm:rounded-3xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")} style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4"><h2 className="h2 min-w-0 truncate">{title}</h2><button className="btn-ghost btn-sm" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button></header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">{footer}</footer>}
      </div>
    </div>
  );
}

// ---------- Toasts ----------
type Toast = { id: number; text: string; tone: "ok" | "err" | "info" };
const ToastCtx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, text, tone }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className={cx("pointer-events-auto flex max-w-md animate-rise items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-lift", i.tone === "err" ? "bg-crit text-white" : i.tone === "info" ? "bg-paper text-ink" : "bg-ink text-white")}>
            {i.tone === "err" ? <AlertTriangle className="h-4 w-4" /> : <Check className="h-4 w-4" />}{i.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ---------- Helpers ----------
export function humanize(s: string) {
  if (!s) return "";
  if (/[a-z]/.test(s)) return s;
  return s.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
