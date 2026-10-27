import { db } from "../db";
import { HttpError } from "../http";
import { audit } from "../audit";
import { BASE, fmt } from "./config";
import { available, post, walletFor } from "./ledger";
import { checkPin, limitsFor, stepUp, STEP_UP_OVER_CENTS, type PayCtx } from "./guard";
import { notify } from "./notices";

// Asking another oenodpay member for money. Paying moves money wallet to wallet in one database transaction:
// the payer's wallet to "clearing:p2p", then clearing to the requester's wallet, each side with its own journal
// so both people see it in their activity.

const EXPIRES_DAYS = 14;
const OPEN_MAX = 20;

export async function createRequest(ctx: PayCtx, input: { email: string; amountCents: number; note?: string }) {
  const to = await db.user.findUnique({ where: { email: input.email.trim().toLowerCase() } });
  const toProfile = to && (await db.payProfile.findUnique({ where: { userId: to.id } }));
  if (!to || !toProfile || toProfile.kycStatus !== "VERIFIED") throw new HttpError(404, "We couldn't find a verified oenodpay member with that email.");
  if (to.id === ctx.user.id) throw new HttpError(422, "You can't request money from yourself.");
  const lim = await limitsFor(ctx);
  if (input.amountCents > lim.perTransfer) throw new HttpError(403, "That's over your per-payment limit.", { code: "LIMIT" });
  const open = await db.payRequest.count({ where: { fromUserId: ctx.user.id, status: "PENDING" } });
  if (open >= OPEN_MAX) throw new HttpError(429, "You have too many open requests. Cancel some first.");
  const r = await db.payRequest.create({
    data: { fromUserId: ctx.user.id, toUserId: to.id, amountCents: input.amountCents, currency: BASE, note: input.note?.trim() || null, expiresAt: new Date(Date.now() + EXPIRES_DAYS * 86400_000) },
  });
  await audit(ctx, "pay.request_created", "PayRequest", r.id, { amountCents: r.amountCents });
  await notify(to.id, "REQUEST", `${ctx.user.name} requested ${fmt(r.amountCents, r.currency)}`, r.note ?? "Open oenodpay to pay or decline.", "/app/request");
  return r;
}

export async function payRequest(ctx: PayCtx, id: string, pin: string, code?: string) {
  const r = await db.payRequest.findFirst({ where: { id, toUserId: ctx.user.id } });
  if (!r) throw new HttpError(404, "Request not found.");
  if (r.status !== "PENDING") throw new HttpError(409, "This request is no longer open.");
  if (r.expiresAt < new Date()) {
    await db.payRequest.update({ where: { id }, data: { status: "EXPIRED" } });
    throw new HttpError(410, "This request has expired.");
  }
  const lim = await limitsFor(ctx);
  if (r.amountCents > lim.perTransfer) throw new HttpError(403, "That's over your per-payment limit.", { code: "LIMIT" });
  await checkPin(ctx, pin);
  if (r.amountCents >= STEP_UP_OVER_CENTS) await stepUp(ctx, code, "pay this request");
  const { availableCents } = await available(ctx.user.id, r.currency);
  if (availableCents < r.amountCents) throw new HttpError(402, "Not enough money in your wallet. Add money first.");
  const from = await db.user.findUniqueOrThrow({ where: { id: r.fromUserId } });

  const ref = `p2p:${r.id}`;
  const note = r.note ? ` · ${r.note}` : "";
  await db.$transaction(async (tx) => {
    // Claim the request first so two taps can't pay it twice.
    const claimed = await tx.payRequest.updateMany({ where: { id: r.id, status: "PENDING" }, data: { status: "PAID", paidAt: new Date(), journalRef: ref } });
    if (!claimed.count) throw new HttpError(409, "This request is no longer open.");
    const payerW = await walletFor(ctx.user.id, r.currency, tx);
    const payeeW = await walletFor(r.fromUserId, r.currency, tx);
    await post(ctx.user.id, "P2P_OUT", `${ref}:out`, [
      { walletId: payerW.id, account: `wallet:${ctx.user.id}`, amountCents: -r.amountCents, currency: r.currency },
      { account: "clearing:p2p", amountCents: r.amountCents, currency: r.currency },
    ], `To ${from.name}${note}`, tx);
    await post(r.fromUserId, "P2P_IN", `${ref}:in`, [
      { account: "clearing:p2p", amountCents: -r.amountCents, currency: r.currency },
      { walletId: payeeW.id, account: `wallet:${r.fromUserId}`, amountCents: r.amountCents, currency: r.currency },
    ], `From ${ctx.user.name}${note}`, tx);
  }, { isolationLevel: "Serializable" });

  await audit(ctx, "pay.request_paid", "PayRequest", r.id, { amountCents: r.amountCents });
  await notify(r.fromUserId, "MONEY_IN", `${ctx.user.name} paid you ${fmt(r.amountCents, r.currency)}`, r.note ?? undefined, "/app/activity");
  return db.payRequest.findUniqueOrThrow({ where: { id } });
}

export async function closeRequest(ctx: PayCtx, id: string, action: "decline" | "cancel") {
  const where = action === "decline" ? { id, toUserId: ctx.user.id, status: "PENDING" } : { id, fromUserId: ctx.user.id, status: "PENDING" };
  const r = await db.payRequest.findFirst({ where });
  if (!r) throw new HttpError(404, "Open request not found.");
  await db.payRequest.update({ where: { id }, data: { status: action === "decline" ? "DECLINED" : "CANCELLED" } });
  await audit(ctx, action === "decline" ? "pay.request_declined" : "pay.request_cancelled", "PayRequest", id);
  if (action === "decline") await notify(r.fromUserId, "REQUEST", `${ctx.user.name} declined your request`, `${fmt(r.amountCents, r.currency)}${r.note ? ` · ${r.note}` : ""}`, "/app/request");
}
