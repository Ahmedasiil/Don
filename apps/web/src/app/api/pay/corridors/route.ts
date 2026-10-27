import { ok, route } from "@/lib/http";
import { requirePay } from "@/lib/pay/guard";
import { BASE, CORRIDORS } from "@/lib/pay/config";

export const GET = route(async (req: Request) => {
  await requirePay(req);
  return ok({ from: BASE, corridors: CORRIDORS.map((c) => ({ ...c, options: c.options.map(({ provider: _p, ...o }) => o) })) });
});
