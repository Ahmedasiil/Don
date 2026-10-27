import { z } from "zod";
import { body, HttpError, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requirePay, stepUp } from "@/lib/pay/guard";
import { setCardStatus } from "@/lib/pay/providers/stripe";
import { audit } from "@/lib/audit";

// Freeze is instant. Unfreeze and cancel need a fresh authenticator code.
export const PATCH = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requirePay(req, { action: "card" });
  const { id } = await params;
  const d = await body(req, z.object({ status: z.enum(["ACTIVE", "FROZEN", "CANCELED"]), code: z.string().max(12).optional() }));
  const card = await db.payCard.findFirst({ where: { id, userId: ctx.user.id } });
  if (!card) throw new HttpError(404, "Card not found.");
  if (card.status === "CANCELED") throw new HttpError(409, "This card is cancelled.");
  if (d.status !== "FROZEN") await stepUp(ctx, d.code, d.status === "ACTIVE" ? "unfreeze this card" : "cancel this card");
  await setCardStatus(card.stripeCardId, d.status === "ACTIVE" ? "active" : d.status === "FROZEN" ? "inactive" : "canceled");
  const u = await db.payCard.update({ where: { id }, data: { status: d.status } });
  await audit(ctx, `pay.card_${d.status.toLowerCase()}`, "PayCard", id, { ip: ctx.ip });
  return ok(u);
});
