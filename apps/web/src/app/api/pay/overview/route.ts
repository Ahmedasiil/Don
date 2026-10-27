import { ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requirePay, limitsFor } from "@/lib/pay/guard";
import { activity, available } from "@/lib/pay/ledger";
import { healthScore } from "@/lib/pay/ai";
import { BASE } from "@/lib/pay/config";

// Everything the Pay home screen needs in one call.
export const GET = route(async (req: Request) => {
  const ctx = await requirePay(req);
  const [bal, recent, health, cards, family, transfers, limits] = await Promise.all([
    available(ctx.user.id), activity(ctx.user.id, 20), healthScore(ctx.user.id),
    db.payCard.findMany({ where: { userId: ctx.user.id, familyId: null }, orderBy: { createdAt: "desc" } }),
    db.payFamilyMember.count({ where: { parentUserId: ctx.user.id } }),
    db.payTransfer.findMany({ where: { userId: ctx.user.id }, orderBy: { createdAt: "desc" }, take: 5, include: { recipient: { select: { name: true, country: true, label: true } } } }),
    limitsFor(ctx),
  ]);
  const p = ctx.profile;
  return ok({
    currency: BASE, balanceCents: bal.wallet.balanceCents, availableCents: bal.availableCents,
    profile: { tier: p.tier, kycStatus: p.kycStatus, name: p.legalName, country: p.country, frozen: !!p.frozenAt, pinSet: !!p.pinHash, twoStep: !!ctx.user.totpEnabledAt },
    limits, health, recent, cards, familyCount: family, transfers: transfers.map(({ riskFlags: _r, ip: _i, reviewedBy: _b, idempotencyKey: _k, ...t }) => t),
  });
});
