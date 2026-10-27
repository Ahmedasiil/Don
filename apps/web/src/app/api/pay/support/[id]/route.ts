import { z } from "zod";
import { body, HttpError, ok, requireUser, route } from "@/lib/http";
import { db } from "@/lib/db";
import { limit } from "@/lib/ratelimit";
import { supportTurn } from "@/lib/pay/ai";

async function mine(userId: string, id: string) {
  const c = await db.supportCase.findFirst({ where: { id, userId }, include: { messages: { where: { internal: false, from: { not: "SYSTEM" } }, orderBy: { createdAt: "asc" } } } });
  if (!c) throw new HttpError(404, "Conversation not found.");
  return c;
}

export const GET = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireUser();
  return ok(await mine(ctx.user.id, (await params).id));
});

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireUser();
  const { id } = await params;
  if (!limit(`support-msg:${ctx.user.id}`, 20, 60_000)) throw new HttpError(429, "Slow down a little.");
  const d = await body(req, z.object({ message: z.string().trim().min(1).max(4000).optional(), csat: z.number().int().min(1).max(5).optional() }));
  const c = await mine(ctx.user.id, id);
  if (d.csat) await db.supportCase.update({ where: { id }, data: { csat: d.csat } });
  if (!d.message) return ok({ saved: true });
  if (c.status === "AI_HANDLING") return ok(await supportTurn(id, d.message));
  await db.supportMessage.create({ data: { caseId: id, from: "CUSTOMER", body: d.message } });
  await db.supportCase.update({ where: { id }, data: { status: c.status === "RESOLVED" ? "WAITING_AGENT" : c.status === "WAITING_CUSTOMER" ? "WAITING_AGENT" : c.status } });
  return ok({ reply: null, waiting: true });
});
