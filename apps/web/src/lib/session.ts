import { db } from "./db";
import { getCtx } from "./auth";

/** Everything the app shell needs about the signed-in person. Shared by /api/auth/me and the app layout. */
export async function loadSession() {
  const ctx = await getCtx();
  if (!ctx.user) return null;
  const unread = await db.payNotice.count({ where: { userId: ctx.user.id, readAt: null } }).catch(() => 0);
  const u = ctx.user;
  return {
    user: { id: u.id, name: u.name, email: u.email, phone: u.phone, isSuperAdmin: u.isSuperAdmin, avatarUrl: u.avatarUrl, locale: u.locale, twoFactor: !!u.totpEnabledAt },
    unread,
  };
}
export type Session = NonNullable<Awaited<ReturnType<typeof loadSession>>>;
