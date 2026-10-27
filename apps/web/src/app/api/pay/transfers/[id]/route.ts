import { HttpError, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requirePay } from "@/lib/pay/guard";

export const GET = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requirePay(req);
  const { id } = await params;
  const t = await db.payTransfer.findFirst({ where: { id, userId: ctx.user.id }, include: { recipient: { select: { name: true, country: true, label: true, method: true, network: true } } } });
  if (!t) throw new HttpError(404, "Transfer not found.");
  const { riskFlags: _r, ip: _i, reviewedBy: _b, idempotencyKey: _k, ...out } = t;
  return ok(out);
});
