import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { requirePay } from "@/lib/pay/guard";
import { closeRequest, payRequest } from "@/lib/pay/requests";

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const d = await body(req, z.discriminatedUnion("action", [
    z.object({ action: z.literal("pay"), pin: z.string().regex(/^\d{6}$/), code: z.string().max(12).optional() }),
    z.object({ action: z.enum(["decline", "cancel"]) }),
  ]));
  if (d.action === "pay") return ok(await payRequest(await requirePay(req, { money: true, action: "request-pay" }), id, d.pin, d.code));
  return ok(await closeRequest(await requirePay(req, { action: "request" }), id, d.action));
});
