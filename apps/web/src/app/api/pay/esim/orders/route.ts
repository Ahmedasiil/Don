import { ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requirePay } from "@/lib/pay/guard";

export const GET = route(async (req: Request) => {
  const ctx = await requirePay(req);
  return ok({ orders: await db.payEsimOrder.findMany({ where: { userId: ctx.user.id }, orderBy: { createdAt: "desc" }, take: 50 }) });
});
