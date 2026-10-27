import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { requirePay } from "@/lib/pay/guard";
import { travelChat } from "@/lib/pay/travel";

// The AI travel agent. It searches and suggests; booking always goes through /travel/book with the PIN.
export const maxDuration = 60;
export const POST = route(async (req: Request) => {
  const ctx = await requirePay(req, { action: "travel-ai" });
  const d = await body(req, z.object({ message: z.string().min(1).max(1000) }));
  return ok(await travelChat(ctx.user.id, d.message));
});
