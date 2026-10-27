import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { HttpError } from "../http";
import { BASE } from "./config";

type Tx = Prisma.TransactionClient;
export interface Line { account: string; amountCents: number; currency?: string; walletId?: string }

/** The person's wallet in a currency, created on first use. */
export async function walletFor(userId: string, currency = BASE, tx: Tx | typeof db = db) {
  return tx.payWallet.upsert({ where: { userId_currency: { userId, currency } }, create: { userId, currency }, update: {} });
}

/**
 * Post a balanced journal. Lines must sum to zero per currency; wallet lines move the wallet's cached
 * balance in the same database transaction, and a wallet can never go below zero.
 * The reference is unique, so retrying the same event (a webhook, a double click) posts nothing new.
 */
export async function post(userId: string, kind: string, reference: string, lines: Line[], memo?: string, tx?: Tx) {
  const sums = new Map<string, number>();
  for (const l of lines) {
    if (!Number.isInteger(l.amountCents)) throw new Error("Ledger amounts must be whole cents");
    const c = l.currency ?? BASE;
    sums.set(c, (sums.get(c) ?? 0) + l.amountCents);
  }
  for (const [c, s] of sums) if (s !== 0) throw new Error(`Unbalanced journal ${reference}: ${c} off by ${s}`);

  const run = async (t: Tx) => {
    const existing = await t.payJournal.findUnique({ where: { reference } });
    if (existing) return { journal: existing, duplicate: true };
    const journal = await t.payJournal.create({ data: { userId, kind, reference, memo } });
    for (const l of lines) {
      if (l.walletId) {
        // Conditional update: a debit only succeeds while the available balance covers it.
        const moved = await t.payWallet.updateMany({
          where: { id: l.walletId, ...(l.amountCents < 0 ? { balanceCents: { gte: -l.amountCents } } : {}) },
          data: { balanceCents: { increment: l.amountCents } },
        });
        if (!moved.count) throw new HttpError(402, "Not enough money in your wallet for this.");
      }
      await t.payLedgerLine.create({ data: { journalId: journal.id, walletId: l.walletId, account: l.account, amountCents: l.amountCents, currency: l.currency ?? BASE } });
    }
    return { journal, duplicate: false };
  };
  return tx ? run(tx) : db.$transaction(run, { isolationLevel: "Serializable" });
}

/** Money the person can spend now: balance minus anything held for transfers in review. */
export async function available(userId: string, currency = BASE) {
  const w = await walletFor(userId, currency);
  return { wallet: w, availableCents: w.balanceCents - w.heldCents };
}

/** Recent wallet activity, newest first, for statements and the coach. */
export async function activity(userId: string, take = 50) {
  const journals = await db.payJournal.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take, include: { lines: true } });
  return journals.map((j) => {
    const w = j.lines.filter((l) => l.walletId);
    return { id: j.id, kind: j.kind, memo: j.memo, at: j.createdAt, amountCents: w.reduce((s, l) => s + l.amountCents, 0), currency: w[0]?.currency ?? BASE };
  });
}
