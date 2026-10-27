import { z } from "zod";
import { body, HttpError, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requirePay, stepUp } from "@/lib/pay/guard";
import { cardholder, issueCard } from "@/lib/pay/providers/stripe";
import { audit } from "@/lib/audit";
import { address } from "@/lib/pay/schemas";

// A card for a teen, paid from the parent's wallet, with the parent's rules built into the card itself.
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requirePay(req, { money: true, action: "card" });
  const { id } = await params;
  const d = await body(req, z.object({ type: z.enum(["virtual", "physical"]), address: address.optional(), code: z.string().max(12).optional() }));
  const m = await db.payFamilyMember.findFirst({ where: { id, parentUserId: ctx.user.id } });
  if (!m) throw new HttpError(404, "Family member not found.");
  await stepUp(ctx, d.code, `give ${m.name} a card`);
  if (await db.payCard.count({ where: { familyId: id, status: { not: "CANCELED" } } })) throw new HttpError(409, `${m.name} already has a card.`);
  let ch = ctx.profile.stripeCardholderId;
  if (!ch) {
    if (!d.address) throw new HttpError(422, "Add your home address for the card.");
    ch = await cardholder({ name: ctx.profile.legalName ?? ctx.user.name, email: ctx.user.email, phone: ctx.user.phone, address: d.address, dob: ctx.profile.dob, userId: ctx.user.id });
    await db.payProfile.update({ where: { id: ctx.profile.id }, data: { stripeCardholderId: ch } });
  }
  const c = await issueCard({ cardholder: ch, type: d.type, controls: { weeklyLimitCents: m.weeklyLimitCents, perPurchaseCents: m.perPurchaseLimitCents, blockedCategories: m.blockedCategories }, metadata: { userId: ctx.user.id, familyId: m.id }, ...(d.type === "physical" && d.address ? { shipping: { name: m.name, address: d.address } } : {}) });
  const card = await db.payCard.create({ data: { userId: ctx.user.id, familyId: m.id, stripeCardId: c.id, type: d.type.toUpperCase(), last4: c.last4, brand: c.brand, expMonth: c.expMonth, expYear: c.expYear } });
  await audit(ctx, "pay.family_card", "PayCard", card.id, { member: m.id });
  return ok(card, 201);
});
