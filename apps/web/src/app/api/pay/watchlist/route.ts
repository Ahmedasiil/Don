import { z } from "zod";
import { body, HttpError, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requirePay } from "@/lib/pay/guard";
import { ASSETS } from "@/lib/pay/providers/market";

export const GET = route(async (req: Request) => {
  const ctx = await requirePay(req);
  return ok({ watch: await db.payWatch.findMany({ where: { userId: ctx.user.id }, orderBy: { createdAt: "asc" } }) });
});

export const POST = route(async (req: Request) => {
  const ctx = await requirePay(req);
  const d = await body(req, z.object({ symbol: z.string().max(12), alertAbove: z.number().positive().nullish(), alertBelow: z.number().positive().nullish() }));
  const a = ASSETS.find((x) => x.symbol === d.symbol);
  if (!a) throw new HttpError(422, "Unknown symbol.");
  if ((await db.payWatch.count({ where: { userId: ctx.user.id } })) >= 30) throw new HttpError(409, "Your watchlist is full.");
  const w = await db.payWatch.upsert({ where: { userId_symbol: { userId: ctx.user.id, symbol: a.symbol } }, create: { userId: ctx.user.id, symbol: a.symbol, kind: a.kind, alertAbove: d.alertAbove ?? null, alertBelow: d.alertBelow ?? null }, update: { alertAbove: d.alertAbove ?? null, alertBelow: d.alertBelow ?? null, alertedAt: null } });
  return ok(w, 201);
});

export const DELETE = route(async (req: Request) => {
  const ctx = await requirePay(req);
  const symbol = new URL(req.url).searchParams.get("symbol") ?? "";
  await db.payWatch.deleteMany({ where: { userId: ctx.user.id, symbol } });
  return ok({ removed: true });
});
