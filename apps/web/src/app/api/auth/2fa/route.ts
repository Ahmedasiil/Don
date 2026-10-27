import { z } from "zod";
import { jwtVerify } from "jose";
import { db } from "@/lib/db";
import { body, clientIp, HttpError, ok, route } from "@/lib/http";
import { startSession } from "@/lib/auth";
import { limit } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";
import { verifySecondFactor } from "@/lib/security";
import { mfaSecret } from "@/lib/mfa-challenge";

// Second step of sign-in: the 6-digit code from the authenticator app, or a recovery code.
export const POST = route(async (req: Request) => {
  const d = await body(req, z.object({ challenge: z.string(), code: z.string().min(6).max(20) }));
  let sub: string, v: number;
  try {
    const { payload } = await jwtVerify(d.challenge, mfaSecret());
    if (payload.p !== "mfa" || !payload.sub) throw new Error();
    sub = payload.sub; v = Number(payload.v);
  } catch { throw new HttpError(401, "This sign-in took too long. Please enter your password again."); }
  if (!limit(`2fa:${sub}`, 6, 300_000)) throw new HttpError(429, "Too many codes tried. Wait 5 minutes and sign in again.");
  const user = await db.user.findUnique({ where: { id: sub } });
  if (!user || user.tokenVersion !== v || user.disabledAt) throw new HttpError(401, "Please sign in again.");
  if (!(await verifySecondFactor(user.id, d.code))) {
    await audit({ user, actor: "user", ip: clientIp(req) }, "auth.2fa_failed", undefined, undefined, { ip: clientIp(req) });
    throw new HttpError(401, "That code didn't work. Check the time on your phone and try the newest code.");
  }
  const s = await startSession(user, req, { mfa: true });
  await audit({ user, actor: "user", ip: clientIp(req) }, "auth.signin", "session", s.sessionId, { ip: clientIp(req), mfa: true });
  const fresh = await db.user.findUnique({ where: { id: user.id }, select: { recoveryCodes: true } });
  return ok({ token: s.token, user: { id: user.id, name: user.name, email: user.email, isSuperAdmin: user.isSuperAdmin }, recoveryCodesLeft: fresh?.recoveryCodes.length ?? 0, redirect: user.isSuperAdmin ? "/admin" : "/app" });
});
