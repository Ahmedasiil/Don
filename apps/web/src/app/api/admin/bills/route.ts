import { ok, requireSuperAdmin, route } from "@/lib/http";
import { db } from "@/lib/db";
import { BILL_CATEGORIES } from "@/lib/pay/bills";
import { decrypt } from "@/lib/crypto";

// Billers and the payments queue. PROCESSING payments are waiting for the team to pay the biller.
export const GET = route(async (req: Request) => {
  await requireSuperAdmin();
  const status = new URL(req.url).searchParams.get("status") ?? "PROCESSING";
  const [billers, payments, counts] = await Promise.all([
    db.payBiller.findMany({ orderBy: [{ country: "asc" }, { name: "asc" }], include: { _count: { select: { payees: true } } } }),
    db.payBillPayment.findMany({ where: status === "ALL" ? {} : { status }, orderBy: { scheduledFor: "asc" }, take: 200, include: { payee: { include: { biller: true } } } }),
    db.payBillPayment.groupBy({ by: ["status"], _count: true, _sum: { amountCents: true } }),
  ]);
  const users = Object.fromEntries((await db.user.findMany({ where: { id: { in: [...new Set(payments.map((p) => p.userId))] } }, select: { id: true, name: true, email: true } })).map((u) => [u.id, u]));
  return ok({
    categories: BILL_CATEGORIES, billers, counts,
    // The account number is shown in full only here, to the team that pays the bill.
    payments: payments.map(({ idempotencyKey: _k, payee: { accountEnc, ...payee }, ...p }) => ({ ...p, payee, account: status === "PROCESSING" ? decrypt(accountEnc) : null, customer: users[p.userId] ?? null })),
  });
});
