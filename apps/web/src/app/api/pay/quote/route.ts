import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { requirePay } from "@/lib/pay/guard";
import { quote } from "@/lib/pay/transfers";

export const POST = route(async (req: Request) => {
  await requirePay(req, { action: "quote" });
  const d = await body(req, z.object({ country: z.string().length(2), method: z.string().max(20), sendCents: z.number().int().positive().max(100_000_000) }));
  const { provider: _p, ...q } = await quote(d.country, d.method, d.sendCents);
  return ok(q);
});
