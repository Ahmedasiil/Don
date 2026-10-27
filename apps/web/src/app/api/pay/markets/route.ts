import { ok, route } from "@/lib/http";
import { requirePay } from "@/lib/pay/guard";
import { quotes } from "@/lib/pay/providers/market";

export const GET = route(async (req: Request) => {
  await requirePay(req, { action: "markets" });
  return ok({ quotes: await quotes(), note: "Prices are for information only and may be delayed. Not investment advice." });
});
