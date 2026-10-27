import { db } from "@/lib/db";
import { ok, requireSuperAdmin, route } from "@/lib/http";
import { BASE } from "@/lib/pay/config";

// oenodpay at a glance for the super admin.
export const GET = route(async () => {
  await requireSuperAdmin();
  const day = new Date(Date.now() - 86400_000), month = new Date(Date.now() - 30 * 86400_000);
  const [profiles, verified, frozen, wallets, sent24, sent30, review, risks, fees, cards, esims, cases, recent, byCountry] = await Promise.all([
    db.payProfile.count(), db.payProfile.count({ where: { kycStatus: "VERIFIED" } }), db.payProfile.count({ where: { frozenAt: { not: null } } }),
    db.payWallet.aggregate({ where: { currency: BASE }, _sum: { balanceCents: true } }),
    db.payTransfer.aggregate({ where: { createdAt: { gte: day }, status: { in: ["PROCESSING", "SENT", "DELIVERED"] } }, _sum: { sendCents: true }, _count: true }),
    db.payTransfer.aggregate({ where: { createdAt: { gte: month }, status: { in: ["PROCESSING", "SENT", "DELIVERED"] } }, _sum: { sendCents: true, feeCents: true }, _count: true }),
    db.payTransfer.count({ where: { status: "REVIEW" } }), db.payRiskEvent.count({ where: { status: "OPEN" } }),
    db.payLedgerLine.aggregate({ where: { account: { startsWith: "revenue:" }, journal: { createdAt: { gte: month } } }, _sum: { amountCents: true } }),
    db.payCard.count({ where: { status: "ACTIVE" } }), db.payEsimOrder.count({ where: { status: "READY", createdAt: { gte: month } } }),
    db.supportCase.count({ where: { status: { in: ["WAITING_AGENT", "AI_HANDLING"] } } }),
    db.payTransfer.findMany({ orderBy: { createdAt: "desc" }, take: 15, include: { recipient: { select: { name: true, country: true, method: true } } } }),
    db.payTransfer.groupBy({ by: ["receiveCurrency"], where: { createdAt: { gte: month } }, _sum: { sendCents: true }, _count: true }),
  ]);
  return ok({
    currency: BASE,
    customers: { total: profiles, verified, frozen },
    walletsCents: wallets._sum.balanceCents ?? 0,
    sent24: { cents: sent24._sum.sendCents ?? 0, count: sent24._count },
    sent30: { cents: sent30._sum.sendCents ?? 0, count: sent30._count, feesCents: sent30._sum.feeCents ?? 0 },
    revenue30Cents: fees._sum.amountCents ?? 0,
    reviewQueue: review, openRisks: risks, activeCards: cards, esims30: esims, openCases: cases,
    recent: recent.map(({ ip: _i, ...t }) => t), corridors: byCountry.map((c) => ({ currency: c.receiveCurrency, cents: c._sum.sendCents ?? 0, count: c._count })),
  });
});
