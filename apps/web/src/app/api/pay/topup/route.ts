import { z } from "zod";
import { body, HttpError, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requirePay, limitsFor } from "@/lib/pay/guard";
import { available } from "@/lib/pay/ledger";
import { topUpCheckout } from "@/lib/pay/providers/stripe";
import { BASE } from "@/lib/pay/config";
import { audit } from "@/lib/audit";

// Add money with a card on Stripe's secure page. The wallet is credited only by Stripe's signed webhook.
export const POST = route(async (req: Request) => {
  const ctx = await requirePay(req, { money: true, action: "topup" });
  const d = await body(req, z.object({ amountCents: z.number().int().min(1000).max(1_000_000), returnPath: z.string().regex(/^\/[a-z0-9/_-]*$/i).default("/app") }));
  const lim = await limitsFor(ctx);
  const { wallet } = await available(ctx.user.id);
  if (wallet.balanceCents + d.amountCents > lim.wallet) throw new HttpError(403, "That would take your wallet over its limit for your verification level.", { code: "LIMIT" });
  const pendingToday = await db.payTopUp.count({ where: { userId: ctx.user.id, createdAt: { gte: new Date(Date.now() - 86400_000) } } });
  if (pendingToday >= 10) throw new HttpError(429, "Too many top-ups today. Try again tomorrow.");
  const t = await db.payTopUp.create({ data: { userId: ctx.user.id, amountCents: d.amountCents, currency: BASE, stripeSessionId: `pending:${crypto.randomUUID()}` } });
  const s = await topUpCheckout({ userId: ctx.user.id, email: ctx.user.email, amountCents: d.amountCents, topUpId: t.id, returnPath: d.returnPath });
  await db.payTopUp.update({ where: { id: t.id }, data: { stripeSessionId: s.id } });
  await audit(ctx, "pay.topup_started", "PayTopUp", t.id, { amountCents: d.amountCents, ip: ctx.ip });
  return ok({ url: s.url });
});
