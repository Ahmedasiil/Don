import { Suspense } from "react";
import Link from "next/link";
import { Lock, ShieldCheck, Globe2, Fingerprint } from "lucide-react";

// Sign-in, sign-up and recovery: the form on the left, oenodpay's promise on the right.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-white lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] xl:grid-cols-[minmax(0,1fr)_620px]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Link href="/" aria-label="oenodpay home"><img src="/brand/oenodpay-logo.svg" alt="oenodpay" className="h-7 w-auto" /></Link>
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-10"><Suspense>{children}</Suspense></div>
        <p className="flex items-center justify-center gap-1.5 text-center text-[11.5px] text-muted"><Lock className="h-3 w-3" />Encrypted, with two-step sign-in and fraud checks on every payment. <Link href="/legal/privacy" className="underline">Privacy</Link> · <Link href="/legal/terms" className="underline">Terms</Link></p>
      </div>
      <aside className="relative hidden overflow-hidden bg-[#080B14] p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_85%_8%,rgba(46,91,255,.35),transparent),radial-gradient(45%_45%_at_0_100%,rgba(76,107,255,.18),transparent)]" />
        <div className="relative mt-auto">
          <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-white/50">Your money, everywhere</p>
          <h2 className="mt-3 text-balance font-display text-[40px] font-semibold leading-[1.05] tracking-[-.025em]">Send, spend, save and grow. In one secure app.</h2>
          <ul className="mt-8 space-y-3.5 text-[14.5px] text-white/75">
            {[[Globe2, "Send money to 150+ countries: banks, wallets, InstaPay and cash pickup"], [ShieldCheck, "Two-step sign-in, a payment PIN and fraud checks on every transfer"], [Fingerprint, "Identity verified in about two minutes with your ID and a selfie"]].map(([I, x]) => { const Icon = I as typeof Lock; return <li key={x as string} className="flex gap-3"><span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10"><Icon className="h-3.5 w-3.5" /></span>{x as string}</li>; })}
          </ul>
        </div>
        <img src="/brand/oenodpay-card.svg" alt="" className="relative mt-auto w-[78%] max-w-[420px] rotate-[-6deg] self-end drop-shadow-[0_30px_50px_rgba(0,0,0,.5)]" />
      </aside>
    </div>
  );
}
