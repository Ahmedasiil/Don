import { z } from "zod";
import { body, ok, requireSuperAdmin, route } from "@/lib/http";
import { adminAudit } from "@/lib/admin";
import { settleBill } from "@/lib/pay/bills";

// The team paid the biller (with its confirmation number), or couldn't (the customer gets the money back).
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireSuperAdmin();
  const { id } = await params;
  const d = await body(req, z.discriminatedUnion("paid", [
    z.object({ paid: z.literal(true), confirmation: z.string().trim().min(3).max(60) }),
    z.object({ paid: z.literal(false), reason: z.string().trim().min(5).max(300) }),
  ]));
  await settleBill(ctx.user.id, id, d);
  await adminAudit(ctx.user.id, d.paid ? "bills.payment_paid" : "bills.payment_failed", "PayBillPayment", id, d);
  return ok({ id, status: d.paid ? "PAID" : "REFUNDED" });
});
