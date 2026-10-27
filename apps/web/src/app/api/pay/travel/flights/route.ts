import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { requirePay } from "@/lib/pay/guard";
import { flights } from "@/lib/pay/travel";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const POST = route(async (req: Request) => {
  await requirePay(req, { action: "travel-search" });
  const d = await body(req, z.object({ from: z.string().length(3), to: z.string().length(3), depart: day, back: day.optional(), adults: z.number().int().min(1).max(9), cabin: z.enum(["economy", "premium_economy", "business", "first"]).optional() }));
  return ok({ offers: await flights({ ...d, from: d.from.toUpperCase(), to: d.to.toUpperCase() }) });
});
