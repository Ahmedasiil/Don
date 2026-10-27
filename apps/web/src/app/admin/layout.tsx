import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCtx } from "@/lib/auth";
import { AdminShell } from "./admin-shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Super admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCtx();
  const path = (await headers()).get("x-pathname") ?? "/admin";
  if (!ctx.user) redirect(`/signin?next=${encodeURIComponent(path)}`);
  // Hide that the console exists from everyone else.
  if (!ctx.user.isSuperAdmin) notFound();
  if (process.env.NODE_ENV === "production" && !ctx.user.totpEnabledAt && process.env.SUPER_ADMIN_ALLOW_NO_2FA !== "true" && true) redirect("/app/security?setup=2fa");
  return <AdminShell user={{ name: ctx.user.name, email: ctx.user.email }}>{children}</AdminShell>;
}
