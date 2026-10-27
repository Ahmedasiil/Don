import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requirePay } from "@/lib/pay/guard";
import { applyForLoan, creditSummary, monthlyPayment } from "@/lib/pay/credit";

export const GET = route(async (req: Request) => {
  const ctx = await requirePay(req, { action: "credit" });
  const [s, loans] = await Promise.all([creditSummary(ctx.user.id), db.payLoan.findMany({ where: { userId: ctx.user.id }, orderBy: { createdAt: "desc" }, include: { payments: { orderBy: { dueAt: "asc" } } } })]);
  return ok({ ...s, loans: loans.map(({ decidedBy: _d, ...l }) => ({ ...l, payments: l.payments.map(({ journalRef: _j, ...p }) => p) })) });
});

// ?quote: price a loan without applying. Otherwise apply.
export const POST = route(async (req: Request) => {
  if (new URL(req.url).searchParams.has("quote")) {
    const ctx = await requirePay(req, { action: "credit" });
    const d = await body(req, z.object({ amountCents: z.number().int().positive(), termMonths: z.number().int().positive() }));
    const s = await creditSummary(ctx.user.id);
    if (!s.offer) return ok({ paymentCents: null });
    const pay = monthlyPayment(d.amountCents, s.offer.aprBps, d.termMonths);
    return ok({ paymentCents: pay, totalCents: pay * d.termMonths, aprBps: s.offer.aprBps });
  }
  const ctx = await requirePay(req, { money: true, action: "loan" });
  const d = await body(req, z.object({ amountCents: z.number().int().positive(), termMonths: z.number().int().positive(), purpose: z.string().max(200).optional(), pin: z.string().regex(/^\d{6}$/), code: z.string().max(12).optional() }));
  const l = await applyForLoan(ctx, d);
  return ok({ id: l.id, status: l.status }, 201);
});
