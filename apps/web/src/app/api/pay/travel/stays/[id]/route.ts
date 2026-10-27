import { ok, route } from "@/lib/http";
import { requirePay } from "@/lib/pay/guard";
import { stayRates } from "@/lib/pay/travel";

// Rooms and rates for one hotel from a search.
export const GET = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requirePay(req, { action: "travel-search" });
  return ok(await stayRates((await params).id));
});
