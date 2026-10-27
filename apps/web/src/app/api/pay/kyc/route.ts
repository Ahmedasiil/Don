import { z } from "zod";
import { body, HttpError, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requirePay } from "@/lib/pay/guard";
import { identitySession } from "@/lib/pay/providers/stripe";
import { audit } from "@/lib/audit";

// Start identity verification: ID document plus a live selfie on Stripe's secure page.
export const POST = route(async (req: Request) => {
  const ctx = await requirePay(req, { action: "kyc" });
  const d = await body(req, z.object({ returnPath: z.string().regex(/^\/[a-z0-9/_-]*$/i).default("/app/verify") }));
  if (ctx.profile.kycStatus === "VERIFIED") throw new HttpError(409, "You're already verified.");
  const recent = await db.auditLog.count({ where: { userId: ctx.user.id, action: "pay.kyc_started", createdAt: { gte: new Date(Date.now() - 86400_000) } } });
  if (recent >= 5) throw new HttpError(429, "Too many attempts today. Contact support if you're stuck.");
  const s = await identitySession(ctx.user.id, d.returnPath);
  await db.payProfile.update({ where: { id: ctx.profile.id }, data: { kycSessionId: s.id, kycStatus: "PENDING", kycProvider: "stripe_identity" } });
  await audit(ctx, "pay.kyc_started", "PayProfile", ctx.profile.id, { ip: ctx.ip });
  return ok({ url: s.url });
});
