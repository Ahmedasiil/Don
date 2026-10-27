import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requirePay } from "@/lib/pay/guard";
import { coach, healthScore } from "@/lib/pay/ai";

export const GET = route(async (req: Request) => {
  const ctx = await requirePay(req);
  const [t, health] = await Promise.all([db.payCoachThread.findUnique({ where: { userId: ctx.user.id } }), healthScore(ctx.user.id)]);
  return ok({ messages: t?.messages ?? [], health });
});

export const POST = route(async (req: Request) => {
  const ctx = await requirePay(req, { action: "coach" });
  const d = await body(req, z.object({ message: z.string().trim().min(1).max(2000) }));
  return ok(await coach(ctx.user.id, d.message));
});

export const DELETE = route(async (req: Request) => {
  const ctx = await requirePay(req);
  await db.payCoachThread.deleteMany({ where: { userId: ctx.user.id } });
  return ok({ cleared: true });
});
