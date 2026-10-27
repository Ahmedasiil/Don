import { z } from "zod";
import { db } from "@/lib/db";
import { body, clientIp, HttpError, ok, route } from "@/lib/http";
import { hashPassword, startSession } from "@/lib/auth";
import { checkPassword } from "@/lib/security";
import { profileFor } from "@/lib/pay/guard";
import { recordReferral } from "@/lib/pay/rewards";
import { limit } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";

const Schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(10, "Use at least 10 characters").max(200),
  country: z.string().length(2).optional(),
  phone: z.string().max(30).optional(),
  marketingConsent: z.boolean().optional(),
  smsConsent: z.boolean().optional(),
  referral: z.string().max(40).optional(),
});

export const POST = route(async (req: Request) => {
  const ip = clientIp(req);
  if (!limit(`signup:${ip}`, 8, 3600_000)) throw new HttpError(429, "Too many sign-ups from this network. Try again later.");
  const d = await body(req, Schema);
  if (await db.user.findUnique({ where: { email: d.email } })) throw new HttpError(409, "An account with this email already exists. Sign in instead.");
  await checkPassword(d.password, { email: d.email, name: d.name });
  const isSuper = Boolean(process.env.SUPER_ADMIN_EMAIL && process.env.SUPER_ADMIN_EMAIL.toLowerCase() === d.email);
  const user = await db.user.create({
    data: {
      name: d.name, email: d.email, phone: d.phone || null, passwordHash: await hashPassword(d.password), passwordChangedAt: new Date(), isSuperAdmin: isSuper,
      marketingEmailConsent: Boolean(d.marketingConsent), marketingSmsConsent: Boolean(d.smsConsent && d.phone),
      consentAt: d.marketingConsent || d.smsConsent ? new Date() : null, consentSource: d.marketingConsent ? "signup-form" : null, lastSeenAt: new Date(),
    },
  });
  await profileFor(user.id);
  if (d.country) await db.payProfile.update({ where: { userId: user.id }, data: { country: d.country.toUpperCase() } });
  await recordReferral(user.id, d.referral);
  await audit({ user, actor: "user", ip }, "auth.signup", "User", user.id, { referral: d.referral });
  const { token } = await startSession(user, req);
  return ok({ token, mustEnable2fa: true, user: { id: user.id, name: user.name, email: user.email }, redirect: "/app" }, 201);
});
