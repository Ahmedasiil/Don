import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { requirePay } from "@/lib/pay/guard";
import { payNow } from "@/lib/pay/credit";

// Pay the next instalment now.
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requirePay(req, { money: true, action: "loan-pay" });
  const d = await body(req, z.object({ pin: z.string().regex(/^\d{6}$/) }));
  return ok(await payNow(ctx, (await params).id, d.pin));
});
