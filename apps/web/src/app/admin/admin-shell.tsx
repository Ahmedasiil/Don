"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Plug, ScrollText, Menu, X, ArrowLeft, Headphones, ShieldAlert, Receipt, LineChart, Landmark, Gift, Plane, SlidersHorizontal } from "lucide-react";
import { cx } from "@/components/ui";

const NAV = [
  { group: "Run", items: [["/admin", "Overview", LayoutDashboard], ["/admin/customers", "Customers", Users], ["/admin/compliance", "Compliance (AML)", ShieldAlert], ["/admin/support", "Call center & support", Headphones]] },
  { group: "Products", items: [["/admin/bills", "Bill pay", Receipt], ["/admin/invest", "Investing", LineChart], ["/admin/credit", "Credit & loans", Landmark], ["/admin/rewards", "Rewards", Gift], ["/admin/travel", "Travel", Plane]] },
  { group: "Platform", items: [["/admin/settings", "Fees & limits", SlidersHorizontal], ["/admin/plugins", "Plugin centre", Plug], ["/admin/audit", "Audit log", ScrollText]] },
] as const;

const initials = (n: string) => n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

export function AdminShell({ user, children }: { user: { name: string; email: string }; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const on = (h: string) => (h === "/admin" ? path === h : path.startsWith(h));
  return (
    <div className="pay-ui min-h-dvh bg-[#F6F7F9] text-[#0B1020] lg:bg-[linear-gradient(to_right,#080B14_256px,#F6F7F9_256px)]">
      <aside className={cx("fixed inset-y-0 start-0 z-40 flex w-[256px] flex-col bg-[#080B14] text-white transition-transform lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full rtl:translate-x-full lg:rtl:translate-x-0")}>
        <div className="flex h-[72px] items-center justify-between px-6">
          <span className="flex items-center gap-2"><img src="/brand/oenodpay-logo-white.svg" alt="oenodpay" className="h-[22px] w-auto" /><span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider">Admin</span></span>
          <button className="text-white/60 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6 pt-2" aria-label="Admin">
          {NAV.map((g) => (
            <div key={g.group}>
              <div className="px-3 pb-2 text-[10.5px] font-semibold uppercase tracking-[.14em] text-white/35">{g.group}</div>
              {g.items.map(([href, label, I]) => (
                <Link key={href} href={href} aria-current={on(href) ? "page" : undefined}
                  className={cx("relative flex h-10 items-center gap-3 rounded-[10px] px-3 text-[13.5px] font-medium transition", on(href) ? "bg-white/[.08] text-white" : "text-white/60 hover:bg-white/[.04] hover:text-white")}>
                  {on(href) && <span className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-[#4C6BFF]" />}
                  <I className="h-[18px] w-[18px]" strokeWidth={1.8} />{label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="m-3 rounded-[14px] border border-white/[.08] bg-white/[.03] p-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[#4C6BFF] to-[#1B2A8A] font-display text-[12px] font-semibold">{initials(user.name)}</span>
            <div className="min-w-0 flex-1"><b className="block truncate text-[13px] font-semibold">{user.name}</b><span className="block truncate text-[11.5px] text-white/50">{user.email}</span></div>
          </div>
          <Link href="/app" className="mt-3 flex items-center gap-1.5 rounded-[9px] px-2 py-1.5 text-[12px] text-white/55 hover:bg-white/[.05] hover:text-white"><ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />Open the customer app</Link>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="lg:ps-[256px]">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-[#E7E9EF] bg-[#F6F7F9]/85 px-4 backdrop-blur-xl lg:hidden">
          <button className="grid h-10 w-10 place-items-center rounded-full border border-[#E2E5EC] bg-white" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <b className="font-display">Super admin</b>
        </header>
        <main className="mx-auto w-full max-w-[1320px] px-4 pb-24 pt-6 sm:px-8 lg:pt-8">{children}</main>
      </div>
    </div>
  );
}
