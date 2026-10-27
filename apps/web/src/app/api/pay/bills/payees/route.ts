import { z } from "zod";
import { body, HttpError, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requirePay } from "@/lib/pay/guard";
import { addPayee } from "@/lib/pay/bills";

export const POST = route(async (req: Request) => {
  const ctx = await requirePay(req, { action: "bill-payee" });
  const d = await body(req, z.object({ billerId: z.string().max(40), account: z.string().min(4).max(40), nickname: z.string().max(40).optional() }));
  const p = await addPayee(ctx, d);
  return ok({ id: p.id, label: p.label }, 201);
});

export const DELETE = route(async (req: Request) => {
  const ctx = await requirePay(req, { action: "bill-payee" });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const p = await db.payBillPayee.findFirst({ where: { id, userId: ctx.user.id }, include: { payments: { where: { status: { in: ["SCHEDULED", "PROCESSING"] } }, select: { id: true } } } });
  if (!p) throw new HttpError(404, "Payee not found.");
  if (p.payments.length) throw new HttpError(409, "Cancel this payee's upcoming payments first.");
  await db.payBillPayment.deleteMany({ where: { payeeId: p.id, status: { in: ["CANCELLED"] } } }).catch(() => {});
  const used = await db.payBillPayment.count({ where: { payeeId: p.id } });
  if (used) throw new HttpError(409, "This payee has payment history, so it stays for your records.");
  await db.payBillPayee.delete({ where: { id: p.id } });
  return ok({ ok: true });
});
