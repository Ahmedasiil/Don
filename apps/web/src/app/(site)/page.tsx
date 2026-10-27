import Link from "next/link";
import type { Metadata } from "next";
import { Send, CreditCard, Receipt, TrendingUp, Gauge, Gift, Plane, Sparkles, ShieldCheck, Fingerprint, Lock, Snowflake, Globe2, Smartphone, ArrowRight, Check, Moon, Users } from "lucide-react";
import { getUser } from "@/lib/auth";

export const metadata: Metadata = { title: { absolute: "oenodpay: send, spend, save and grow your money" } };

const CORRIDORS = [["🇪🇬", "Egypt", "InstaPay, Vodafone Cash, bank"], ["🇮🇳", "India", "UPI, bank"], ["🇵🇭", "Philippines", "GCash, bank, cash pickup"], ["🇲🇽", "Mexico", "SPEI, cash pickup"], ["🇳🇬", "Nigeria", "Bank"], ["🇵🇰", "Pakistan", "Bank, mobile wallet"], ["🇸🇦", "Saudi Arabia", "Bank, STC Pay"], ["🇬🇧", "United Kingdom", "Bank"]];
const FEATURES = [
  { id: "send", icon: Send, title: "Send money worldwide", body: "Bank accounts, mobile wallets, InstaPay and cash pickup in 150+ countries. See the exact rate and fee before you pay, and track every step." },
  { id: "card", icon: CreditCard, title: "A card that pays you back", body: "Virtual card instantly, metal card in the mail. Freeze it in one tap, set limits, and earn cash back on every purchase." },
  { id: "bills", icon: Receipt, title: "Pay every bill", body: "Hydro, phone, internet, taxes and more. Schedule them or let them repeat every month so you never miss a due date." },
  { id: "grow", icon: TrendingUp, title: "Invest from $1", body: "Stocks, ETFs and crypto, with a halal filter. Buy and sell from your wallet in seconds and watch your portfolio live." },
  { icon: Gauge, title: "Credit score and loans", body: "Your oenodpay score updates daily and shows exactly how to raise it. A good score unlocks a fixed-rate personal loan." },
  { id: "travel", icon: Plane, title: "An AI travel agent", body: "Say where and when. It finds real flights and hotels, compares them, and you book with one tap. Add an eSIM for data abroad." },
  { icon: Gift, title: "Rewards and referrals", body: "Cash back on your card, plus a bonus for you and every friend who joins." },
  { icon: Users, title: "Family wallet", body: "Cards for your kids and teens with spending limits, allowances and real-time alerts." },
  { icon: Sparkles, title: "Oeno, your money coach", body: "Ask anything about your money. Oeno reads your spending and gives you a plan, in plain words." },
];
const SECURITY = [
  [Fingerprint, "Two-step sign-in, always", "Money can't move with a password alone. Every account uses an authenticator app."],
  [Lock, "PIN on every payment", "A 6-digit PIN confirms each payment, plus a fresh code for large amounts and new recipients."],
  [Smartphone, "New-device protection", "A new phone gets a lower limit for 24 hours, and you get an alert right away."],
  [Snowflake, "Freeze in one tap", "Lost your phone? Freeze your whole account and cards instantly, from any device."],
  [ShieldCheck, "Screened every time", "Every customer and recipient is checked against sanctions lists, and unusual activity is reviewed by a person."],
  [Globe2, "Encrypted end to end", "TLS in transit, AES-256 at rest, card numbers never touch our servers."],
] as const;

function Phone() {
  return (
    <div className="relative mx-auto w-[300px] rounded-[44px] border border-white/15 bg-[#0B1020] p-3 shadow-[0_40px_120px_-20px_rgba(46,91,255,.55)]">
      <div className="overflow-hidden rounded-[34px] bg-[#F6F7F9] text-[#0B1020]">
        <div className="bg-[#0B1020] px-5 pb-6 pt-8 text-white">
          <div className="flex items-center justify-between text-[11px] text-white/60"><span>Good morning, Sara</span><span className="rounded-full bg-white/10 px-2 py-0.5">CAD</span></div>
          <div className="mt-3 text-[11px] uppercase tracking-[.14em] text-white/50">Total balance</div>
          <div className="mt-1 font-display text-[34px] font-semibold tracking-tight">$12,480<span className="text-[18px] text-white/50">.32</span></div>
          <div className="mt-1 text-[12px] font-semibold text-[#32D583]">+$1,204.10 this month</div>
          <div className="mt-5 grid grid-cols-4 gap-2 text-center text-[10.5px]">{[[Send, "Send"], [Receipt, "Bills"], [TrendingUp, "Invest"], [Plane, "Travel"]].map(([I, l]: any) => <span key={l}><span className="mx-auto mb-1 grid h-10 w-10 place-items-center rounded-full bg-white/10"><I className="h-4 w-4" /></span>{l}</span>)}</div>
        </div>
        <div className="space-y-2 p-4">
          {[["🇪🇬", "Mom, Cairo", "Delivered · InstaPay", "−$400.00"], ["⚡", "Hydro One", "Paid · Monthly", "−$86.20"], ["📈", "Bought VOO", "Filled", "−$250.00"], ["🎁", "Cash back", "1% on card", "+$4.12"]].map(([e, t, s, a]) => (
            <div key={t} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#F2F4F7] text-[15px]">{e}</span><span className="flex-1"><b className="block text-[12.5px]">{t}</b><small className="text-[10.5px] text-[#667085]">{s}</small></span><b className={"text-[12.5px] " + (a.startsWith("+") ? "text-[#067647]" : "")}>{a}</b></div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function Home() {
  const user = await getUser().catch(() => null);
  const cta = user ? { href: user.isSuperAdmin ? "/admin" : "/app", label: "Open oenodpay" } : { href: "/signup", label: "Open your free account" };
  return (
    <main>
      <section className="relative overflow-hidden bg-[#080B14] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_10%,rgba(46,91,255,.35)_0%,transparent_60%),radial-gradient(40%_50%_at_0%_100%,rgba(76,107,255,.18)_0%,transparent_60%)]" />
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-14 px-4 pb-24 pt-16 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:pb-32 lg:pt-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[12px] font-semibold text-white/80"><span className="h-1.5 w-1.5 rounded-full bg-[#32D583]" />Now opening in Canada and the US</span>
            <h1 className="mt-6 font-display text-[44px] font-semibold leading-[1.02] tracking-[-.035em] sm:text-[64px]">All your money.<br /><span className="bg-gradient-to-r from-white to-[#9DB0FF] bg-clip-text text-transparent">One secure app.</span></h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-white/70">Send money home in minutes, spend with a card that pays you back, pay every bill, invest from $1, build your credit and book your next trip. With bank-grade security on every tap.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link href={cta.href} className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-semibold text-[#0B1020] hover:bg-white/90">{cta.label}<ArrowRight className="h-4 w-4" /></Link><a href="#send" className="inline-flex h-12 items-center rounded-full border border-white/20 px-6 text-[15px] font-semibold hover:bg-white/5">See how it works</a></div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-[13px] text-white/55">{["Free to open", "No monthly fee", "150+ countries", "Two-step security on every account"].map((t) => <span key={t} className="flex items-center gap-2"><Check className="h-4 w-4 text-[#32D583]" />{t}</span>)}</div>
          </div>
          <Phone />
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-4 py-24 sm:px-6">
        <div className="max-w-2xl"><span className="text-[12px] font-semibold uppercase tracking-[.16em] text-[#2E5BFF]">Everything in one place</span><h2 className="mt-3 font-display text-[36px] font-semibold leading-tight tracking-[-.025em] sm:text-[44px]">The whole of your financial life, finally in one app.</h2></div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{FEATURES.map((f) => (
          <article key={f.title} id={f.id} className="scroll-mt-24 rounded-[24px] border border-[#E7E9EF] bg-[#FAFBFC] p-7 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_20px_50px_-20px_rgba(16,24,40,.18)]">
            <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-[#0B1020] text-white"><f.icon className="h-5 w-5" /></span>
            <h3 className="mt-5 font-display text-[19px] font-semibold tracking-[-.01em]">{f.title}</h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-[#475467]">{f.body}</p>
          </article>
        ))}</div>
      </section>

      <section className="bg-[#F6F7F9]">
        <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2">
          <div><span className="text-[12px] font-semibold uppercase tracking-[.16em] text-[#2E5BFF]">Send money home</span><h2 className="mt-3 font-display text-[36px] font-semibold leading-tight tracking-[-.025em]">Fast, fair and fully tracked.</h2><p className="mt-4 text-[16px] leading-relaxed text-[#475467]">The real exchange rate with a small, clear margin. The fee is shown before you pay, never hidden in the rate. Most transfers arrive the same day.</p>
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-[#E7E9EF] bg-white p-4"><Moon className="h-5 w-5 text-[#12B76A]" /><p className="text-[14px] text-[#475467]">Halal options across the app: no interest on balances, a Shariah filter for investing.</p></div></div>
          <div className="grid grid-cols-2 gap-3">{CORRIDORS.map(([f, c, m]) => <div key={c} className="rounded-2xl border border-[#E7E9EF] bg-white p-4"><span className="text-2xl">{f}</span><b className="mt-2 block text-[14.5px]">{c}</b><small className="text-[12.5px] text-[#667085]">{m}</small></div>)}</div>
        </div>
      </section>

      <section id="security" className="scroll-mt-16 bg-[#080B14] text-white">
        <div className="mx-auto max-w-[1200px] px-4 py-24 sm:px-6">
          <div className="max-w-2xl"><span className="text-[12px] font-semibold uppercase tracking-[.16em] text-[#9DB0FF]">Security first</span><h2 className="mt-3 font-display text-[36px] font-semibold leading-tight tracking-[-.025em] sm:text-[44px]">Built like a vault. Feels like an app.</h2><p className="mt-4 text-[16px] leading-relaxed text-white/60">Eight layers stand between anyone and your money. You stay in control of every one.</p></div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{SECURITY.map(([I, t, b]) => <div key={t} className="rounded-[22px] border border-white/10 bg-white/[.03] p-6"><I className="h-6 w-6 text-[#9DB0FF]" /><h3 className="mt-4 font-display text-[17px] font-semibold">{t}</h3><p className="mt-2 text-[14px] leading-relaxed text-white/60">{b}</p></div>)}</div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-[1200px] scroll-mt-16 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-2xl text-center"><span className="text-[12px] font-semibold uppercase tracking-[.16em] text-[#2E5BFF]">Simple pricing</span><h2 className="mt-3 font-display text-[36px] font-semibold tracking-[-.025em]">Free to open. Clear fees when you use it.</h2></div>
        <div className="mx-auto mt-10 grid max-w-4xl gap-px overflow-hidden rounded-[24px] border border-[#E7E9EF] bg-[#E7E9EF] sm:grid-cols-2">
          {[["Account and virtual card", "Free"], ["Monthly fee", "None"], ["International transfer", "From $2.99, shown before you pay"], ["Card purchases", "Free, plus cash back"], ["Investing", "Small fee per order, shown before you buy"], ["Bill pay", "Free"], ["Flights and hotels", "Small service fee, included in the price"], ["Adding money by card", "Free"]].map(([k, v]) => <div key={k} className="flex items-center justify-between gap-4 bg-white px-6 py-4"><span className="text-[14.5px] text-[#475467]">{k}</span><b className="text-end text-[14.5px]">{v}</b></div>)}
        </div>
      </section>

      <section className="px-4 pb-24 sm:px-6">
        <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-[32px] bg-[#0B1020] px-6 py-16 text-center text-white sm:px-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_0%,rgba(46,91,255,.35)_0%,transparent_70%)]" />
          <div className="relative"><h2 className="font-display text-[34px] font-semibold tracking-[-.025em] sm:text-[44px]">Open your account in three minutes.</h2><p className="mx-auto mt-4 max-w-xl text-[16px] text-white/65">All you need is your phone and a government ID.</p><Link href={cta.href} className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 text-[15px] font-semibold text-[#0B1020] hover:bg-white/90">{cta.label}<ArrowRight className="h-4 w-4" /></Link></div>
        </div>
      </section>
    </main>
  );
}
