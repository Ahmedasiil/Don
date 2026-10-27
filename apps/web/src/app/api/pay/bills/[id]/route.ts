import { ok, route } from "@/lib/http";
import { requirePay } from "@/lib/pay/guard";
import { cancelBill } from "@/lib/pay/bills";

// Cancel a scheduled payment (and its repeats).
export const DELETE = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requirePay(req, { action: "bill" });
  return ok(await cancelBill(ctx, (await params).id));
});
