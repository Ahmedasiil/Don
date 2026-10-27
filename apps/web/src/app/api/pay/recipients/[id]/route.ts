import { HttpError, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requirePay } from "@/lib/pay/guard";
import { audit } from "@/lib/audit";

// Recipients with transfers stay on record (AML retention); they are hidden by renaming the label only.
export const DELETE = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requirePay(req);
  const { id } = await params;
  const r = await db.payRecipient.findFirst({ where: { id, userId: ctx.user.id }, include: { _count: { select: { transfers: true } } } });
  if (!r) throw new HttpError(404, "Recipient not found.");
  if (r._count.transfers) await db.payRecipient.update({ where: { id }, data: { userId: `removed:${ctx.user.id}` } });
  else await db.payRecipient.delete({ where: { id } });
  await audit(ctx, "pay.recipient_removed", "PayRecipient", id);
  return ok({ removed: true });
});
