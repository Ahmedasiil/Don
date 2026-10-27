import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requirePay } from "@/lib/pay/guard";
import { createRequest } from "@/lib/pay/requests";

// Money requests: ones I sent (asking others to pay me) and ones I received.
export const GET = route(async (req: Request) => {
  const ctx = await requirePay(req);
  const [sent, received] = await Promise.all([
    db.payRequest.findMany({ where: { fromUserId: ctx.user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.payRequest.findMany({ where: { toUserId: ctx.user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const ids = [...new Set([...sent.map((r) => r.toUserId), ...received.map((r) => r.fromUserId)])];
  const people = Object.fromEntries((await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })).map((u) => [u.id, u]));
  const strip = ({ journalRef: _j, ...r }: (typeof sent)[number]) => r;
  return ok({
    sent: sent.map((r) => ({ ...strip(r), person: people[r.toUserId] ?? null })),
    received: received.map((r) => ({ ...strip(r), person: people[r.fromUserId] ?? null })),
  });
});

export const POST = route(async (req: Request) => {
  const ctx = await requirePay(req, { action: "request" });
  const d = await body(req, z.object({ email: z.string().email().max(200), amountCents: z.number().int().min(100).max(10_000_000), note: z.string().max(140).optional() }));
  return ok(await createRequest(ctx, d), 201);
});
