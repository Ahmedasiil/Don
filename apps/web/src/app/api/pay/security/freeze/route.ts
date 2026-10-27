import { ok, route } from "@/lib/http";
import { requirePay, selfFreeze } from "@/lib/pay/guard";

// "Freeze everything" button for a lost phone or suspicious activity. Works even without a PIN.
export const POST = route(async (req: Request) => {
  const ctx = await requirePay(req, { action: "freeze" });
  await selfFreeze(ctx);
  return ok({ frozen: true });
});
