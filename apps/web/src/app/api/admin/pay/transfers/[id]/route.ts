import { z } from "zod";
import { body, HttpError, ok, requireSuperAdmin, route } from "@/lib/http";
import { adminAudit } from "@/lib/admin";
import { decide } from "@/lib/pay/transfers";

// Approve sends the held money to the payout partner. Reject returns it, with the fee, to the customer.
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireSuperAdmin();
  const { id } = await params;
  const d = await body(req, z.object({ approve: z.boolean(), note: z.string().max(1000).optional() }));
  if (!d.approve && !d.note) throw new HttpError(422, "Add a note explaining the rejection.");
  const t = await decide(id, ctx.user.id, d.approve, d.note);
  await adminAudit(ctx.user.id, d.approve ? "pay.transfer_approved" : "pay.transfer_rejected", "PayTransfer", id, { note: d.note });
  return ok({ id: t.id, status: t.status });
});
