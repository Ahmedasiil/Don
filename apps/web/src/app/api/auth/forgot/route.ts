import { z } from "zod";
import { db } from "@/lib/db";
import { body, clientIp, ok, route } from "@/lib/http";
import { sha256, token } from "@/lib/crypto";
import { emailLayout, sendEmail } from "@/lib/messaging";
import { APP_URL } from "@/lib/env";
import { limit } from "@/lib/ratelimit";

export const POST = route(async (req: Request) => {
  const { email } = await body(req, z.object({ email: z.string().trim().toLowerCase().email() }));
  if (limit(`forgot:${clientIp(req)}`, 5, 3600_000)) {
    const user = await db.user.findUnique({ where: { email } });
    if (user) {
      const t = token(32);
      await db.passwordReset.create({ data: { userId: user.id, tokenHash: sha256(t), expiresAt: new Date(Date.now() + 3600_000) } });
      await sendEmail({ to: email, subject: "Reset your oenodpay password", html: emailLayout({ title: "Reset your password", body: "Someone asked to reset the password for your oenodpay account. If that was you, use the button below within one hour. If not, you can ignore this email.", ctaLabel: "Choose a new password", ctaUrl: `${APP_URL}/reset?t=${t}` }) });
    }
  }
  return ok({ ok: true, message: "If that email has an account, a reset link is on its way." });
});
