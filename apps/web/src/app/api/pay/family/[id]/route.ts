import { z } from "zod";
import { body, HttpError, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requirePay } from "@/lib/pay/guard";
import { categoriesFor, setCardControls, setCardStatus } from "@/lib/pay/providers/stripe";
import { audit } from "@/lib/audit";
import { rules } from "@/lib/pay/schemas";

async function mine(userId: string, id: string) {
  const m = await db.payFamilyMember.findFirst({ where: { id, parentUserId: userId } });
  if (!m) throw new HttpError(404, "Family member not found.");
  return m;
}

/** Change a teen's rules. Card-network limits are updated at Stripe too, so they hold even if our server is down. */
export const PATCH = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requirePay(req, { action: "family" });
  const { id } = await params;
  await mine(ctx.user.id, id);
  const d = await body(req, rules.partial().extend({ status: z.enum(["ACTIVE", "PAUSED"]).optional(), name: z.string().trim().min(2).max(60).optional() }));
  const { blockedGroups, ...r } = d;
  const m = await db.payFamilyMember.update({ where: { id }, data: { ...r, ...(blockedGroups ? { blockedCategories: categoriesFor(blockedGroups) } : {}) } });
  const cards = await db.payCard.findMany({ where: { familyId: id, status: { not: "CANCELED" } } });
  for (const c of cards) {
    await setCardControls(c.stripeCardId, { weeklyLimitCents: m.weeklyLimitCents, perPurchaseCents: m.perPurchaseLimitCents, blockedCategories: m.blockedCategories });
    if (d.status) { await setCardStatus(c.stripeCardId, d.status === "ACTIVE" ? "active" : "inactive"); await db.payCard.update({ where: { id: c.id }, data: { status: d.status === "ACTIVE" ? "ACTIVE" : "FROZEN" } }); }
  }
  await audit(ctx, "pay.family_rules", "PayFamilyMember", id, d);
  return ok(m);
});

export const DELETE = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requirePay(req, { action: "family" });
  const { id } = await params;
  await mine(ctx.user.id, id);
  for (const c of await db.payCard.findMany({ where: { familyId: id, status: { not: "CANCELED" } } })) {
    await setCardStatus(c.stripeCardId, "canceled").catch(() => {});
    await db.payCard.update({ where: { id: c.id }, data: { status: "CANCELED" } });
  }
  await db.payFamilyMember.update({ where: { id }, data: { status: "PAUSED" } });
  await audit(ctx, "pay.family_removed", "PayFamilyMember", id);
  return ok({ removed: true });
});
