import { ok, route } from "@/lib/http";
import { requirePay } from "@/lib/pay/guard";
import { history } from "@/lib/pay/providers/market";

export const GET = route(async (req: Request, { params }: { params: Promise<{ symbol: string }> }) => {
  await requirePay(req, { action: "markets" });
  const { symbol } = await params;
  return ok({ symbol: decodeURIComponent(symbol), closes: await history(decodeURIComponent(symbol)) });
});
