import { loadPlatformSettings } from "@/lib/platform-plugins";
import { db } from "@/lib/db";
import { safeEqual } from "@/lib/crypto";
import { expireTopUps, priceAlerts, rescreen, syncTransfers } from "@/lib/pay/cron";
import { settlePending } from "@/lib/pay/invest";
import { runDueBills } from "@/lib/pay/bills";
import { collectLoanPayments } from "@/lib/pay/credit";
import { clearRewards } from "@/lib/pay/rewards";

export const maxDuration = 300;

/**
 * Background jobs. Call every 5 minutes from your host's scheduler (Vercel Cron,
 * cron + curl, GitHub Actions...) with: Authorization: Bearer $CRON_SECRET
 */
export async function GET(req: Request) {
  await loadPlatformSettings();
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? new URL(req.url).searchParams.get("key") ?? "";
  if (!secret || !safeEqual(got, secret)) return new Response("Unauthorized", { status: 401 });
  const out: Record<string, unknown> = {};
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try { out[name] = await fn(); } catch (e) { out[name] = `error: ${e instanceof Error ? e.message : e}`; }
  };
  const hourly = new Date().getMinutes() < 5;
  await step("transferSync", syncTransfers);
  await step("priceAlerts", priceAlerts);
  await step("rescreen", async () => (hourly ? rescreen() : "hourly"));
  await step("topUpExpiry", expireTopUps);
  await step("tradeFills", settlePending);
  await step("billsDue", async () => (hourly ? runDueBills() : "hourly"));
  await step("loanPayments", async () => (hourly ? collectLoanPayments() : "hourly"));
  await step("rewardsClear", async () => (hourly ? clearRewards() : "hourly"));
  await step("requestExpiry", async () => (await db.payRequest.updateMany({ where: { status: "PENDING", expiresAt: { lt: new Date() } }, data: { status: "EXPIRED" } })).count);
  await step("sessionCleanup", async () => (hourly ? (await db.session.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 30 * 864e5) } } })).count : "hourly"));
  return Response.json({ ok: true, at: new Date().toISOString(), ...out });
}
