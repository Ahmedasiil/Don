import { ok, route } from "@/lib/http";
import { requirePay } from "@/lib/pay/guard";
import { redeem, summary } from "@/lib/pay/rewards";
import { APP_URL } from "@/lib/env";

export const GET = route(async (req: Request) => {
  const ctx = await requirePay(req, { action: "rewards" });
  const s = await summary(ctx.user.id);
  return ok({ ...s, inviteUrl: `${APP_URL}/signup?ref=${s.code}` });
});

// Move cleared rewards into the wallet.
export const POST = route(async (req: Request) => {
  const ctx = await requirePay(req, { money: true, action: "rewards" });
  return ok({ cents: await redeem(ctx) });
});
