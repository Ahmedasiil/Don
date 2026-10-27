import { db } from "../db";
import { HttpError } from "../http";
import { audit } from "../audit";
import { BASE, fmt, lendingOn, LOAN_BANDS, LOAN_TERMS } from "./config";
import { available, post, walletFor } from "./ledger";
import { checkPin, stepUp, type PayCtx } from "./guard";
import { notify } from "./notices";
import { healthScore } from "./ai";
import { riskEvent } from "./risk";

// The oenodpay credit score and personal loans.
// The score (300-900, like Canadian bureau scores) comes from how the account is run: it is not a bureau score
// and is labelled that way in the app. Loans are funded from "lending:capital", approved by a person in the
// super admin, and repaid automatically from the wallet each month.

export const bandOf = (s: number) => (s >= 800 ? "EXCELLENT" : s >= 720 ? "VERY_GOOD" : s >= 660 ? "GOOD" : s >= 560 ? "FAIR" : "POOR");

export async function computeScore(userId: string) {
  const [profile, user, health, loans, bills, risks, transfers] = await Promise.all([
    db.payProfile.findUnique({ where: { userId } }),
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { createdAt: true, totpEnabledAt: true } }),
    healthScore(userId),
    db.payLoanPayment.groupBy({ by: ["status"], where: { loan: { userId } }, _count: true }),
    db.payBillPayment.count({ where: { userId, status: "PAID" } }),
    db.payRiskEvent.count({ where: { userId, severity: { in: ["HIGH", "CRITICAL"] }, createdAt: { gte: new Date(Date.now() - 365 * 864e5) } } }),
    db.payTransfer.count({ where: { userId, status: "DELIVERED" } }),
  ]);
  const months = (Date.now() - user.createdAt.getTime()) / (30 * 864e5);
  const paid = loans.find((l) => l.status === "PAID")?._count ?? 0;
  const missed = loans.find((l) => l.status === "MISSED")?._count ?? 0;
  const f = {
    identity: profile?.kycStatus === "VERIFIED" ? (profile.tier >= 2 ? 100 : 80) : 0,
    history: Math.round(Math.min(1, months / 24) * 100),
    payments: missed ? Math.max(0, 100 - missed * 35) : Math.min(100, 60 + paid * 8 + Math.min(bills, 10) * 2),
    savings: health.parts.buffer,
    habits: Math.round((health.parts.savings + health.parts.steadiness) / 2),
    activity: Math.min(100, transfers * 10 + bills * 5),
    security: user.totpEnabledAt ? 100 : 40,
  };
  let raw = f.identity * 0.15 + f.history * 0.15 + f.payments * 0.3 + f.savings * 0.15 + f.habits * 0.1 + f.activity * 0.1 + f.security * 0.05;
  if (risks) raw *= 0.7;
  if (profile?.frozenAt) raw *= 0.5;
  const score = Math.round(300 + (Math.max(0, Math.min(100, raw)) / 100) * 600);
  const factors = [
    { key: "payments", label: "Paying on time", value: f.payments, tip: missed ? "Missed loan payments weigh the most. Keep money in your wallet before each due date." : "Pay bills through oenodpay and repay on time to build this." },
    { key: "history", label: "Account age", value: f.history, tip: "This grows on its own as your account gets older." },
    { key: "identity", label: "Verified identity", value: f.identity, tip: f.identity < 100 ? "Verify your address to reach the highest level." : "Fully verified." },
    { key: "savings", label: "Savings cushion", value: f.savings, tip: "Keep about three months of spending in your wallet." },
    { key: "habits", label: "Money habits", value: f.habits, tip: "Spend less than comes in, most months." },
    { key: "activity", label: "Account activity", value: f.activity, tip: "Regular transfers and bill payments show a steady record." },
    { key: "security", label: "Account security", value: f.security, tip: user.totpEnabledAt ? "Two-step sign-in is on." : "Turn on two-step sign-in." },
  ];
  return { score, band: bandOf(score), factors };
}

/** Today's score, recalculated at most once a day, with the last 12 for the chart. */
export async function creditSummary(userId: string) {
  const last = await db.payCreditScore.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  let current = last;
  if (!last || Date.now() - last.createdAt.getTime() > 86400_000) {
    const s = await computeScore(userId);
    current = await db.payCreditScore.create({ data: { userId, score: s.score, band: s.band, factors: s.factors } });
  }
  const historyRows = await db.payCreditScore.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 12 });
  const band = LOAN_BANDS[current!.band] ?? LOAN_BANDS.POOR;
  const active = await db.payLoan.findFirst({ where: { userId, status: { in: ["REVIEW", "APPROVED", "ACTIVE"] } } });
  return {
    score: current!.score, band: current!.band, factors: current!.factors, at: current!.createdAt,
    history: historyRows.reverse().map((h) => ({ at: h.createdAt, score: h.score })),
    offer: lendingOn() && !active && band.maxCents > 0 ? { maxCents: band.maxCents, aprBps: band.aprBps, terms: LOAN_TERMS, currency: BASE } : null,
    lendingOpen: lendingOn(),
  };
}

export function monthlyPayment(principalCents: number, aprBps: number, months: number) {
  const r = aprBps / 10_000 / 12;
  return r === 0 ? Math.ceil(principalCents / months) : Math.ceil((principalCents * r) / (1 - (1 + r) ** -months));
}

export async function applyForLoan(ctx: PayCtx, input: { amountCents: number; termMonths: number; purpose?: string; pin: string; code?: string }) {
  if (!lendingOn()) throw new HttpError(403, "Loans aren't open yet. We'll let you know when they are.");
  if (!LOAN_TERMS.includes(input.termMonths)) throw new HttpError(422, "Pick one of the offered terms.");
  const open = await db.payLoan.count({ where: { userId: ctx.user.id, status: { in: ["REVIEW", "APPROVED", "ACTIVE"] } } });
  if (open) throw new HttpError(409, "You already have a loan open. Pay it off or wait for the decision first.");
  const s = await computeScore(ctx.user.id);
  const band = LOAN_BANDS[s.band];
  if (!band.maxCents) throw new HttpError(403, "We can't offer a loan yet. Keep building your score: it updates every day.");
  if (input.amountCents < 50_000 || input.amountCents > band.maxCents) throw new HttpError(422, `You can borrow from ${fmt(50_000)} to ${fmt(band.maxCents)}.`);
  await checkPin(ctx, input.pin);
  await stepUp(ctx, input.code, "apply for a loan");
  const loan = await db.payLoan.create({
    data: { userId: ctx.user.id, principalCents: input.amountCents, aprBps: band.aprBps, termMonths: input.termMonths, paymentCents: monthlyPayment(input.amountCents, band.aprBps, input.termMonths), purpose: input.purpose?.trim() || null, scoreAtApply: s.score },
  });
  await audit(ctx, "pay.loan_applied", "PayLoan", loan.id, { amountCents: loan.principalCents, termMonths: loan.termMonths, score: s.score });
  await notify(ctx.user.id, "LOAN", "We got your loan application", "A person on our credit team reviews every application, usually within one business day.", "/app/credit");
  return loan;
}

/** Super admin decision. Approval pays the money into the wallet and sets up the monthly payments. */
export async function decideLoan(adminId: string, id: string, approve: boolean, note?: string) {
  const loan = await db.payLoan.findUniqueOrThrow({ where: { id } });
  if (loan.status !== "REVIEW") throw new HttpError(409, "This application was already decided.");
  if (!approve) {
    await db.payLoan.update({ where: { id }, data: { status: "DECLINED", decidedBy: adminId, decisionNote: note ?? null, closedAt: new Date() } });
    await notify(loan.userId, "LOAN", "Your loan application wasn't approved", note || "Keep building your oenodpay score and apply again in 90 days.", "/app/credit");
    return;
  }
  const r = loan.aprBps / 10_000 / 12;
  let balance = loan.principalCents;
  const schedule = Array.from({ length: loan.termMonths }, (_, i) => {
    const interest = Math.round(balance * r);
    const principal = i === loan.termMonths - 1 ? balance : Math.min(balance, loan.paymentCents - interest);
    balance -= principal;
    const due = new Date(); due.setUTCMonth(due.getUTCMonth() + i + 1);
    return { dueAt: due, amountCents: principal + interest, principalCents: principal, interestCents: interest };
  });
  await db.$transaction(async (tx) => {
    const w = await walletFor(loan.userId, BASE, tx);
    await post(loan.userId, "LOAN_DISBURSED", `loan:${loan.id}`, [{ account: "lending:capital", amountCents: -loan.principalCents }, { walletId: w.id, account: `wallet:${loan.userId}`, amountCents: loan.principalCents }], "Loan from oenodpay", tx);
    await tx.payLoan.update({ where: { id }, data: { status: "ACTIVE", decidedBy: adminId, decisionNote: note ?? null, disbursedAt: new Date(), balanceCents: loan.principalCents, nextDueAt: schedule[0].dueAt } });
    await tx.payLoanPayment.createMany({ data: schedule.map((s) => ({ loanId: loan.id, ...s })) });
  }, { isolationLevel: "Serializable" });
  await notify(loan.userId, "LOAN", `Your loan of ${fmt(loan.principalCents)} is in your wallet`, `${loan.termMonths} payments of ${fmt(loan.paymentCents)}, taken automatically each month.`, "/app/credit");
}

/** Monthly repayments. Keep enough in the wallet on the due date; three missed payments put the loan in default. */
export async function collectLoanPayments() {
  const due = await db.payLoanPayment.findMany({ where: { status: "DUE", dueAt: { lte: new Date() }, loan: { status: "ACTIVE" } }, include: { loan: true }, take: 200 });
  for (const p of due) {
    const { availableCents } = await available(p.loan.userId);
    if (availableCents < p.amountCents) {
      const missed = p.loan.missed + 1;
      await db.payLoanPayment.update({ where: { id: p.id }, data: { status: "MISSED" } });
      await db.payLoan.update({ where: { id: p.loanId }, data: { missed, ...(missed >= 3 ? { status: "DEFAULTED" } : {}) } });
      await notify(p.loan.userId, "LOAN", "Your loan payment was missed", `We couldn't take ${fmt(p.amountCents)}. Add money and pay it from Credit to avoid it affecting your score.`, "/app/credit");
      if (missed >= 3) await riskEvent(p.loan.userId, "LOAN_DEFAULT", "HIGH", "PayLoan", p.loanId, { missed });
      continue;
    }
    await repay(p.id);
  }
  return due.length;
}

async function repay(paymentId: string) {
  const p = await db.payLoanPayment.findUniqueOrThrow({ where: { id: paymentId }, include: { loan: true } });
  if (p.status === "PAID") return;
  await db.$transaction(async (tx) => {
    const claimed = await tx.payLoanPayment.updateMany({ where: { id: p.id, status: { in: ["DUE", "MISSED"] } }, data: { status: "PAID", paidAt: new Date(), journalRef: `loan-pay:${p.id}` } });
    if (!claimed.count) return;
    const w = await walletFor(p.loan.userId, BASE, tx);
    await post(p.loan.userId, "LOAN_PAYMENT", `loan-pay:${p.id}`, [
      { walletId: w.id, account: `wallet:${p.loan.userId}`, amountCents: -p.amountCents },
      { account: "lending:capital", amountCents: p.principalCents },
      { account: "revenue:interest", amountCents: p.interestCents },
    ], "Loan payment", tx);
    const left = await tx.payLoanPayment.findFirst({ where: { loanId: p.loanId, status: { in: ["DUE", "MISSED"] } }, orderBy: { dueAt: "asc" } });
    await tx.payLoan.update({ where: { id: p.loanId }, data: { balanceCents: { decrement: p.principalCents }, nextDueAt: left?.dueAt ?? null, ...(left ? {} : { status: "PAID_OFF", closedAt: new Date() }) } });
  }, { isolationLevel: "Serializable" });
  const loan = await db.payLoan.findUniqueOrThrow({ where: { id: p.loanId } });
  await notify(loan.userId, "LOAN", loan.status === "PAID_OFF" ? "Your loan is paid off" : "Loan payment made", loan.status === "PAID_OFF" ? "Well done. That helps your score." : `${fmt(p.amountCents)} paid. ${fmt(loan.balanceCents)} left.`, "/app/credit");
}

/** The customer pays a missed payment (or the next one early) themselves. */
export async function payNow(ctx: PayCtx, loanId: string, pin: string) {
  const loan = await db.payLoan.findFirst({ where: { id: loanId, userId: ctx.user.id, status: { in: ["ACTIVE", "DEFAULTED"] } } });
  if (!loan) throw new HttpError(404, "Loan not found.");
  await checkPin(ctx, pin);
  const next = await db.payLoanPayment.findFirst({ where: { loanId, status: { in: ["MISSED", "DUE"] } }, orderBy: { dueAt: "asc" } });
  if (!next) throw new HttpError(409, "Nothing is due.");
  const { availableCents } = await available(ctx.user.id);
  if (availableCents < next.amountCents) throw new HttpError(402, "Not enough money in your wallet. Add money first.");
  await repay(next.id);
  await audit(ctx, "pay.loan_paid_now", "PayLoan", loanId, { paymentId: next.id });
}
