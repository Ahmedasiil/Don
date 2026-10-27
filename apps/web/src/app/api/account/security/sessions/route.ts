import { db } from "@/lib/db";
import { ok, requireUser, route } from "@/lib/http";
import { audit } from "@/lib/audit";

// Sign out every other device.
export const DELETE = route(async () => {
  const ctx = await requireUser();
  const r = await db.session.updateMany({ where: { userId: ctx.user.id, revokedAt: null, ...(ctx.sessionId ? { id: { not: ctx.sessionId } } : {}) }, data: { revokedAt: new Date() } });
  await audit(ctx, "auth.signed_out_others", undefined, undefined, { count: r.count });
  return ok({ signedOut: r.count });
});
