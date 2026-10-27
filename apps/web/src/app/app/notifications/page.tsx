"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ArrowDownLeft, ArrowUpRight, HandCoins, ShieldAlert, CreditCard, Receipt, LineChart, Landmark, Gift, Plane, Info, CheckCheck } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { ago } from "@/lib/format";
import { Button, Empty, Loading, cx } from "@/components/ui";
import { PageTitle } from "../bits";

type N = { id: string; kind: string; title: string; body: string | null; link: string | null; readAt: string | null; createdAt: string };
const ICON: Record<string, typeof Bell> = { MONEY_IN: ArrowDownLeft, MONEY_OUT: ArrowUpRight, REQUEST: HandCoins, SECURITY: ShieldAlert, CARD: CreditCard, BILL: Receipt, INVEST: LineChart, LOAN: Landmark, REWARD: Gift, TRAVEL: Plane, SYSTEM: Info };

export default function Notifications() {
  const router = useRouter();
  const { data, reload } = useApi<{ rows: N[]; unread: number }>("/api/pay/notices");
  const read = async (id?: string) => { await api("/api/pay/notices", { body: { id } }); reload(); router.refresh(); };
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="Notifications" sub="Money in and out, security alerts and updates on everything you do with oenodpay." action={data?.unread ? <Button onClick={() => read()}><CheckCheck className="h-4 w-4" />Mark all read</Button> : undefined} />
      {!data ? <Loading rows={6} /> : !data.rows.length ? <Empty icon={<Bell className="h-6 w-6" />} title="You're all caught up" body="We'll let you know when something happens." /> : (
        <div className="card divide-y divide-[#EEF0F4]">
          {data.rows.map((n) => {
            const I = ICON[n.kind] ?? Info;
            const inner = (
              <>
                <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-full", n.kind === "SECURITY" ? "bg-[#FEF3F2] text-[#B42318]" : "bg-[#F2F4F7] text-[#0B1020]")}><I className="h-[18px] w-[18px]" /></span>
                <span className="min-w-0 flex-1"><b className="block text-[14px] font-semibold">{n.title}</b>{n.body && <span className="block text-[13px] leading-snug text-[#475467]">{n.body}</span>}<small className="text-[12px] text-[#98A2B3]">{ago(n.createdAt)}</small></span>
                {!n.readAt && <i className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#2E5BFF]" aria-label="Unread" />}
              </>
            );
            return n.link ? <Link key={n.id} href={n.link} onClick={() => !n.readAt && read(n.id)} className="flex items-start gap-3 px-5 py-4 hover:bg-[#FAFBFC]">{inner}</Link> : <button key={n.id} onClick={() => !n.readAt && read(n.id)} className="flex w-full items-start gap-3 px-5 py-4 text-start hover:bg-[#FAFBFC]">{inner}</button>;
          })}
        </div>
      )}
    </div>
  );
}
