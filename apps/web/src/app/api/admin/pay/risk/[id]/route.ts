import { z } from "zod";
import { body, HttpError, ok, requireSuperAdmin, route } from "@/lib/http";
import { db } from "@/lib/db";
import { adminAudit } from "@/lib/admin";

// Close a risk event. REPORTED means a suspicious transaction report was filed with FINTRAC (Canada) or FinCEN (US).
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireSuperAdmin();
  const { id } = await params;
  const d = await body(req, z.object({ status: z.enum(["CLEARED", "ESCALATED", "REPORTED"]), note: z.string().trim().min(3).max(2000) }));
  const e = await db.payRiskEvent.findUnique({ where: { id } });
  if (!e) throw new HttpError(404, "Not found.");
  const u = await db.payRiskEvent.update({ where: { id }, data: { status: d.status, note: d.note, reviewedBy: ctx.user.id, decidedAt: new Date() } });
  await adminAudit(ctx.user.id, `pay.risk_${d.status.toLowerCase()}`, "PayRiskEvent", id, { note: d.note });
  return ok(u);
});
