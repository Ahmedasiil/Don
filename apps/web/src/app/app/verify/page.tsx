"use client";
import { useState } from "react";
import { BadgeCheck, IdCard, ScanFace, Clock, ShieldCheck } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { Button, Loading, useToast } from "@/components/ui";
import { PageTitle, type Overview } from "../bits";

export default function Verify() {
  const toast = useToast();
  const { data: o, reload } = useApi<Overview>("/api/pay/overview", { refreshMs: 10_000 });
  const [busy, setBusy] = useState(false);
  if (!o) return <Loading rows={4} />;
  const s = o.profile.kycStatus;
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="Verify your identity" sub="Required by law before you can send money (FINTRAC in Canada, FinCEN in the US). It takes about two minutes." />
      {s === "VERIFIED" ? (
        <div className="card grid place-items-center gap-3 p-10 text-center"><BadgeCheck className="h-14 w-14 text-[#1FAF6B]" /><h2 className="font-display text-[22px] font-semibold text-[#0B1020]">You're verified</h2><p className="text-[#667085]">{o.profile.name} · level {o.profile.tier}</p></div>
      ) : s === "PENDING" || s === "REVIEW" ? (
        <div className="card grid place-items-center gap-3 p-10 text-center"><Clock className="h-12 w-12 text-[#2E5BFF]" /><h2 className="font-display text-[22px] font-semibold text-[#0B1020]">{s === "REVIEW" ? "A person is checking your details" : "Checking your documents"}</h2><p className="max-w-md text-[#667085]">This page updates by itself. Most checks finish in a few minutes.</p><Button size="sm" onClick={() => reload()}>Refresh</Button></div>
      ) : (
        <div className="card space-y-5 p-6">
          {s === "REJECTED" && <p className="rounded-xl bg-[#FFF5F7] px-3 py-2 text-[13.5px] text-crit">We couldn't verify your last attempt. Use a valid, unexpired ID in good light and try again.</p>}
          <ol className="space-y-4">
            {[[IdCard, "Photo of your ID", "Passport, driver's licence or national ID card."], [ScanFace, "A quick selfie", "We match it to your ID photo and check it's really you, live."], [ShieldCheck, "Done", "Your images are stored by our verification partner, Stripe, never in the oenodpay app."]].map(([I, t, b], i) => { const Icon = I as typeof IdCard; return <li key={i} className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F2F4F7] text-[#2E5BFF]"><Icon className="h-5 w-5" /></span><div><b className="block text-[14.5px]">{t as string}</b><small className="text-[#667085]">{b as string}</small></div></li>; })}
          </ol>
          <Button variant="pri" className="h-12 w-full" loading={busy} onClick={async () => { setBusy(true); try { const r = await api<{ url: string }>("/api/pay/kyc", { body: { returnPath: "/app/verify" } }); location.href = r.url; } catch (e: any) { toast(e.message, "err"); setBusy(false); } }}>Start verification</Button>
        </div>
      )}
    </div>
  );
}
