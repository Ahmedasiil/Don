import { db } from "@/lib/db";
import { ok, requireSuperAdmin, route } from "@/lib/http";

// The support desk: every chat and phone call, the AI's handling, and what's waiting for a person.
export const GET = route(async (req: Request) => {
  await requireSuperAdmin();
  const q = new URL(req.url).searchParams;
  const status = q.get("status");
  const channel = q.get("channel");
  const where = { ...(status ? { status } : { status: { not: "RESOLVED" } }), ...(channel ? { channel } : {}) };
  const [cases, counts, today, csat] = await Promise.all([
    db.supportCase.findMany({ where, orderBy: [{ updatedAt: "desc" }], take: 200, include: { _count: { select: { messages: true } } } }),
    db.supportCase.groupBy({ by: ["status"], _count: true }),
    db.supportCase.groupBy({ by: ["channel"], where: { createdAt: { gte: new Date(Date.now() - 86400_000) } }, _count: true }),
    db.supportCase.aggregate({ where: { csat: { not: null }, createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } }, _avg: { csat: true } }),
  ]);
  const resolvedByAi = await db.supportCase.count({ where: { status: "RESOLVED", assigneeId: null, createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } } });
  const resolved = await db.supportCase.count({ where: { status: "RESOLVED", createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } } });
  const order = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 } as Record<string, number>;
  return ok({
    cases: cases.sort((a, b) => (order[a.priority] ?? 2) - (order[b.priority] ?? 2)),
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
    today: Object.fromEntries(today.map((c) => [c.channel, c._count])),
    csat: csat._avg.csat, aiResolutionRate: resolved ? resolvedByAi / resolved : null,
    phone: process.env.SUPPORT_PHONE ?? null,
  });
});
