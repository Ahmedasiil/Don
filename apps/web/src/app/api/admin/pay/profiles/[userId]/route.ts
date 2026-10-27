import { z } from "zod";
import { body, HttpError, ok, requireSuperAdmin, route } from "@/lib/http";
import { db } from "@/lib/db";
import { adminAudit } from "@/lib/admin";
import { alert } from "@/lib/pay/guard";
import { screenProfile } from "@/lib/pay/risk";

// Compliance actions on a customer.
export const POST = route(async (req: Request, { params }: { params: Promise<{ userId: string }> }) => {
  const ctx = await requireSuperAdmin();
  const { userId } = await params;
  const d = await body(req, z.object({ action: z.enum(["freeze", "unfreeze", "verify", "reject", "tier2", "rescreen", "risk_high", "risk_low"]), note: z.string().trim().min(3).max(1000) }));
  const p = await db.payProfile.findUnique({ where: { userId } });
  const u = await db.user.findUnique({ where: { id: userId } });
  if (!p || !u) throw new HttpError(404, "Customer not found.");
  if (d.action === "unfreeze" && p.sanctionsHit) throw new HttpError(409, "This customer matches a sanctions list. Clear the match first (rescreen or mark the risk event cleared with evidence).");
  const data = {
    freeze: { frozenAt: new Date(), frozenReason: d.note },
    unfreeze: { frozenAt: null, frozenReason: null },
    verify: { kycStatus: "VERIFIED", tier: Math.max(1, p.tier) },
    reject: { kycStatus: "REJECTED", tier: 0 },
    tier2: { tier: 2 },
    rescreen: {},
    risk_high: { riskLevel: "HIGH" },
    risk_low: { riskLevel: "LOW" },
  }[d.action];
  if (d.action === "rescreen") await screenProfile(userId);
  else await db.payProfile.update({ where: { userId }, data });
  if (d.action === "freeze") await alert(u, "Your oenodpay account is on hold", "Our team is reviewing your account. Money can't leave it for now. We'll contact you if we need anything.");
  if (d.action === "unfreeze") await alert(u, "Your oenodpay account is active again", "Thanks for your patience. You can send money and use your cards again.");
  await adminAudit(ctx.user.id, `pay.profile_${d.action}`, "PayProfile", p.id, { note: d.note });
  return ok({ done: true });
});
