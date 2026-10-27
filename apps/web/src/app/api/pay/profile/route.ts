import { ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requirePay } from "@/lib/pay/guard";

// Profile with verification status. Changes go through /api/account.
export const GET = route(async (req: Request) => {
  const ctx = await requirePay(req, { action: "profile" });
  const u = await db.user.findUniqueOrThrow({ where: { id: ctx.user.id }, select: { name: true, email: true, phone: true, avatarUrl: true, locale: true, marketingEmailConsent: true, marketingSmsConsent: true, createdAt: true } });
  const p = ctx.profile;
  return ok({ ...u, country: p.country, tier: p.tier, kycStatus: p.kycStatus, twoFactor: !!ctx.user.totpEnabledAt, pinSet: !!p.pinHash });
});
