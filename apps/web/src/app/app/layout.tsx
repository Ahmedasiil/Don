import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { loadSession } from "@/lib/session";
import { SessionProvider } from "@/components/session";
import { PayShell } from "./shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "oenodpay", template: "%s · oenodpay" } };

// The customer app: needs a signed-in person.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await loadSession();
  const path = (await headers()).get("x-pathname") ?? "/app";
  if (!s) redirect(`/signin?next=${encodeURIComponent(path)}`);
  return (
    <SessionProvider value={s}>
      <PayShell>{children}</PayShell>
    </SessionProvider>
  );
}
