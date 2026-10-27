import { z } from "zod";
import { body, HttpError, ok, requireSuperAdmin, route } from "@/lib/http";
import { db } from "@/lib/db";
import { adminAudit } from "@/lib/admin";
import { BASE, cashbackBps, CASHBACK_CLEAR_DAYS, fmt, referralBonusCents } from "@/lib/pay/config";
import { notify } from "@/lib/pay/notices";

export const GET = route(async () => {
  await requireSuperAdmin();
  const month = new Date(Date.now() - 30 * 86400_000);
  const [totals, recent, referrals, pool] = await Promise.all([
    db.payReward.groupBy({ by: ["kind", "status"], _sum: { cents: true }, _count: true }),
    db.payReward.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    db.payReferredUser.count({ where: { createdAt: { gte: month } } }),
    db.payLedgerLine.aggregate({ where: { account: "rewards:pool" }, _sum: { amountCents: true } }),
  ]);
  const users = Object.fromEntries((await db.user.findMany({ where: { id: { in: [...new Set(recent.map((r) => r.userId))] } }, select: { id: true, name: true, email: true } })).map((u) => [u.id, u]));
  return ok({ currency: BASE, cashbackBps: cashbackBps(), referralBonusCents: referralBonusCents(), clearDays: CASHBACK_CLEAR_DAYS, totals, referrals30: referrals, paidOutCents: -(pool._sum.amountCents ?? 0), recent: recent.map((r) => ({ ...r, customer: users[r.userId] ?? null })) });
});

// A one-off bonus for a customer (goodwill, campaign), or reversing a reward that hasn't been redeemed.
export const POST = route(async (req: Request) => {
  const ctx = await requireSuperAdmin();
  const d = await body(req, z.discriminatedUnion("action", [
    z.object({ action: z.literal("bonus"), email: z.string().email(), cents: z.number().int().min(100).max(50_000), memo: z.string().trim().min(3).max(120) }),
    z.object({ action: z.literal("reverse"), id: z.string().max(40), memo: z.string().trim().min(3).max(120) }),
  ]));
  if (d.action === "bonus") {
    const u = await db.user.findUnique({ where: { email: d.email.toLowerCase() } });
    if (!u) throw new HttpError(404, "No customer with that email.");
    const r = await db.payReward.create({ data: { userId: u.id, kind: "BONUS", cents: d.cents, memo: d.memo, status: "AVAILABLE", reference: `bonus:${ctx.user.id}:${Date.now().toString(36)}`, availableAt: new Date() } });
    await notify(u.id, "REWARD", `You got a ${fmt(d.cents)} bonus`, d.memo, "/app/rewards");
    await adminAudit(ctx.user.id, "rewards.bonus", "PayReward", r.id, d);
    return ok(r, 201);
  }
  const r = await db.payReward.updateMany({ where: { id: d.id, status: { in: ["PENDING", "AVAILABLE"] } }, data: { status: "REVERSED", memo: d.memo } });
  if (!r.count) throw new HttpError(409, "Only rewards that haven't been moved to the wallet can be reversed.");
  await adminAudit(ctx.user.id, "rewards.reversed", "PayReward", d.id, d);
  return ok({ done: true });
});
