import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requirePay } from "@/lib/pay/guard";
import { send } from "@/lib/pay/transfers";

export const GET = route(async (req: Request) => {
  const ctx = await requirePay(req);
  const transfers = await db.payTransfer.findMany({ where: { userId: ctx.user.id }, orderBy: { createdAt: "desc" }, take: 100, include: { recipient: { select: { name: true, country: true, label: true, method: true } } } });
  return ok({ transfers: transfers.map(({ riskFlags: _r, ip: _i, reviewedBy: _b, idempotencyKey: _k, ...t }) => t) });
});

export const POST = route(async (req: Request) => {
  const ctx = await requirePay(req, { money: true, action: "send" });
  const d = await body(req, z.object({ recipientId: z.string().max(40), sendCents: z.number().int().min(500), pin: z.string().regex(/^\d{6}$/), code: z.string().max(12).optional(), idempotencyKey: z.string().min(16).max(80) }));
  const t = await send(ctx, d);
  return ok({ id: t.id, status: t.status, sendCents: t.sendCents, receiveCents: t.receiveCents, receiveCurrency: t.receiveCurrency, feeCents: t.feeCents }, 201);
});
