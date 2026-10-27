import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { requirePay } from "@/lib/pay/guard";
import { stays } from "@/lib/pay/travel";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const POST = route(async (req: Request) => {
  await requirePay(req, { action: "travel-search" });
  const d = await body(req, z.object({ place: z.string().min(2).max(80), checkIn: day, checkOut: day, adults: z.number().int().min(1).max(9) }));
  return ok(await stays(d));
});
