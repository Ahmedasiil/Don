import { z } from "zod";
import { body, HttpError, ok, requireSuperAdmin, route } from "@/lib/http";
import { db } from "@/lib/db";
import { adminAudit } from "@/lib/admin";
import { BASE } from "@/lib/pay/config";
import { activity, post, walletFor } from "@/lib/pay/ledger";
import { notify } from "@/lib/pay/notices";


// One customer: everything about their account in one place.
export const GET = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireSuperAdmin();
  const { id } = await params;
  const u = await db.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, phone: true, createdAt: true, lastSeenAt: true, totpEnabledAt: true, isSuperAdmin: true } });
  if (!u) throw new HttpError(404, "Customer not found.");
  const payProfile = await db.payProfile.findUnique({ where: { userId: id } });
  const [wallet, moves, transfers, cards, trades, holdings, bills, loans, rewards, bookings, risks, sessions, cases, score] = await Promise.all([
    walletFor(id), activity(id, 30),
    db.payTransfer.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 20, include: { recipient: { select: { name: true, country: true } } } }),
    db.payCard.findMany({ where: { userId: id } }),
    db.payTrade.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.payHolding.findMany({ where: { userId: id, quantity: { gt: 0 } } }),
    db.payBillPayment.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 20, include: { payee: { select: { label: true } } } }),
    db.payLoan.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" } }),
    db.payReward.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.payBooking.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.payRiskEvent.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.session.findMany({ where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, select: { id: true, device: true, ip: true, createdAt: true, lastSeenAt: true } }),
    db.supportCase.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, subject: true, status: true, createdAt: true } }),
    db.payCreditScore.findFirst({ where: { userId: id }, orderBy: { createdAt: "desc" } }),
  ]);
  const { pinHash: _p, ...profile } = payProfile ?? ({} as Record<string, unknown>);
  return ok({
    user: { ...u, twoFactor: !!u.totpEnabledAt }, profile, currency: BASE,
    wallet: { balanceCents: wallet.balanceCents, heldCents: wallet.heldCents }, activity: moves,
    transfers: transfers.map(({ ip: _i, ...t }) => t), cards: cards.map((c) => ({ id: c.id, last4: c.last4, status: c.status, type: c.type, brand: c.brand })),
    trades, holdings: holdings.map((h) => ({ ...h, quantity: Number(h.quantity) })), bills, loans, rewards, bookings, risks, sessions, cases, score,
  });
});

// Account actions that aren't compliance decisions (those live under /api/admin/pay/profiles).
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireSuperAdmin();
  const { id } = await params;
  const d = await body(req, z.discriminatedUnion("action", [
    z.object({ action: z.literal("adjust"), amountCents: z.number().int().refine((n) => n !== 0 && Math.abs(n) <= 1_000_000), note: z.string().trim().min(5).max(300) }),
    z.object({ action: z.literal("signout"), note: z.string().trim().min(3).max(300) }),
    z.object({ action: z.literal("reset_pin"), note: z.string().trim().min(3).max(300) }),
  ]));
  const u = await db.user.findUnique({ where: { id } });
  if (!u) throw new HttpError(404, "Customer not found.");
  if (d.action === "adjust") {
    // Goodwill credits and corrections. Always balanced against "adjustments", always audited, never above 10,000.
    const w = await walletFor(id);
    if (d.amountCents < 0 && w.balanceCents - w.heldCents < -d.amountCents) throw new HttpError(409, "The wallet doesn't have that much available.");
    await post(id, "ADJUSTMENT", `adjust:${id}:${Date.now().toString(36)}`, [{ walletId: w.id, account: `wallet:${id}`, amountCents: d.amountCents }, { account: "adjustments", amountCents: -d.amountCents }], d.note);
    if (d.amountCents > 0) await notify(id, "MONEY_IN", "We added money to your wallet", d.note, "/app/activity");
  } else if (d.action === "signout") {
    await db.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await db.user.update({ where: { id }, data: { tokenVersion: { increment: 1 } } });
  } else {
    await db.payProfile.update({ where: { userId: id }, data: { pinHash: null, pinFailed: 0, pinLockedUntil: null } });
    await notify(id, "SECURITY", "Your PIN was reset by support", "Set a new 6-digit PIN in Security before your next payment.", "/app/security");
  }
  await adminAudit(ctx.user.id, `customer.${d.action}`, "User", id, d);
  return ok({ done: true });
});
