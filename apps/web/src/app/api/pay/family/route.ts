import { z } from "zod";
import { body, HttpError, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requirePay } from "@/lib/pay/guard";
import { TEEN_CATEGORIES } from "@/lib/pay/providers/stripe";
import { audit } from "@/lib/audit";
import { rules } from "@/lib/pay/schemas";


export const GET = route(async (req: Request) => {
  const ctx = await requirePay(req);
  const members = await db.payFamilyMember.findMany({ where: { parentUserId: ctx.user.id }, orderBy: { createdAt: "asc" } });
  const ids = members.map((m) => m.id);
  const [cards, events] = await Promise.all([
    db.payCard.findMany({ where: { familyId: { in: ids } } }),
    db.payCardEvent.findMany({ where: { familyId: { in: ids } }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const week = new Date(Date.now() - 7 * 86400_000);
  return ok({
    groups: TEEN_CATEGORIES.map(({ key, label, categories }) => ({ key, label, categories })),
    members: members.map((m) => ({ ...m, cards: cards.filter((c) => c.familyId === m.id), spentThisWeekCents: events.filter((e) => e.familyId === m.id && e.decision === "APPROVED" && e.createdAt >= week).reduce((s, e) => s + e.amountCents, 0), activity: events.filter((e) => e.familyId === m.id).slice(0, 20) })),
  });
});

export const POST = route(async (req: Request) => {
  const ctx = await requirePay(req, { money: true, action: "family" });
  const d = await body(req, rules.extend({ name: z.string().trim().min(2).max(60), birthYear: z.number().int().min(new Date().getFullYear() - 19).max(new Date().getFullYear() - 6), inviteEmail: z.string().email().optional() }));
  if ((await db.payFamilyMember.count({ where: { parentUserId: ctx.user.id } })) >= 6) throw new HttpError(409, "You can add up to 6 family members.");
  const { blockedGroups, ...r } = d;
  const blocked = TEEN_CATEGORIES.filter((g) => blockedGroups.includes(g.key)).flatMap((g) => g.categories);
  const m = await db.payFamilyMember.create({ data: { ...r, parentUserId: ctx.user.id, blockedCategories: blocked, status: "ACTIVE" } });
  await audit(ctx, "pay.family_added", "PayFamilyMember", m.id);
  return ok(m, 201);
});
