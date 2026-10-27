import { z } from "zod";
import { db } from "../db";
import { HttpError } from "../http";
import { audit } from "../audit";
import { encrypt } from "../crypto";
import { BASE, billFee, fmt } from "./config";
import { available, post, walletFor } from "./ledger";
import { checkPin, limitsFor, stepUp, STEP_UP_OVER_CENTS, type PayCtx } from "./guard";
import { notify } from "./notices";

// Paying bills. The money leaves the wallet into "clearing:bills" when the payment runs; the operations team
// pays the biller through the company bank (or the biller's provider) and records the confirmation number in
// the super admin, which moves it to "payout:bills". If a payment can't be made, the money comes back.

const mask = (s: string) => `···· ${s.replace(/\s/g, "").slice(-4)}`;
const day = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export async function addPayee(ctx: PayCtx, input: { billerId: string; account: string; nickname?: string }) {
  const b = await db.payBiller.findFirst({ where: { id: input.billerId, active: true } });
  if (!b) throw new HttpError(404, "Biller not found.");
  const acct = input.account.trim();
  if (acct.length < 4) throw new HttpError(422, `Enter your ${b.accountLabel.toLowerCase()}.`);
  const p = await db.payBillPayee.create({ data: { userId: ctx.user.id, billerId: b.id, nickname: input.nickname?.trim() || null, accountEnc: encrypt(acct), label: `${b.name} ${mask(acct)}` } });
  await audit(ctx, "pay.bill_payee_added", "PayBillPayee", p.id, { biller: b.name });
  return p;
}

export async function payBill(ctx: PayCtx, input: { payeeId: string; amountCents: number; date?: string; repeat?: "MONTHLY" | null; pin: string; code?: string; idempotencyKey: string }) {
  const prior = await db.payBillPayment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (prior) { if (prior.userId !== ctx.user.id) throw new HttpError(409, "Duplicate request."); return prior; }
  const payee = await db.payBillPayee.findFirst({ where: { id: input.payeeId, userId: ctx.user.id }, include: { biller: true } });
  if (!payee || !payee.biller.active) throw new HttpError(404, "Payee not found.");
  if (input.amountCents < 100) throw new HttpError(422, "The smallest bill payment is 1.00.");
  const lim = await limitsFor(ctx);
  if (input.amountCents > lim.perTransfer) throw new HttpError(403, "That's over your per-payment limit.", { code: "LIMIT" });
  const when = input.date ? day(new Date(input.date)) : day(new Date());
  if (Number.isNaN(when.getTime()) || when < day(new Date()) || when.getTime() - Date.now() > 366 * 86400_000) throw new HttpError(422, "Pick a date from today to a year from now.");
  await checkPin(ctx, input.pin);
  if (input.amountCents >= STEP_UP_OVER_CENTS) await stepUp(ctx, input.code, "confirm this bill payment");
  const p = await db.payBillPayment.create({
    data: { userId: ctx.user.id, payeeId: payee.id, amountCents: input.amountCents, feeCents: billFee(), currency: BASE, scheduledFor: when, repeat: input.repeat ?? null, idempotencyKey: input.idempotencyKey },
  });
  await audit(ctx, "pay.bill_scheduled", "PayBillPayment", p.id, { amountCents: p.amountCents, biller: payee.biller.name, scheduledFor: when });
  return when <= day(new Date()) ? run(p.id) : p;
}

/** Take the money for a payment that is due. Called right away for today's payments and by the cron. */
export async function run(paymentId: string) {
  const p = await db.payBillPayment.findUniqueOrThrow({ where: { id: paymentId }, include: { payee: { include: { biller: true } } } });
  if (p.status !== "SCHEDULED") return p;
  const total = p.amountCents + p.feeCents;
  const { availableCents } = await available(p.userId, p.currency);
  if (availableCents < total) {
    await db.payBillPayment.update({ where: { id: p.id }, data: { status: "FAILED", failureReason: "Not enough money in the wallet on the payment date." } });
    await notify(p.userId, "BILL", `Your ${p.payee.biller.name} payment didn't go through`, `There wasn't enough money in your wallet for ${fmt(total, p.currency)}. Add money and pay it again.`, "/app/bills");
    await scheduleNext(p);
    return db.payBillPayment.findUniqueOrThrow({ where: { id: p.id } });
  }
  await db.$transaction(async (tx) => {
    const claimed = await tx.payBillPayment.updateMany({ where: { id: p.id, status: "SCHEDULED" }, data: { status: "PROCESSING", journalRef: `bill:${p.id}` } });
    if (!claimed.count) return;
    const w = await walletFor(p.userId, p.currency, tx);
    await post(p.userId, "BILL", `bill:${p.id}`, [
      { walletId: w.id, account: `wallet:${p.userId}`, amountCents: -total, currency: p.currency },
      { account: "clearing:bills", amountCents: p.amountCents, currency: p.currency },
      ...(p.feeCents ? [{ account: "revenue:fees", amountCents: p.feeCents, currency: p.currency }] : []),
    ], `Bill · ${p.payee.biller.name}`, tx);
  }, { isolationLevel: "Serializable" });
  await notify(p.userId, "BILL", `Paying ${p.payee.biller.name}`, `${fmt(p.amountCents, p.currency)} is on its way. Most billers post it within 1 to 3 business days.`, "/app/bills");
  await scheduleNext(p);
  return db.payBillPayment.findUniqueOrThrow({ where: { id: p.id } });
}

async function scheduleNext(p: { id: string; userId: string; payeeId: string; amountCents: number; feeCents: number; currency: string; scheduledFor: Date; repeat: string | null }) {
  if (p.repeat !== "MONTHLY") return;
  const next = new Date(p.scheduledFor);
  next.setUTCMonth(next.getUTCMonth() + 1);
  await db.payBillPayment.upsert({
    where: { idempotencyKey: `repeat:${p.id}` },
    create: { userId: p.userId, payeeId: p.payeeId, amountCents: p.amountCents, feeCents: p.feeCents, currency: p.currency, scheduledFor: next, repeat: "MONTHLY", idempotencyKey: `repeat:${p.id}` },
    update: {},
  });
}

export async function cancelBill(ctx: PayCtx, id: string) {
  const p = await db.payBillPayment.findFirst({ where: { id, userId: ctx.user.id, status: "SCHEDULED" } });
  if (!p) throw new HttpError(404, "Only scheduled payments can be cancelled.");
  await db.payBillPayment.update({ where: { id }, data: { status: "CANCELLED" } });
  await audit(ctx, "pay.bill_cancelled", "PayBillPayment", id);
}

/** Super admin: the biller has the money (with its confirmation number), or it couldn't be paid. */
export async function settleBill(adminId: string, id: string, outcome: { paid: true; confirmation: string } | { paid: false; reason: string }) {
  const p = await db.payBillPayment.findUniqueOrThrow({ where: { id }, include: { payee: { include: { biller: true } } } });
  if (p.status !== "PROCESSING") throw new HttpError(409, "Only payments in progress can be settled.");
  if (outcome.paid) {
    await db.$transaction(async (tx) => {
      await tx.payBillPayment.update({ where: { id }, data: { status: "PAID", paidAt: new Date(), confirmation: outcome.confirmation } });
      await post(p.userId, "BILL_PAID", `bill-paid:${p.id}`, [{ account: "clearing:bills", amountCents: -p.amountCents, currency: p.currency }, { account: "payout:bills", amountCents: p.amountCents, currency: p.currency }], `Paid to ${p.payee.biller.name}`, tx);
    });
    await notify(p.userId, "BILL", `${p.payee.biller.name} has your payment`, `Confirmation ${outcome.confirmation}.`, "/app/bills");
  } else {
    await db.$transaction(async (tx) => {
      await tx.payBillPayment.update({ where: { id }, data: { status: "REFUNDED", failureReason: outcome.reason } });
      const w = await walletFor(p.userId, p.currency, tx);
      await post(p.userId, "BILL_REFUND", `bill-back:${p.id}`, [
        { account: "clearing:bills", amountCents: -p.amountCents, currency: p.currency },
        ...(p.feeCents ? [{ account: "revenue:fees", amountCents: -p.feeCents, currency: p.currency }] : []),
        { walletId: w.id, account: `wallet:${p.userId}`, amountCents: p.amountCents + p.feeCents, currency: p.currency },
      ], `${p.payee.biller.name} payment returned`, tx);
    });
    await notify(p.userId, "BILL", `We couldn't pay ${p.payee.biller.name}`, `${outcome.reason} Your money is back in your wallet.`, "/app/bills");
  }
  await db.auditLog.create({ data: { userId: adminId, actor: "super-admin", action: outcome.paid ? "pay.bill_paid" : "pay.bill_refunded", entity: "PayBillPayment", entityId: id } });
}

export async function runDueBills() {
  const due = await db.payBillPayment.findMany({ where: { status: "SCHEDULED", scheduledFor: { lte: new Date() } }, take: 200 });
  for (const p of due) await run(p.id).catch((e) => console.error("bill run failed", p.id, e));
  return due.length;
}

export const BILL_CATEGORIES = ["ELECTRICITY", "GAS", "WATER", "PHONE", "INTERNET", "TV", "TAX", "INSURANCE", "CREDIT_CARD", "EDUCATION", "OTHER"] as const;

/** Starter billers loaded by the seed. The super admin adds or turns off billers in Bill pay. */
export const STARTER_BILLERS = [
  { name: "Hydro One", country: "CA", category: "ELECTRICITY" }, { name: "Toronto Hydro", country: "CA", category: "ELECTRICITY" }, { name: "BC Hydro", country: "CA", category: "ELECTRICITY" }, { name: "Hydro-Québec", country: "CA", category: "ELECTRICITY" },
  { name: "Enbridge Gas", country: "CA", category: "GAS" }, { name: "FortisBC", country: "CA", category: "GAS" },
  { name: "Rogers", country: "CA", category: "PHONE" }, { name: "Bell", country: "CA", category: "PHONE" }, { name: "Telus", country: "CA", category: "PHONE" }, { name: "Fido", country: "CA", category: "PHONE" }, { name: "Freedom Mobile", country: "CA", category: "PHONE" },
  { name: "Canada Revenue Agency (CRA)", country: "CA", category: "TAX", accountLabel: "Social insurance number or business number" },
  { name: "City of Toronto property tax", country: "CA", category: "TAX", accountLabel: "Roll number" },
  { name: "Con Edison", country: "US", category: "ELECTRICITY" }, { name: "PG&E", country: "US", category: "ELECTRICITY" }, { name: "Verizon", country: "US", category: "PHONE" }, { name: "AT&T", country: "US", category: "PHONE" }, { name: "Comcast Xfinity", country: "US", category: "INTERNET" },
  { name: "Egyptian Electricity (EEHC)", country: "EG", category: "ELECTRICITY", accountLabel: "Meter or customer number" }, { name: "Vodafone Egypt", country: "EG", category: "PHONE", accountLabel: "Mobile number" },
  { name: "Orange Egypt", country: "EG", category: "PHONE", accountLabel: "Mobile number" }, { name: "WE (Telecom Egypt)", country: "EG", category: "INTERNET", accountLabel: "Landline or account number" },
  { name: "Etisalat by e& Egypt", country: "EG", category: "PHONE", accountLabel: "Mobile number" }, { name: "Natural gas (Town Gas)", country: "EG", category: "GAS", accountLabel: "Customer number" },
] as const;


/** What the super admin enters for a biller. */
export const billerSchema = z.object({
  name: z.string().trim().min(2).max(80), country: z.string().length(2).transform((s) => s.toUpperCase()), category: z.enum(BILL_CATEGORIES),
  provider: z.enum(["ops", "fawry"]).default("ops"), providerCode: z.string().max(40).nullable().optional(),
  accountLabel: z.string().max(40).default("Account number"), accountHint: z.string().max(120).nullable().optional(), active: z.boolean().default(true),
});
