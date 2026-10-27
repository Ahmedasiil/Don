import { db } from "@/lib/db";
import { clearSession, getCtx } from "@/lib/auth";
import { ok, route } from "@/lib/http";

export const POST = route(async () => {
  // Apps sign in with a bearer token rather than a cookie: end that session too.
  const ctx = await getCtx().catch(() => null);
  if (ctx?.sessionId) await db.session.updateMany({ where: { id: ctx.sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
  await clearSession();
  return ok({ ok: true });
});
