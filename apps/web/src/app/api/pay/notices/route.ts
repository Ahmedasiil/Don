import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requirePay } from "@/lib/pay/guard";

export const GET = route(async (req: Request) => {
  const ctx = await requirePay(req, { action: "notices" });
  const [rows, unread] = await Promise.all([
    db.payNotice.findMany({ where: { userId: ctx.user.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.payNotice.count({ where: { userId: ctx.user.id, readAt: null } }),
  ]);
  return ok({ rows, unread });
});

// Mark one, or all, as read.
export const POST = route(async (req: Request) => {
  const ctx = await requirePay(req, { action: "notices" });
  const d = await body(req, z.object({ id: z.string().max(40).optional() }));
  await db.payNotice.updateMany({ where: { userId: ctx.user.id, readAt: null, ...(d.id ? { id: d.id } : {}) }, data: { readAt: new Date() } });
  return ok({ ok: true });
});
