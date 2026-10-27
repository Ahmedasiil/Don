import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requirePay } from "@/lib/pay/guard";
import { BILL_CATEGORIES, payBill } from "@/lib/pay/bills";
import { billFee } from "@/lib/pay/config";

// Billers for the person's country, their saved payees, and their payments.
export const GET = route(async (req: Request) => {
  const ctx = await requirePay(req, { action: "bills" });
  const country = ctx.profile.country ?? "CA";
  const [billers, payees, payments] = await Promise.all([
    db.payBiller.findMany({ where: { active: true, country }, orderBy: [{ category: "asc" }, { name: "asc" }], select: { id: true, name: true, category: true, accountLabel: true, accountHint: true } }),
    db.payBillPayee.findMany({ where: { userId: ctx.user.id }, orderBy: { createdAt: "desc" }, select: { id: true, nickname: true, label: true, biller: { select: { name: true, category: true } } } }),
    db.payBillPayment.findMany({ where: { userId: ctx.user.id }, orderBy: [{ scheduledFor: "desc" }], take: 60, include: { payee: { select: { label: true, nickname: true } } } }),
  ]);
  return ok({ billers, payees, payments: payments.map(({ idempotencyKey: _k, journalRef: _j, ...p }) => p), categories: BILL_CATEGORIES, feeCents: billFee() });
});

export const POST = route(async (req: Request) => {
  const ctx = await requirePay(req, { money: true, action: "bill" });
  const d = await body(req, z.object({ payeeId: z.string().max(40), amountCents: z.number().int().min(100), date: z.string().max(10).optional(), repeat: z.enum(["MONTHLY"]).nullable().optional(), pin: z.string().regex(/^\d{6}$/), code: z.string().max(12).optional(), idempotencyKey: z.string().min(16).max(80) }));
  const p = await payBill(ctx, d);
  return ok({ id: p.id, status: p.status, scheduledFor: p.scheduledFor }, 201);
});
