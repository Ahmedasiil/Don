import { z } from "zod";
import { body, HttpError, ok, requireSuperAdmin, route } from "@/lib/http";
import { adminAudit } from "@/lib/admin";
import { decideLoan } from "@/lib/pay/credit";

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireSuperAdmin();
  const { id } = await params;
  const d = await body(req, z.object({ approve: z.boolean(), note: z.string().trim().max(500).optional() }));
  if (!d.approve && (!d.note || d.note.length < 5)) throw new HttpError(422, "Add the reason for declining. The customer sees it.");
  await decideLoan(ctx.user.id, id, d.approve, d.note);
  await adminAudit(ctx.user.id, d.approve ? "credit.loan_approved" : "credit.loan_declined", "PayLoan", id, { note: d.note });
  return ok({ id, status: d.approve ? "ACTIVE" : "DECLINED" });
});
