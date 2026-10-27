import { ok, requireSuperAdmin, route } from "@/lib/http";
import { db } from "@/lib/db";
import { BASE, LOAN_BANDS, lendingOn } from "@/lib/pay/config";

// Loans: applications to decide, the active book, and how much lending capital is out.
export const GET = route(async (req: Request) => {
  await requireSuperAdmin();
  const status = new URL(req.url).searchParams.get("status") ?? "REVIEW";
  const [loans, book, capital, scores] = await Promise.all([
    db.payLoan.findMany({ where: status === "ALL" ? {} : { status }, orderBy: { createdAt: "desc" }, take: 150 }),
    db.payLoan.groupBy({ by: ["status"], _count: true, _sum: { balanceCents: true, principalCents: true } }),
    db.payLedgerLine.aggregate({ where: { account: "lending:capital" }, _sum: { amountCents: true } }),
    db.payCreditScore.groupBy({ by: ["band"], _count: true, where: { createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } } }),
  ]);
  const users = Object.fromEntries((await db.user.findMany({ where: { id: { in: [...new Set(loans.map((l) => l.userId))] } }, select: { id: true, name: true, email: true, createdAt: true } })).map((u) => [u.id, u]));
  return ok({ currency: BASE, lendingOn: lendingOn(), bands: LOAN_BANDS, book, capitalOutCents: -(capital._sum.amountCents ?? 0), scores, loans: loans.map((l) => ({ ...l, customer: users[l.userId] ?? null })) });
});
