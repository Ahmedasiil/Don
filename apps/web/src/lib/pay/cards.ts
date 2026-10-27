import type Stripe from "stripe";
import { db } from "../db";
import { BASE } from "./config";
import { available, post, walletFor } from "./ledger";
import { alert } from "./guard";
import { riskEvent } from "./risk";
import { cashback, reverseCashback } from "./rewards";

// Real-time card decisions. Stripe asks us about every card payment and waits up to 2 seconds for an answer.
// Card spending comes out of the owner's oenodpay wallet; teen cards follow the parent's rules.

const TZ = process.env.PAY_TIMEZONE || "America/Toronto";
const localHour = () => Number(new Intl.DateTimeFormat("en-CA", { hour: "numeric", hour12: false, timeZone: TZ }).format(new Date())) % 24;

export async function decideAuthorization(a: Stripe.Issuing.Authorization): Promise<{ approved: boolean; reason?: string }> {
  const card = await db.payCard.findUnique({ where: { stripeCardId: a.card.id } });
  const amount = a.pending_request?.amount ?? a.amount;
  const m = a.merchant_data;
  const record = async (approved: boolean, reason?: string) => {
    if (card) await db.payCardEvent.upsert({ where: { stripeAuthId: a.id }, update: {}, create: { userId: card.userId, familyId: card.familyId, cardId: card.id, stripeAuthId: a.id, merchant: m.name ?? "Unknown", category: m.category, city: m.city, country: m.country, amountCents: amount, currency: a.currency.toUpperCase(), decision: approved ? "APPROVED" : "DECLINED", reason } }).catch(() => {});
    return { approved, reason };
  };
  if (!card || card.status !== "ACTIVE") return record(false, "Card is not active");
  const profile = await db.payProfile.findUnique({ where: { userId: card.userId } });
  if (profile?.frozenAt) return record(false, "Account is frozen");
  if (a.currency.toUpperCase() !== BASE) return record(false, "Currency not supported");

  if (card.familyId) {
    const f = await db.payFamilyMember.findUnique({ where: { id: card.familyId } });
    if (!f || f.status !== "ACTIVE") return record(false, "Teen card is paused by the parent");
    const merchantOk = !f.allowedMerchants.length || f.allowedMerchants.some((x) => (m.name ?? "").toLowerCase().includes(x.toLowerCase()));
    if (!merchantOk) return record(false, "Shop is not on the parent's allowed list");
    if (f.blockedCategories.includes(m.category)) return record(false, "This kind of shop is blocked by the parent");
    if (f.countries.length && m.country && !f.countries.includes(m.country)) return record(false, "Country is blocked by the parent");
    if (!f.onlineAllowed && a.authorization_method === "online") return record(false, "Online shopping is off");
    const h = localHour();
    if (f.nightLock && (h >= 22 || h < 6)) return record(false, "Card is locked at night (10 pm to 6 am)");
    if (f.perPurchaseLimitCents && amount > f.perPurchaseLimitCents) return record(false, "Over the per-purchase limit");
    const weekStart = new Date(Date.now() - 7 * 86400_000);
    const spent = await db.payCardEvent.aggregate({ where: { familyId: f.id, decision: "APPROVED", createdAt: { gte: weekStart } }, _sum: { amountCents: true } });
    if ((spent._sum.amountCents ?? 0) + amount > f.weeklyLimitCents) return record(false, "Weekly limit reached");
    if (f.approvalOverCents && amount > f.approvalOverCents) {
      const parent = await db.user.findUnique({ where: { id: f.parentUserId } });
      if (parent) await alert(parent, `${f.name} tried to spend ${(amount / 100).toFixed(2)}`, `At ${m.name ?? "a shop"}. Purchases over ${(f.approvalOverCents / 100).toFixed(2)} need your OK: raise the limit in Pay, Family if you want to allow it.`);
      return record(false, "Needs the parent's approval");
    }
  }

  const { availableCents } = await available(card.userId);
  if (availableCents < amount) return record(false, "Not enough money in the wallet");
  // Take the money now; reversals and refunds give it back.
  const w = await walletFor(card.userId);
  const taken = await post(card.userId, "CARD", `auth:${a.id}`, [
    { walletId: w.id, account: `wallet:${card.userId}`, amountCents: -amount },
    { account: "clearing:cards", amountCents: amount },
  ], m.name ?? "Card payment").then(() => true, () => false);
  if (!taken) return record(false, "Not enough money in the wallet");
  const r = await record(true);
  if (card.familyId) {
    const f = await db.payFamilyMember.findUnique({ where: { id: card.familyId } });
    const parent = f && (await db.user.findUnique({ where: { id: f.parentUserId } }));
    if (parent && f) await import("../push").then((p) => p.sendPush(parent.id, `${f.name} spent ${(amount / 100).toFixed(2)}`, m.name ?? undefined, { link: "/app/family" })).catch(() => {});
  }
  return r;
}

/** An approved authorization that was cancelled or captured for less: return the difference. */
export async function authorizationUpdated(a: Stripe.Issuing.Authorization) {
  if (a.status !== "reversed" && a.status !== "closed") return;
  const card = await db.payCard.findUnique({ where: { stripeCardId: a.card.id } });
  const ev = await db.payCardEvent.findUnique({ where: { stripeAuthId: a.id } });
  if (!card || ev?.decision !== "APPROVED") return;
  const captured = (a.transactions ?? []).reduce((s, t) => s - t.amount, 0); // transaction amounts are negative for spend
  const back = ev.amountCents - Math.max(0, captured);
  if (back <= 0) return;
  const w = await walletFor(card.userId);
  await post(card.userId, "CARD_REVERSAL", `auth-back:${a.id}`, [{ account: "clearing:cards", amountCents: -back }, { walletId: w.id, account: `wallet:${card.userId}`, amountCents: back }], `${a.merchant_data.name ?? "Card"} returned`);
}

/** Merchant refunds arrive as positive transactions. */
export async function cardTransaction(t: Stripe.Issuing.Transaction) {
  const card = await db.payCard.findUnique({ where: { stripeCardId: typeof t.card === "string" ? t.card : t.card.id } });
  if (!card) return;
  const auth = typeof t.authorization === "string" ? t.authorization : t.authorization?.id;
  // Purchases earn cashback for the account owner; refunds take it back.
  if (t.type === "capture") { await cashback(card.userId, Math.abs(t.amount), auth ?? t.id, t.merchant_data.name ?? "Card purchase"); return; }
  if (t.type !== "refund") return;
  if (auth) await reverseCashback(auth);
  const w = await walletFor(card.userId);
  await post(card.userId, "CARD_REFUND", `card-refund:${t.id}`, [{ account: "clearing:cards", amountCents: -Math.abs(t.amount) }, { walletId: w.id, account: `wallet:${card.userId}`, amountCents: Math.abs(t.amount) }], `Refund from ${t.merchant_data.name ?? "shop"}`);
}

/** Stripe flags suspected fraud on cards: freeze the card and open a risk event. */
export async function cardFraud(cardId: string, details: unknown) {
  const card = await db.payCard.findUnique({ where: { stripeCardId: cardId } });
  if (!card) return;
  await db.payCard.update({ where: { id: card.id }, data: { status: "INACTIVE" } });
  await riskEvent(card.userId, "CARD_FRAUD", "HIGH", "PayCard", card.id, details);
}
