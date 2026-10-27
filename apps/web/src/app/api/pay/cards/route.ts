import { z } from "zod";
import { body, HttpError, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requirePay, stepUp } from "@/lib/pay/guard";
import { cardholder, issueCard } from "@/lib/pay/providers/stripe";
import { audit } from "@/lib/audit";
import { address } from "@/lib/pay/schemas";


export const GET = route(async (req: Request) => {
  const ctx = await requirePay(req);
  return ok({ cards: await db.payCard.findMany({ where: { userId: ctx.user.id }, orderBy: { createdAt: "desc" } }) });
});

/** Get a virtual card now, or a physical card by mail. */
export const POST = route(async (req: Request) => {
  const ctx = await requirePay(req, { money: true, action: "card" });
  const d = await body(req, z.object({ type: z.enum(["virtual", "physical"]), address: address.optional(), code: z.string().max(12).optional() }));
  await stepUp(ctx, d.code, "get a new card");
  if ((await db.payCard.count({ where: { userId: ctx.user.id, familyId: null, status: { not: "CANCELED" } } })) >= 3) throw new HttpError(409, "You can have up to 3 cards.");
  let ch = ctx.profile.stripeCardholderId;
  if (!ch) {
    if (!d.address) throw new HttpError(422, "Add your home address for the card.");
    ch = await cardholder({ name: ctx.profile.legalName ?? ctx.user.name, email: ctx.user.email, phone: ctx.user.phone, address: d.address, dob: ctx.profile.dob, userId: ctx.user.id });
    await db.payProfile.update({ where: { id: ctx.profile.id }, data: { stripeCardholderId: ch } });
  }
  const c = await issueCard({ cardholder: ch, type: d.type, metadata: { userId: ctx.user.id }, ...(d.type === "physical" && d.address ? { shipping: { name: ctx.profile.legalName ?? ctx.user.name, address: d.address } } : {}) });
  const card = await db.payCard.create({ data: { userId: ctx.user.id, stripeCardId: c.id, type: d.type.toUpperCase(), last4: c.last4, brand: c.brand, expMonth: c.expMonth, expYear: c.expYear } });
  await audit(ctx, "pay.card_issued", "PayCard", card.id, { type: d.type, ip: ctx.ip });
  return ok(card, 201);
});
