import { db } from "@/lib/db";
import { HttpError, ok, requireUser, route } from "@/lib/http";
import { audit } from "@/lib/audit";

// Sign out one device.
export const DELETE = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireUser();
  const id = (await params).id;
  const r = await db.session.updateMany({ where: { id, userId: ctx.user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (!r.count) throw new HttpError(404, "That device is already signed out.");
  await audit(ctx, "auth.session_revoked", "session", id);
  return ok({ ok: true, current: id === ctx.sessionId });
});
