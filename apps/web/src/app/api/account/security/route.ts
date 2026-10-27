import { db } from "@/lib/db";
import { ok, requireUser, route } from "@/lib/http";

// My account → Security: two-step status, signed-in devices and recent sign-in activity.
export const GET = route(async () => {
  const ctx = await requireUser();
  const [sessions, events] = await Promise.all([
    db.session.findMany({ where: { userId: ctx.user.id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" }, select: { id: true, device: true, client: true, ip: true, mfa: true, createdAt: true, lastSeenAt: true } }),
    db.auditLog.findMany({ where: { userId: ctx.user.id, action: { startsWith: "auth." } }, orderBy: { createdAt: "desc" }, take: 30, select: { action: true, data: true, createdAt: true } }),
  ]);
  return ok({
    twoFactor: { enabled: Boolean(ctx.user.totpEnabledAt), since: ctx.user.totpEnabledAt, recoveryCodesLeft: ctx.user.recoveryCodes.length },
    passwordChangedAt: ctx.user.passwordChangedAt,
    sessions: sessions.map((s) => ({ ...s, current: s.id === ctx.sessionId })),
    activity: events,
  });
});
