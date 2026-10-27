import { z } from "zod";
import { db } from "@/lib/db";
import { body, HttpError, ok, requireUser, route } from "@/lib/http";
import { newRecoveryCodes, verifySecondFactor } from "@/lib/security";
import { audit } from "@/lib/audit";

// New set of recovery codes (the old ones stop working).
export const POST = route(async (req: Request) => {
  const ctx = await requireUser();
  const d = await body(req, z.object({ code: z.string().min(6).max(20) }));
  if (!ctx.user.totpEnabledAt) throw new HttpError(400, "Turn on two-step sign-in first.");
  if (!(await verifySecondFactor(ctx.user.id, d.code))) throw new HttpError(401, "That code didn't work.");
  const { codes, hashes } = newRecoveryCodes();
  await db.user.update({ where: { id: ctx.user.id }, data: { recoveryCodes: hashes } });
  await audit(ctx, "auth.recovery_codes_regenerated");
  return ok({ recoveryCodes: codes });
});
