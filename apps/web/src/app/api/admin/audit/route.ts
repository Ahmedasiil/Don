import { ok, requireSuperAdmin, route } from "@/lib/http";
import { db } from "@/lib/db";

// The audit trail: every security event, money action and admin decision.
export const GET = route(async (req: Request) => {
  await requireSuperAdmin();
  const u = new URL(req.url).searchParams;
  const q = u.get("q")?.trim();
  const who = u.get("actor");
  const before = u.get("before");
  const rows = await db.auditLog.findMany({
    where: { ...(q ? { action: { contains: q, mode: "insensitive" } } : {}), ...(who === "admin" ? { actor: "super-admin" } : {}), ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
    orderBy: { createdAt: "desc" }, take: 100,
  });
  const users = Object.fromEntries((await db.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.userId).filter(Boolean) as string[])] } }, select: { id: true, name: true, email: true } })).map((x) => [x.id, x]));
  return ok({ rows: rows.map((r) => ({ ...r, user: r.userId ? users[r.userId] ?? null : null })) });
});
