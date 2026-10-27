import { z } from "zod";
import { db } from "@/lib/db";
import { body, HttpError, ok, requireUser, route } from "@/lib/http";
import { audit } from "@/lib/audit";

export const GET = route(async () => {
  const ctx = await requireUser();
  const u = ctx.user;
  return ok({ name: u.name, email: u.email, phone: u.phone, avatarUrl: u.avatarUrl, locale: u.locale, marketingEmailConsent: u.marketingEmailConsent, marketingSmsConsent: u.marketingSmsConsent });
});

// Your own profile. Marketing consent is opt-in and can be withdrawn at any time (CASL).
export const PATCH = route(async (req: Request) => {
  const ctx = await requireUser();
  const d = await body(req, z.object({
    name: z.string().trim().min(2).max(100).optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    avatarUrl: z.string().url().max(500).nullable().optional(),
    marketingEmailConsent: z.boolean().optional(),
    marketingSmsConsent: z.boolean().optional(),
  }));
  // The legal name is fixed once identity is verified; support changes it with new ID.
  if (d.name && (await db.payProfile.findUnique({ where: { userId: ctx.user.id } }))?.kycStatus === "VERIFIED" && d.name !== ctx.user.name) throw new HttpError(409, "Your name is verified. Contact support to change it.");
  const consentChanged = d.marketingEmailConsent !== undefined || d.marketingSmsConsent !== undefined;
  const u = await db.user.update({ where: { id: ctx.user.id }, data: { ...d, ...(consentChanged ? { consentAt: new Date(), consentSource: "account settings" } : {}) } });
  if (consentChanged) await audit({ user: ctx.user, actor: "user" }, "account.consent_changed", "user", u.id, { email: u.marketingEmailConsent, sms: u.marketingSmsConsent });
  return ok({ ok: true });
});
