import { z } from "zod";
import { db } from "@/lib/db";
import { body, HttpError, ok, requireUser, route } from "@/lib/http";
import { verifyPassword } from "@/lib/auth";
import { verifySecondFactor } from "@/lib/security";
import { audit } from "@/lib/audit";
import { emailLayout, sendEmail } from "@/lib/messaging";

// Turning it off needs the password and a current code. Super admins can't turn it off, and without it money can't move.
export const POST = route(async (req: Request) => {
  const ctx = await requireUser();
  const d = await body(req, z.object({ password: z.string().min(1), code: z.string().min(6).max(20) }));
  if (!ctx.user.totpEnabledAt) return ok({ enabled: false });
  if (ctx.user.isSuperAdmin) throw new HttpError(403, "Super admin accounts must keep two-step sign-in on. You can move it to a new phone by resetting it with a recovery code.");
  if (!ctx.user.passwordHash || !(await verifyPassword(d.password, ctx.user.passwordHash))) throw new HttpError(401, "That password isn't right.");
  if (!(await verifySecondFactor(ctx.user.id, d.code))) throw new HttpError(401, "That code didn't work.");
  await db.user.update({ where: { id: ctx.user.id }, data: { totpEnabledAt: null, totpSecret: null, totpLastStep: null, recoveryCodes: [] } });
  await audit(ctx, "auth.2fa_disabled");
  await sendEmail({ to: ctx.user.email, scope: "PLATFORM", idempotencyKey: `2fa-off:${ctx.user.id}:${Date.now()}`, subject: "Two-step sign-in was turned off", html: emailLayout({ title: "Two-step sign-in was turned off", body: "Two-step sign-in was just turned off for your oenodpay account. Money can't move until it's back on. If this wasn't you, reset your password and turn it back on now." }) }).catch(() => {});
  return ok({ enabled: false });
});
