import { z } from "zod";
import { body, HttpError, ok, requireSuperAdmin, route } from "@/lib/http";
import { db } from "@/lib/db";
import { adminAudit } from "@/lib/admin";
import { sendPush } from "@/lib/push";
import { emailLayout, sendEmail } from "@/lib/messaging";
import { APP_URL } from "@/lib/env";

/** The full case with the customer's Pay context (no secrets), so the agent never has to ask twice. */
export const GET = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireSuperAdmin();
  const { id } = await params;
  const c = await db.supportCase.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  if (!c) throw new HttpError(404, "Case not found.");
  const [profile, transfers, cards, user, history] = c.userId ? await Promise.all([
    db.payProfile.findUnique({ where: { userId: c.userId }, select: { tier: true, kycStatus: true, legalName: true, country: true, riskLevel: true, frozenAt: true, frozenReason: true, pinLockedUntil: true } }),
    db.payTransfer.findMany({ where: { userId: c.userId }, orderBy: { createdAt: "desc" }, take: 8, include: { recipient: { select: { name: true, country: true, label: true } } } }),
    db.payCard.findMany({ where: { userId: c.userId }, select: { id: true, last4: true, status: true, type: true, familyId: true } }),
    db.user.findUnique({ where: { id: c.userId }, select: { name: true, email: true, phone: true, createdAt: true, totpEnabledAt: true } }),
    db.supportCase.findMany({ where: { userId: c.userId, id: { not: id } }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, subject: true, status: true, createdAt: true } }),
  ]) : [null, [], [], null, []];
  const agents = await db.user.findMany({ where: { isSuperAdmin: true }, select: { id: true, name: true } });
  return ok({ ...c, customer: { user, profile, transfers: transfers.map(({ ip: _i, idempotencyKey: _k, ...t }) => t), cards, history }, agents });
});

/** Reply as an agent (or leave an internal note). The customer gets it in the app, by push and by email. */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireSuperAdmin();
  const { id } = await params;
  const d = await body(req, z.object({ message: z.string().trim().min(1).max(4000), internal: z.boolean().default(false) }));
  const c = await db.supportCase.findUnique({ where: { id } });
  if (!c) throw new HttpError(404, "Case not found.");
  const m = await db.supportMessage.create({ data: { caseId: id, from: "AGENT", authorId: ctx.user.id, body: d.message, internal: d.internal } });
  if (!d.internal) {
    await db.supportCase.update({ where: { id }, data: { status: "WAITING_CUSTOMER", assigneeId: c.assigneeId ?? ctx.user.id } });
    if (c.userId) await sendPush(c.userId, "oenodpay support replied", d.message.slice(0, 120), { link: `/app/support/${id}` }).catch(() => {});
    if (c.email) await sendEmail({ to: c.email, scope: "PLATFORM", subject: `Re: ${c.subject}`, html: emailLayout({ title: "Our support team replied", body: d.message, ctaLabel: "Open the conversation", ctaUrl: `${APP_URL}/app/help` }) }).catch(() => {});
  }
  await adminAudit(ctx.user.id, d.internal ? "support.note" : "support.reply", "SupportCase", id);
  return ok(m, 201);
});

export const PATCH = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireSuperAdmin();
  const { id } = await params;
  const d = await body(req, z.object({ status: z.enum(["AI_HANDLING", "WAITING_AGENT", "WAITING_CUSTOMER", "RESOLVED"]).optional(), priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(), assigneeId: z.string().nullish(), category: z.string().max(20).optional() }));
  const u = await db.supportCase.update({ where: { id }, data: { ...d, ...(d.status === "RESOLVED" ? { resolvedAt: new Date() } : {}) } });
  await adminAudit(ctx.user.id, "support.update", "SupportCase", id, d);
  return ok(u);
});
