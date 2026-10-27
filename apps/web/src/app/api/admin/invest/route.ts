import { ok, requireSuperAdmin, route } from "@/lib/http";
import { db } from "@/lib/db";
import { BASE } from "@/lib/pay/config";

// Trading at a glance: open orders, recent fills, and what customers hold in total (to match the broker account).
export const GET = route(async (req: Request) => {
  await requireSuperAdmin();
  const status = new URL(req.url).searchParams.get("status");
  const month = new Date(Date.now() - 30 * 86400_000);
  const [trades, holdings, volume, custody] = await Promise.all([
    db.payTrade.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 150 }),
    db.payHolding.groupBy({ by: ["symbol", "kind"], where: { quantity: { gt: 0 } }, _sum: { quantity: true, costCents: true }, _count: true }),
    db.payTrade.groupBy({ by: ["side"], where: { status: "FILLED", filledAt: { gte: month } }, _sum: { amountCents: true, feeCents: true }, _count: true }),
    db.payLedgerLine.aggregate({ where: { account: "custody:invest" }, _sum: { amountCents: true } }),
  ]);
  const users = Object.fromEntries((await db.user.findMany({ where: { id: { in: [...new Set(trades.map((t) => t.userId))] } }, select: { id: true, name: true, email: true } })).map((u) => [u.id, u]));
  return ok({
    currency: BASE, custodyCents: custody._sum.amountCents ?? 0, volume,
    holdings: holdings.map((h) => ({ symbol: h.symbol, kind: h.kind, quantity: Number(h._sum.quantity ?? 0), costCents: h._sum.costCents ?? 0, holders: h._count })),
    trades: trades.map(({ idempotencyKey: _k, ...t }) => ({ ...t, quantity: t.quantity == null ? null : Number(t.quantity), customer: users[t.userId] ?? null })),
  });
});
