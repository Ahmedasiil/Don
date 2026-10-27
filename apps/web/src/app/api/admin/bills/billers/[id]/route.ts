import { body, ok, requireSuperAdmin, route } from "@/lib/http";
import { db } from "@/lib/db";
import { adminAudit } from "@/lib/admin";
import { billerSchema } from "@/lib/pay/bills";

export const PATCH = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireSuperAdmin();
  const { id } = await params;
  const d = await body(req, billerSchema.partial());
  const b = await db.payBiller.update({ where: { id }, data: d });
  await adminAudit(ctx.user.id, "bills.biller_updated", "PayBiller", id, d);
  return ok(b);
});
