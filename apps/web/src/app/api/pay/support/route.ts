import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/http";
import { limit } from "@/lib/ratelimit";
import { HttpError } from "@/lib/http";
import { supportTurn } from "@/lib/pay/ai";

export const GET = route(async () => {
  const ctx = await requireUser();
  return ok({ cases: await db.supportCase.findMany({ where: { userId: ctx.user.id }, orderBy: { updatedAt: "desc" }, take: 20, select: { id: true, subject: true, status: true, updatedAt: true } }) });
});

/** Start a chat with support. The AI answers first and brings in a person when needed. */
export const POST = route(async (req: Request) => {
  const ctx = await requireUser();
  if (!limit(`support:${ctx.user.id}`, 10, 10 * 60_000)) throw new HttpError(429, "Please wait a few minutes before opening another chat.");
  const d = await body(req, z.object({ message: z.string().trim().min(2).max(4000) }));
  const c = await db.supportCase.create({ data: { userId: ctx.user.id, name: ctx.user.name, email: ctx.user.email, channel: "APP", subject: d.message.slice(0, 80) } });
  const r = await supportTurn(c.id, d.message).catch(async () => { await db.supportCase.update({ where: { id: c.id }, data: { status: "WAITING_AGENT" } }); return { reply: "Thanks, a member of our team will reply here shortly.", escalate: true, resolved: false }; });
  return ok({ id: c.id, ...r }, 201);
});
