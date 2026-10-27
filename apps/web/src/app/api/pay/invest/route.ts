import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requirePay } from "@/lib/pay/guard";
import { buy, portfolio, sell, TRADABLE } from "@/lib/pay/invest";
import { tradeFee, TRADE_MIN_CENTS } from "@/lib/pay/config";

export const GET = route(async (req: Request) => {
  const ctx = await requirePay(req, { action: "invest" });
  const [p, trades] = await Promise.all([portfolio(ctx.user.id), db.payTrade.findMany({ where: { userId: ctx.user.id }, orderBy: { createdAt: "desc" }, take: 50 })]);
  return ok({ ...p, trades: trades.map(({ idempotencyKey: _k, providerRef: _r, ...t }) => ({ ...t, quantity: t.quantity == null ? null : Number(t.quantity) })), tradable: [...TRADABLE], minCents: TRADE_MIN_CENTS, feeExample: tradeFee(10_000) });
});

export const POST = route(async (req: Request) => {
  const ctx = await requirePay(req, { money: true, action: "trade" });
  const d = await body(req, z.object({ side: z.enum(["BUY", "SELL"]), symbol: z.string().max(20), amountCents: z.number().int().positive().optional(), all: z.boolean().optional(), pin: z.string().regex(/^\d{6}$/), code: z.string().max(12).optional(), idempotencyKey: z.string().min(16).max(80) }));
  const t = d.side === "BUY" ? await buy(ctx, { ...d, amountCents: d.amountCents ?? 0 }) : await sell(ctx, d);
  return ok({ id: t.id, status: t.status, side: t.side, symbol: t.symbol, amountCents: t.amountCents, feeCents: t.feeCents }, 201);
});
