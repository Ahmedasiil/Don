import { Prisma } from "@prisma/client";
import { db } from "../db";
import { HttpError } from "../http";
import { audit } from "../audit";
import { decrypt, encrypt } from "../crypto";
import { BASE, FX_MARKUP_BPS, corridor, option, transferFee, TRAVEL_RULE_OVER_CENTS } from "./config";
import { available, post, walletFor } from "./ledger";
import { alert, checkPin, limitsFor, stepUp, STEP_UP_OVER_CENTS, type PayCtx } from "./guard";
import { assessTransfer, riskEvent } from "./risk";
import * as airwallex from "./providers/airwallex";
import * as thunes from "./providers/thunes";

// Sending money abroad: quote, recipient, transfer, payout, and the money coming back if anything fails.
// Ledger accounts: the person's wallet, "clearing:transfers" while money is on its way, "revenue:fees" for our fee.

export interface Details { accountNumber?: string; iban?: string; swift?: string; bankName?: string; phone?: string; ipa?: string; cardNumber?: string; walletId?: string; city?: string; street?: string }

const mask = (s?: string) => (s ? `···· ${s.replace(/\s/g, "").slice(-4)}` : "");

/** Rate and fee for an amount. The receive amount shown is what the person gets, after our FX margin. */
export async function quote(country: string, method: string, sendCents: number) {
  const c = corridor(country);
  const o = option(country, method);
  if (!c || !o) throw new HttpError(422, "We don't send that way to that country yet.");
  if (sendCents < 500) throw new HttpError(422, "The smallest transfer is 5.00.");
  const fee = transferFee(sendCents);
  const mid = o.provider === "internal" ? 1 : await airwallex.rate(BASE, c.currency, sendCents / 100);
  const rate = c.currency === BASE ? 1 : mid * (1 - FX_MARKUP_BPS / 10_000);
  return { sendCents, sendCurrency: BASE, feeCents: fee, totalCents: sendCents + fee, rate: Number(rate.toFixed(6)), receiveCents: Math.floor(sendCents * rate), receiveCurrency: c.currency, provider: o.provider, eta: o.eta, method: o.method };
}

export async function addRecipient(ctx: PayCtx, input: { name: string; country: string; method: string; network?: string | null; details: Details; code?: string }) {
  const c = corridor(input.country);
  const o = option(input.country, input.method);
  if (!c || !o) throw new HttpError(422, "We don't send that way to that country yet.");
  for (const f of o.fields) if (!input.details[f]?.trim()) throw new HttpError(422, `Please add the recipient's ${f.replace(/([A-Z])/g, " $1").toLowerCase()}.`);
  if (o.networks?.length && input.network && !o.networks.includes(input.network)) throw new HttpError(422, "Pick a network from the list.");
  // New recipients are the main way stolen accounts get emptied: always ask for a fresh authenticator code.
  await stepUp(ctx, input.code, "add a new recipient");
  const shown = input.details.iban || input.details.accountNumber || input.details.phone || input.details.ipa || input.details.cardNumber || input.details.walletId;
  const r = await db.payRecipient.create({
    data: { userId: ctx.user.id, name: input.name.trim(), country: c.country, currency: c.currency, method: o.method, network: input.network ?? null, detailsEnc: encrypt(JSON.stringify(input.details)), label: `${input.network ?? o.label} ${mask(shown)}`.trim() },
  });
  await audit(ctx, "pay.recipient_added", "PayRecipient", r.id, { country: r.country, method: r.method, ip: ctx.ip });
  await alert(ctx.user, "New recipient added", `${r.name} (${r.label}) was added to your oenodpay recipients. If this wasn't you, freeze your account now.`);
  return r;
}

export async function send(ctx: PayCtx, input: { recipientId: string; sendCents: number; pin: string; code?: string; idempotencyKey: string }) {
  const prior = await db.payTransfer.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (prior) { if (prior.userId !== ctx.user.id) throw new HttpError(409, "Duplicate request."); return prior; }

  const r = await db.payRecipient.findFirst({ where: { id: input.recipientId, userId: ctx.user.id } });
  if (!r) throw new HttpError(404, "Recipient not found.");
  const q = await quote(r.country, r.method, input.sendCents);

  // Limits for the person's verification level (lower on a new device).
  const lim = await limitsFor(ctx);
  if (q.sendCents > lim.perTransfer) throw new HttpError(403, lim.newDevice ? "On a new device you can send up to " + (lim.perTransfer / 100).toFixed(2) + " for the first 24 hours." : "That's over your per-transfer limit. Verify your address to raise it.", { code: "LIMIT" });
  const since = (ms: number) => db.payTransfer.aggregate({ where: { userId: ctx.user.id, createdAt: { gte: new Date(Date.now() - ms) }, status: { notIn: ["FAILED", "CANCELLED", "REFUNDED"] } }, _sum: { sendCents: true } }).then((a) => a._sum.sendCents ?? 0);
  const [day, month] = await Promise.all([since(86400_000), since(30 * 86400_000)]);
  if (day + q.sendCents > lim.daily) throw new HttpError(403, "That's over your daily sending limit.", { code: "LIMIT" });
  if (month + q.sendCents > lim.monthly) throw new HttpError(403, "That's over your 30-day sending limit.", { code: "LIMIT" });

  await checkPin(ctx, input.pin);
  const firstToRecipient = !(await db.payTransfer.count({ where: { recipientId: r.id, status: { in: ["SENT", "DELIVERED"] } } }));
  if (q.sendCents >= STEP_UP_OVER_CENTS || (firstToRecipient && q.sendCents >= STEP_UP_OVER_CENTS / 4)) await stepUp(ctx, input.code, "confirm this transfer");

  // Travel rule: above the threshold the sender must be fully identified (name, date of birth, address via KYC).
  if (q.sendCents >= TRAVEL_RULE_OVER_CENTS && (!ctx.profile.legalName || !ctx.profile.dob)) throw new HttpError(403, "Finish identity verification to send this amount.", { code: "KYC_REQUIRED" });

  const verdict = await assessTransfer({ userId: ctx.user.id, sendCents: q.sendCents, country: r.country, recipient: r });
  const { availableCents } = await available(ctx.user.id);
  if (availableCents < q.totalCents) throw new HttpError(402, "Not enough money in your wallet. Add money first.");

  const t = await db.$transaction(async (tx) => {
    const wallet = await walletFor(ctx.user.id, BASE, tx);
    const t = await tx.payTransfer.create({
      data: {
        userId: ctx.user.id, recipientId: r.id, sendCents: q.sendCents, sendCurrency: BASE, receiveCents: q.receiveCents, receiveCurrency: q.receiveCurrency,
        rate: new Prisma.Decimal(q.rate), feeCents: q.feeCents, provider: q.provider, idempotencyKey: input.idempotencyKey, ip: ctx.ip,
        status: verdict.action === "BLOCK" ? "CANCELLED" : verdict.action === "REVIEW" ? "REVIEW" : "PROCESSING",
        riskFlags: verdict.flags, failureReason: verdict.action === "BLOCK" ? "Stopped by our compliance checks" : null,
      },
    });
    if (verdict.action !== "BLOCK") {
      await post(ctx.user.id, "TRANSFER", `transfer:${t.id}`, [
        { walletId: wallet.id, account: `wallet:${ctx.user.id}`, amountCents: -q.totalCents },
        { account: "clearing:transfers", amountCents: q.sendCents },
        { account: "revenue:fees", amountCents: q.feeCents },
      ], `To ${r.name}`, tx);
    }
    return t;
  }, { isolationLevel: "Serializable" });

  await audit(ctx, "pay.transfer_created", "PayTransfer", t.id, { sendCents: t.sendCents, country: r.country, verdict: verdict.action, flags: verdict.flags, ip: ctx.ip });
  if (verdict.action !== "ALLOW") {
    await riskEvent(ctx.user.id, verdict.flags[0] ?? "REVIEW", verdict.action === "BLOCK" ? "CRITICAL" : "MEDIUM", "PayTransfer", t.id, verdict);
  }
  if (verdict.action === "BLOCK") throw new HttpError(403, "We can't send this transfer. Our compliance team will contact you if they need anything.", { code: "BLOCKED", transferId: t.id });
  if (verdict.action === "ALLOW") return dispatch(t.id);
  return t;
}

/** Hand the money to the payout provider. Safe to call again: providers dedupe on our transfer id. */
export async function dispatch(transferId: string) {
  const t = await db.payTransfer.findUniqueOrThrow({ where: { id: transferId }, include: { recipient: true } });
  if (!["PROCESSING", "REVIEW"].includes(t.status)) return t;
  const r = t.recipient;
  const d = JSON.parse(decrypt(r.detailsEnc) ?? "{}") as Details;
  const sender = await db.payProfile.findUnique({ where: { userId: t.userId } });
  const user = await db.user.findUniqueOrThrow({ where: { id: t.userId } });
  const [sf, ...sl] = (sender?.legalName ?? user.name).split(/\s+/);
  const [bf, ...bl] = r.name.split(/\s+/);
  try {
    let res: { providerRef: string; status: string };
    if (t.provider === "internal") {
      const to = await db.user.findFirst({ where: { OR: [{ phone: d.phone }, { email: d.phone?.toLowerCase() }] } });
      if (!to || to.id === t.userId) throw new HttpError(422, "No oenodpay account with that phone or email.");
      const w = await walletFor(to.id, BASE);
      await post(to.id, "TRANSFER_IN", `transfer-in:${t.id}`, [
        { account: "clearing:transfers", amountCents: -t.sendCents },
        { walletId: w.id, account: `wallet:${to.id}`, amountCents: t.sendCents },
      ], `From ${user.name}`);
      res = { providerRef: `internal:${to.id}`, status: "DELIVERED" };
    } else if (t.provider === "airwallex") {
      res = await airwallex.payout({ requestId: t.id, sourceCurrency: t.sendCurrency, sourceAmount: t.sendCents / 100, reference: `oenodpay ${t.id.slice(-8)}`, to: { name: r.name, country: r.country, currency: r.currency, accountNumber: d.accountNumber, iban: d.iban, swift: d.swift, bankName: d.bankName, address: { city: d.city, street: d.street } } });
    } else {
      const service = r.method === "BANK" ? "bank" : r.method === "CASH_PICKUP" ? "cash" : "mobile";
      const payer = await thunes.findPayer(r.country, r.method === "INSTAPAY" ? "InstaPay" : r.network, service);
      if (!payer) throw new HttpError(502, "No payout partner is available for that method right now.");
      const q = await thunes.quote({ externalId: `q-${t.id}-${Date.now().toString(36)}`, payerId: payer.id, sourceCurrency: t.sendCurrency, sourceAmount: t.sendCents / 100, country: r.country, destCurrency: r.currency });
      res = await thunes.send({
        quoteId: q.id, externalId: t.id,
        creditParty: { msisdn: d.phone, bank_account_number: d.accountNumber ?? d.ipa ?? d.walletId, iban: d.iban, card_number: d.cardNumber },
        sender: { firstname: sf, lastname: sl.join(" ") || sf, country: sender?.country ?? undefined, nationality: sender?.nationality ?? undefined, dob: sender?.dob?.toISOString().slice(0, 10) },
        beneficiary: { firstname: bf, lastname: bl.join(" ") || bf, country: r.country, phone: d.phone },
      });
    }
    return db.payTransfer.update({ where: { id: t.id }, data: { providerRef: res.providerRef, status: res.status === "DELIVERED" ? "DELIVERED" : "SENT" } });
  } catch (e) {
    // Only a clear "no" from the provider is final. A timeout may still have paid out, so the money stays
    // in clearing and the cron retries (providers dedupe on our id) until we know for sure.
    const status = e instanceof HttpError ? (e.details as { status?: number } | undefined)?.status : undefined;
    if (e instanceof HttpError && (e.status === 422 || (status && status >= 400 && status < 500 && status !== 409 && status !== 429))) {
      await fail(t.id, e.message);
      throw e;
    }
    await db.payTransfer.update({ where: { id: t.id }, data: { status: "PROCESSING", failureReason: "Waiting for the payout partner to confirm" } });
    await riskEvent(t.userId, "PAYOUT_UNCONFIRMED", "LOW", "PayTransfer", t.id, { error: e instanceof Error ? e.message : String(e) });
    return db.payTransfer.findUniqueOrThrow({ where: { id: t.id } });
  }
}

/** Transfers stuck in PROCESSING with no provider reference: look them up or send again (idempotent). */
export async function retryStuck() {
  const stuck = await db.payTransfer.findMany({ where: { status: "PROCESSING", providerRef: null, updatedAt: { lt: new Date(Date.now() - 10 * 60_000) } }, take: 20 });
  for (const t of stuck) {
    if (t.provider === "airwallex") {
      const found = await airwallex.byRequestId(t.id).catch(() => undefined);
      if (found === undefined) continue; // couldn't check: try again next run, never risk a second payout
      if (found) { await db.payTransfer.update({ where: { id: t.id }, data: { providerRef: found.id, status: "SENT", failureReason: null } }); await settle("airwallex", found.id, found.status, found.failure_reason); continue; }
    }
    if (t.provider === "thunes") {
      const found = await thunes.byExternalId(t.id).catch((e) => (e instanceof HttpError && (e.details as { status?: number } | undefined)?.status === 404 ? null : undefined));
      if (found === undefined) continue;
      if (found) { await db.payTransfer.update({ where: { id: t.id }, data: { providerRef: String(found.id), status: "SENT", failureReason: null } }); await settle("thunes", String(found.id), found.status_message || found.status); continue; }
    }
    await db.payTransfer.update({ where: { id: t.id }, data: { updatedAt: new Date() } });
    await dispatch(t.id).catch((e) => console.error("retry dispatch", t.id, e));
  }
  return stuck.length;
}

/** The payout failed or was rejected: give the money and the fee back. */
export async function fail(transferId: string, reason: string, status: "FAILED" | "CANCELLED" | "REFUNDED" = "FAILED") {
  const t = await db.payTransfer.findUniqueOrThrow({ where: { id: transferId } });
  if (["FAILED", "CANCELLED", "REFUNDED", "DELIVERED"].includes(t.status)) return t;
  const w = await walletFor(t.userId, t.sendCurrency);
  await post(t.userId, "TRANSFER_REFUND", `refund:${t.id}`, [
    { account: "clearing:transfers", amountCents: -t.sendCents },
    { account: "revenue:fees", amountCents: -t.feeCents },
    { walletId: w.id, account: `wallet:${t.userId}`, amountCents: t.sendCents + t.feeCents },
  ], "Transfer refunded");
  const u = await db.payTransfer.update({ where: { id: t.id }, data: { status, failureReason: reason.slice(0, 300) } });
  const user = await db.user.findUnique({ where: { id: t.userId } });
  if (user) await alert(user, "Your transfer was not sent", "The money and the fee are back in your oenodpay wallet.");
  return u;
}

/** Provider status updates (webhooks and the cron sync) land here. */
export async function settle(provider: string, providerRef: string, status: string, reason?: string) {
  const t = await db.payTransfer.findFirst({ where: { provider, providerRef } });
  if (!t) return null;
  const s = status.toUpperCase();
  if (["PAID", "COMPLETED", "SETTLED", "DELIVERED"].some((x) => s.includes(x))) return db.payTransfer.update({ where: { id: t.id }, data: { status: "DELIVERED" } });
  if (["FAILED", "REJECTED", "CANCELLED", "DECLINED", "REVERSED", "RETURNED"].some((x) => s.includes(x))) return fail(t.id, reason ?? `Provider status ${status}`);
  return t;
}

/** Compliance officer decision on a transfer held for review. */
export async function decide(transferId: string, adminId: string, approve: boolean, note?: string) {
  const t = await db.payTransfer.findUniqueOrThrow({ where: { id: transferId } });
  if (t.status !== "REVIEW") throw new HttpError(409, "This transfer isn't waiting for review.");
  await db.payTransfer.update({ where: { id: t.id }, data: { reviewedBy: adminId, reviewedAt: new Date(), status: approve ? "PROCESSING" : "REVIEW" } });
  await db.payRiskEvent.updateMany({ where: { entity: "PayTransfer", entityId: t.id, status: "OPEN" }, data: { status: approve ? "CLEARED" : "ESCALATED", reviewedBy: adminId, note, decidedAt: new Date() } });
  return approve ? dispatch(t.id) : fail(t.id, note || "Not approved by compliance", "CANCELLED");
}
