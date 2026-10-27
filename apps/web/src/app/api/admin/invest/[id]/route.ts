import { z } from "zod";
import { body, HttpError, ok, requireSuperAdmin, route } from "@/lib/http";
import { db } from "@/lib/db";
import { adminAudit } from "@/lib/admin";
import { failTrade, settle } from "@/lib/pay/invest";

// For orders stuck PENDING: check the broker again, or cancel and return the money.
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireSuperAdmin();
  const { id } = await params;
  const d = await body(req, z.object({ action: z.enum(["recheck", "fail"]), note: z.string().trim().max(300).optional() }));
  const t = await db.payTrade.findUnique({ where: { id } });
  if (!t) throw new HttpError(404, "Order not found.");
  if (t.status !== "PENDING") throw new HttpError(409, "Only pending orders can be changed.");
  if (d.action === "recheck") await settle(id);
  else { if (!d.note || d.note.length < 5) throw new HttpError(422, "Add a reason."); await failTrade(id, d.note); }
  await adminAudit(ctx.user.id, `invest.order_${d.action}`, "PayTrade", id, { note: d.note });
  return ok(await db.payTrade.findUniqueOrThrow({ where: { id }, select: { id: true, status: true } }));
});
