import { Prisma } from "@prisma/client";
import { db } from "../db";
import { HttpError } from "../http";
import { audit } from "../audit";
import { BASE, fmt, tradeFee, TRADE_MIN_CENTS } from "./config";
import { available, post, walletFor } from "./ledger";
import { checkPin, limitsFor, stepUp, STEP_UP_OVER_CENTS, type PayCtx } from "./guard";
import { notify } from "./notices";
import { usdRate } from "./fx";
import { ASSETS, quotes } from "./providers/market";
import * as alpaca from "./providers/alpaca";

// Buying and selling stocks, ETFs and crypto. Money moves between the wallet and "custody:invest" (cash held at
// the broker for customers); the fee goes to "revenue:fees". Orders are market orders, filled by Alpaca.
// Gold, silver and currencies are watch-only until a provider for them is connected.

export const TRADABLE = new Set(["STOCK", "CRYPTO"]);
const D = (n: number | string) => new Prisma.Decimal(n);

export async function portfolio(userId: string) {
  const [holdings, q, rate] = await Promise.all([db.payHolding.findMany({ where: { userId, quantity: { gt: 0 } } }), quotes(), usdRate()]);
  const rows = holdings.map((h) => {
    const p = q.find((x) => x.symbol === h.symbol);
    const qty = Number(h.quantity);
    const valueCents = p?.price != null ? Math.round(qty * p.price * rate * 100) : null;
    return { symbol: h.symbol, kind: h.kind, name: p?.name ?? h.symbol, quantity: qty, costCents: h.costCents, valueCents, priceUsd: p?.price ?? null, changePct: p?.changePct ?? null, gainCents: valueCents == null ? null : valueCents - h.costCents };
  });
  const valueCents = rows.reduce((a, r) => a + (r.valueCents ?? r.costCents), 0);
  const costCents = rows.reduce((a, r) => a + r.costCents, 0);
  return { currency: BASE, rows, valueCents, costCents, gainCents: valueCents - costCents };
}

export async function buy(ctx: PayCtx, input: { symbol: string; amountCents: number; pin: string; code?: string; idempotencyKey: string }) {
  const prior = await db.payTrade.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (prior) { if (prior.userId !== ctx.user.id) throw new HttpError(409, "Duplicate request."); return prior; }
  const a = ASSETS.find((x) => x.symbol === input.symbol);
  if (!a || !TRADABLE.has(a.kind)) throw new HttpError(422, "That one can be watched but not traded yet.");
  if (input.amountCents < TRADE_MIN_CENTS) throw new HttpError(422, `The smallest order is ${fmt(TRADE_MIN_CENTS)}.`);
  const lim = await limitsFor(ctx);
  if (input.amountCents > lim.perTransfer) throw new HttpError(403, "That's over your per-order limit.", { code: "LIMIT" });
  await checkPin(ctx, input.pin);
  if (input.amountCents >= STEP_UP_OVER_CENTS) await stepUp(ctx, input.code, "confirm this order");
  const fee = tradeFee(input.amountCents);
  const { availableCents } = await available(ctx.user.id);
  if (availableCents < input.amountCents + fee) throw new HttpError(402, "Not enough money in your wallet. Add money first.");

  const t = await db.$transaction(async (tx) => {
    const w = await walletFor(ctx.user.id, BASE, tx);
    const t = await tx.payTrade.create({ data: { userId: ctx.user.id, symbol: a.symbol, kind: a.kind, side: "BUY", amountCents: input.amountCents, feeCents: fee, idempotencyKey: input.idempotencyKey } });
    await post(ctx.user.id, "INVEST_BUY", `trade:${t.id}`, [
      { walletId: w.id, account: `wallet:${ctx.user.id}`, amountCents: -(input.amountCents + fee) },
      { account: "custody:invest", amountCents: input.amountCents },
      ...(fee ? [{ account: "revenue:fees", amountCents: fee }] : []),
    ], `Buy ${a.name}`, tx);
    return t;
  }, { isolationLevel: "Serializable" });
  await audit(ctx, "pay.trade_buy", "PayTrade", t.id, { symbol: a.symbol, amountCents: t.amountCents });

  try {
    const rate = await usdRate();
    const o = await alpaca.order({ clientOrderId: t.id, symbol: a.symbol, kind: a.kind, side: "buy", notionalUsd: input.amountCents / 100 / rate });
    await db.payTrade.update({ where: { id: t.id }, data: { providerRef: o.id } });
  } catch (e) {
    await failTrade(t.id, e instanceof Error ? e.message : "The broker refused the order.");
    throw e;
  }
  return settle(t.id);
}

export async function sell(ctx: PayCtx, input: { symbol: string; amountCents?: number; all?: boolean; pin: string; code?: string; idempotencyKey: string }) {
  const prior = await db.payTrade.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (prior) { if (prior.userId !== ctx.user.id) throw new HttpError(409, "Duplicate request."); return prior; }
  const h = await db.payHolding.findUnique({ where: { userId_symbol: { userId: ctx.user.id, symbol: input.symbol } } });
  if (!h || Number(h.quantity) <= 0) throw new HttpError(404, "You don't own any of that.");
  const p = (await quotes()).find((x) => x.symbol === input.symbol);
  if (p?.price == null) throw new HttpError(503, "We can't get a live price right now. Try again in a minute.");
  const rate = await usdRate();
  const owned = Number(h.quantity);
  const qty = input.all ? owned : Math.min(owned, (input.amountCents ?? 0) / 100 / rate / p.price);
  if (!(qty > 0)) throw new HttpError(422, "Enter an amount to sell.");
  const estCents = Math.round(qty * p.price * rate * 100);
  await checkPin(ctx, input.pin);
  if (estCents >= STEP_UP_OVER_CENTS) await stepUp(ctx, input.code, "confirm this order");
  const q = D(qty.toFixed(10));
  const costPart = Math.round(h.costCents * (qty / owned));

  // Reserve the units now so two sells can't spend the same shares.
  const t = await db.$transaction(async (tx) => {
    const moved = await tx.payHolding.updateMany({ where: { id: h.id, quantity: { gte: q } }, data: { quantity: { decrement: q }, costCents: { decrement: costPart } } });
    if (!moved.count) throw new HttpError(409, "Your holding changed. Refresh and try again.");
    return tx.payTrade.create({ data: { userId: ctx.user.id, symbol: h.symbol, kind: h.kind, side: "SELL", amountCents: estCents, quantity: q, costCents: costPart, idempotencyKey: input.idempotencyKey } });
  });
  await audit(ctx, "pay.trade_sell", "PayTrade", t.id, { symbol: h.symbol, quantity: qty });
  try {
    const o = await alpaca.order({ clientOrderId: t.id, symbol: h.symbol, kind: h.kind, side: "sell", qty: qty.toFixed(9) });
    await db.payTrade.update({ where: { id: t.id }, data: { providerRef: o.id } });
  } catch (e) {
    await failTrade(t.id, e instanceof Error ? e.message : "The broker refused the order.");
    throw e;
  }
  return settle(t.id);
}

/** Read the order from the broker and book the result. Safe to call again (cron calls it for pending orders). */
export async function settle(tradeId: string) {
  const t = await db.payTrade.findUniqueOrThrow({ where: { id: tradeId } });
  if (t.status !== "PENDING") return t;
  const o = await alpaca.byClientId(t.id).catch(() => null);
  if (!o) return t;
  if (["canceled", "expired", "rejected"].includes(o.status)) return failTrade(t.id, `The order was ${o.status}.`);
  if (o.status !== "filled" || !o.filled_qty || !o.filled_avg_price) return t;
  const qty = Number(o.filled_qty), priceUsd = Number(o.filled_avg_price);
  const rate = await usdRate();
  const priceCents = Math.round(priceUsd * rate * 100);
  if (t.side === "BUY") {
    const done = await db.$transaction(async (tx) => {
      const claimed = await tx.payTrade.updateMany({ where: { id: t.id, status: "PENDING" }, data: { status: "FILLED", filledAt: new Date(), quantity: D(qty), priceCents } });
      if (!claimed.count) return false;
      await tx.payHolding.upsert({
        where: { userId_symbol: { userId: t.userId, symbol: t.symbol } },
        create: { userId: t.userId, symbol: t.symbol, kind: t.kind, quantity: D(qty), costCents: t.amountCents },
        update: { quantity: { increment: D(qty) }, costCents: { increment: t.amountCents } },
      });
      return true;
    });
    if (done) await notify(t.userId, "INVEST", `You bought ${t.symbol}`, `${fmt(t.amountCents)} at ${fmt(priceCents)} each.`, "/app/invest");
  } else {
    const gross = Math.round(qty * priceUsd * rate * 100);
    const fee = tradeFee(gross);
    const done = await db.$transaction(async (tx) => {
      const claimed = await tx.payTrade.updateMany({ where: { id: t.id, status: "PENDING" }, data: { status: "FILLED", filledAt: new Date(), quantity: D(qty), priceCents, amountCents: gross, feeCents: fee } });
      if (!claimed.count) return false;
      const w = await walletFor(t.userId, BASE, tx);
      await post(t.userId, "INVEST_SELL", `trade:${t.id}`, [
        { account: "custody:invest", amountCents: -gross },
        { walletId: w.id, account: `wallet:${t.userId}`, amountCents: gross - fee },
        ...(fee ? [{ account: "revenue:fees", amountCents: fee }] : []),
      ], `Sold ${t.symbol}`, tx);
      return true;
    });
    if (done) await notify(t.userId, "INVEST", `You sold ${t.symbol}`, `${fmt(gross - fee)} is in your wallet.`, "/app/invest");
  }
  return db.payTrade.findUniqueOrThrow({ where: { id: t.id } });
}

/** A failed buy returns the money with the fee; a failed sell puts the units back. */
export async function failTrade(tradeId: string, reason: string) {
  const t = await db.payTrade.findUniqueOrThrow({ where: { id: tradeId } });
  if (t.status !== "PENDING") return t;
  await db.$transaction(async (tx) => {
    const claimed = await tx.payTrade.updateMany({ where: { id: t.id, status: "PENDING" }, data: { status: "FAILED", failureReason: reason.slice(0, 300) } });
    if (!claimed.count) return;
    if (t.side === "BUY") {
      const w = await walletFor(t.userId, BASE, tx);
      await post(t.userId, "INVEST_REFUND", `trade-back:${t.id}`, [
        { account: "custody:invest", amountCents: -t.amountCents },
        ...(t.feeCents ? [{ account: "revenue:fees", amountCents: -t.feeCents }] : []),
        { walletId: w.id, account: `wallet:${t.userId}`, amountCents: t.amountCents + t.feeCents },
      ], `Order for ${t.symbol} didn't go through`, tx);
    } else if (t.quantity) {
      const h = await tx.payHolding.findUnique({ where: { userId_symbol: { userId: t.userId, symbol: t.symbol } } });
      if (h) await tx.payHolding.update({ where: { id: h.id }, data: { quantity: { increment: t.quantity }, costCents: { increment: t.costCents } } });
    }
  });
  await notify(t.userId, "INVEST", `Your ${t.side === "BUY" ? "buy" : "sell"} order for ${t.symbol} didn't go through`, t.side === "BUY" ? "Your money is back in your wallet." : "Your units are back in your portfolio.", "/app/invest");
  return db.payTrade.findUniqueOrThrow({ where: { id: t.id } });
}

export async function settlePending() {
  const open = await db.payTrade.findMany({ where: { status: "PENDING", createdAt: { lt: new Date(Date.now() - 15_000) } }, take: 50 });
  for (const t of open) await settle(t.id).catch(() => {});
  return open.length;
}
