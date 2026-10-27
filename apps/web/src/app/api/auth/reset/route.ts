import { z } from "zod";
import { db } from "@/lib/db";
import { body, clientIp, HttpError, ok, route } from "@/lib/http";
import { sha256 } from "@/lib/crypto";
import { hashPassword, startSession } from "@/lib/auth";
import { checkPassword } from "@/lib/security";
import { limit } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";

// A reset signs out every other device and clears any lockout.
export const POST = route(async (req: Request) => {
  if (!limit(`reset:${clientIp(req)}`, 10, 3600_000)) throw new HttpError(429, "Too many attempts. Try again later.");
  const d = await body(req, z.object({ token: z.string().min(10), password: z.string().min(10).max(200) }));
  const r = await db.passwordReset.findUnique({ where: { tokenHash: sha256(d.token) } });
  if (!r || r.usedAt || r.expiresAt < new Date()) throw new HttpError(400, "This reset link has expired. Request a new one.");
  const existing = await db.user.findUniqueOrThrow({ where: { id: r.userId } });
  if (existing.disabledAt) throw new HttpError(403, "This account has been disabled. Contact oenodpay support.");
  await checkPassword(d.password, { email: existing.email, name: existing.name });
  await db.passwordReset.update({ where: { id: r.id }, data: { usedAt: new Date() } });
  await db.passwordReset.updateMany({ where: { userId: r.userId, usedAt: null }, data: { usedAt: new Date() } });
  await db.session.updateMany({ where: { userId: r.userId, revokedAt: null }, data: { revokedAt: new Date() } });
  const user = await db.user.update({ where: { id: r.userId }, data: { passwordHash: await hashPassword(d.password), passwordChangedAt: new Date(), tokenVersion: { increment: 1 }, failedLogins: 0, lockedUntil: null } });
  await audit({ user, actor: "user" }, "auth.password_reset", undefined, undefined, { ip: clientIp(req) });
  // With two-step sign-in on, the person signs in again with their code instead of getting a session here.
  if (user.totpEnabledAt) return ok({ ok: true, redirect: "/signin" });
  await startSession(user, req);
  return ok({ ok: true, redirect: "/app" });
});
