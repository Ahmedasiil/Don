import { z } from "zod";
import { db } from "@/lib/db";
import { body, HttpError, ok, requireUser, route } from "@/lib/http";
import { decrypt } from "@/lib/crypto";
import { checkTotp, newRecoveryCodes } from "@/lib/security";
import { audit } from "@/lib/audit";
import { emailLayout, sendEmail } from "@/lib/messaging";

// Step 2: confirm with a code from the app. Returns recovery codes, shown once.
export const POST = route(async (req: Request) => {
  const ctx = await requireUser();
  const d = await body(req, z.object({ code: z.string().min(6).max(8) }));
  if (ctx.user.totpEnabledAt) throw new HttpError(409, "Two-step sign-in is already on.");
  if (!ctx.user.totpSecret) throw new HttpError(400, "Start the setup first.");
  const s = checkTotp(decrypt(ctx.user.totpSecret)!, d.code);
  if (s === null) throw new HttpError(422, "That code didn't match. Make sure your phone's time is automatic and use the newest code.");
  const { codes, hashes } = newRecoveryCodes();
  await db.user.update({ where: { id: ctx.user.id }, data: { totpEnabledAt: new Date(), totpLastStep: s, recoveryCodes: hashes } });
  if (ctx.sessionId) await db.session.update({ where: { id: ctx.sessionId }, data: { mfa: true } });
  await audit(ctx, "auth.2fa_enabled");
  await sendEmail({ to: ctx.user.email, scope: "PLATFORM", idempotencyKey: `2fa-on:${ctx.user.id}:${s}`, subject: "Two-step sign-in is on", html: emailLayout({ title: "Two-step sign-in is on", body: "Your oenodpay account now asks for a code from your authenticator app when you sign in on a new device.\n\nKeep your recovery codes somewhere safe. If you didn't do this, reset your password right away." }) }).catch(() => {});
  return ok({ enabled: true, recoveryCodes: codes });
});
