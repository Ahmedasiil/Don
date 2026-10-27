import { randomBytes } from "node:crypto";
import { db } from "../db";
import { HttpError } from "../http";
import { audit } from "../audit";
import { BASE, cashbackBps, CASHBACK_CLEAR_DAYS, fmt, referralBonusCents } from "./config";
import { post, walletFor } from "./ledger";
import type { PayCtx } from "./guard";
import { notify } from "./notices";

// Rewards: cashback on card purchases, referral bonuses and promotions. Rewards clear after a few days (so a
// refunded purchase can be reversed first), then can be moved into the wallet from "rewards:pool".

const days = (n: number) => new Date(Date.now() + n * 864e5);

/** Cashback on a captured card purchase. Called from the card webhook; the reference makes it run once. */
export async function cashback(userId: string, purchaseCents: number, reference: string, merchant: string) {
  const cents = Math.floor((purchaseCents * cashbackBps()) / 10_000);
  if (cents <= 0) return;
  await db.payReward.upsert({ where: { reference: `cb:${reference}` }, create: { userId, kind: "CASHBACK", cents, memo: merchant, reference: `cb:${reference}`, availableAt: days(CASHBACK_CLEAR_DAYS) }, update: {} });
}

/** A refunded purchase takes its cashback back (if it hasn't been moved to the wallet yet). */
export async function reverseCashback(reference: string) {
  await db.payReward.updateMany({ where: { reference: `cb:${reference}`, status: { in: ["PENDING", "AVAILABLE"] } }, data: { status: "REVERSED" } });
}

export async function referralCode(userId: string) {
  const r = await db.payReferral.findUnique({ where: { userId } });
  if (r) return r.code;
  for (let i = 0; i < 5; i++) {
    const code = randomBytes(4).toString("base64url").replace(/[-_]/g, "").slice(0, 6).toUpperCase();
    if (code.length < 6) continue;
    const made = await db.payReferral.create({ data: { userId, code } }).catch(() => null);
    if (made) return made.code;
  }
  throw new HttpError(500, "Couldn't make a referral code. Try again.");
}

/** At sign-up: remember who invited this person. */
export async function recordReferral(newUserId: string, code?: string | null) {
  if (!code) return;
  const ref = await db.payReferral.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!ref || ref.userId === newUserId) return;
  await db.payReferredUser.create({ data: { referrerId: ref.userId, userId: newUserId } }).catch(() => {});
}

/** After the invited person is verified and adds money for the first time, both get the bonus. */
export async function rewardReferral(userId: string) {
  const r = await db.payReferredUser.findUnique({ where: { userId } });
  if (!r || r.rewardedAt) return;
  const claimed = await db.payReferredUser.updateMany({ where: { id: r.id, rewardedAt: null }, data: { rewardedAt: new Date() } });
  if (!claimed.count) return;
  const cents = referralBonusCents();
  if (cents <= 0) return;
  for (const [uid, memo] of [[r.referrerId, "A friend joined"], [userId, "Welcome bonus"]] as const) {
    await db.payReward.upsert({ where: { reference: `ref:${r.id}:${uid}` }, create: { userId: uid, kind: "REFERRAL", cents, memo, reference: `ref:${r.id}:${uid}`, availableAt: days(CASHBACK_CLEAR_DAYS) }, update: {} });
    await notify(uid, "REWARD", `You earned ${fmt(cents)}`, `${memo}. It clears in ${CASHBACK_CLEAR_DAYS} days.`, "/app/rewards");
  }
}

export async function summary(userId: string) {
  const [rows, code, invited] = await Promise.all([
    db.payReward.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 }),
    referralCode(userId),
    db.payReferredUser.count({ where: { referrerId: userId } }),
  ]);
  const sum = (s: string) => rows.filter((r) => r.status === s).reduce((a, r) => a + r.cents, 0);
  const earned = rows.filter((r) => r.cents > 0 && r.status !== "REVERSED").reduce((a, r) => a + r.cents, 0);
  return { currency: BASE, availableCents: sum("AVAILABLE"), pendingCents: sum("PENDING"), earnedCents: earned, cashbackBps: cashbackBps(), referralBonusCents: referralBonusCents(), code, invited, rows };
}

/** Move every cleared reward into the wallet. */
export async function redeem(ctx: PayCtx) {
  const ready = await db.payReward.findMany({ where: { userId: ctx.user.id, status: "AVAILABLE", cents: { gt: 0 } } });
  const cents = ready.reduce((a, r) => a + r.cents, 0);
  if (cents <= 0) throw new HttpError(409, "Nothing to move yet.");
  const ref = `redeem:${ctx.user.id}:${ready.map((r) => r.id).sort().join(",").slice(0, 120)}:${Date.now().toString(36)}`;
  await db.$transaction(async (tx) => {
    const moved = await tx.payReward.updateMany({ where: { id: { in: ready.map((r) => r.id) }, status: "AVAILABLE" }, data: { status: "REDEEMED" } });
    if (moved.count !== ready.length) throw new HttpError(409, "Your rewards changed. Try again.");
    const w = await walletFor(ctx.user.id, BASE, tx);
    await post(ctx.user.id, "REWARD", ref, [{ account: "rewards:pool", amountCents: -cents }, { walletId: w.id, account: `wallet:${ctx.user.id}`, amountCents: cents }], "Rewards to wallet", tx);
  }, { isolationLevel: "Serializable" });
  await audit(ctx, "pay.rewards_redeemed", "PayReward", undefined, { cents, count: ready.length });
  return cents;
}

export async function clearRewards() {
  return (await db.payReward.updateMany({ where: { status: "PENDING", availableAt: { lte: new Date() } }, data: { status: "AVAILABLE" } })).count;
}
