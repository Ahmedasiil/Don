import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { requirePay, setPin } from "@/lib/pay/guard";

export const POST = route(async (req: Request) => {
  const ctx = await requirePay(req, { action: "pin" });
  const d = await body(req, z.object({ pin: z.string().regex(/^\d{6}$/), code: z.string().max(12).default("") }));
  await setPin(ctx, d.pin, d.code);
  return ok({ pinSet: true });
});
