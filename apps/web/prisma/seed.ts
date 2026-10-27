// Sets up a fresh oenodpay database: the super admin, the starter billers and, with SEED_DEMO=true, a demo customer.
//   SUPER_ADMIN_EMAIL=you@company.com SUPER_ADMIN_PASSWORD='a long passphrase' pnpm db:seed
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { db } from "../src/lib/db";
import { post, walletFor } from "../src/lib/pay/ledger";
import { STARTER_BILLERS } from "../src/lib/pay/bills";

async function admin() {
  const email = (process.env.SUPER_ADMIN_EMAIL ?? "admin@oenodpay.local").toLowerCase();
  const given = process.env.SUPER_ADMIN_PASSWORD;
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    if (!existing.isSuperAdmin) await db.user.update({ where: { id: existing.id }, data: { isSuperAdmin: true } });
    console.log(`Super admin: ${email} (already exists)`);
    return;
  }
  const password = given ?? randomBytes(12).toString("base64url");
  await db.user.create({ data: { email, name: process.env.SUPER_ADMIN_NAME ?? "oenodpay admin", passwordHash: await bcrypt.hash(password, 11), isSuperAdmin: true, emailVerifiedAt: new Date() } });
  console.log(`Super admin: ${email}${given ? "" : `  password: ${password}  (shown once; change it after signing in)`}`);
}

async function billers() {
  let added = 0;
  for (const b of STARTER_BILLERS) {
    if (await db.payBiller.findFirst({ where: { name: b.name, country: b.country } })) continue;
    await db.payBiller.create({ data: { ...b } });
    added++;
  }
  console.log(`Billers: ${added} added, ${STARTER_BILLERS.length - added} already there`);
}

/** A verified customer with money and history, so every screen has something in it. Never run this on production. */
async function demo() {
  const email = "demo@oenodpay.local";
  if (await db.user.findUnique({ where: { email } })) return console.log(`Demo customer: ${email} (already exists)`);
  const password = process.env.DEMO_PASSWORD ?? "Demo-Pass-2026!";
  const u = await db.user.create({ data: { email, name: "Sara Haddad", phone: "+14165550142", passwordHash: await bcrypt.hash(password, 11), emailVerifiedAt: new Date(), createdAt: new Date(Date.now() - 200 * 86400_000) } });
  await db.payProfile.create({ data: { userId: u.id, tier: 2, kycStatus: "VERIFIED", legalName: u.name, country: "CA", dob: new Date("1991-04-12"), screenedAt: new Date(), pinHash: await bcrypt.hash("246810", 12) } });
  const w = await walletFor(u.id);
  const day = (d: number) => new Date(Date.now() - d * 86400_000);
  const moves: [number, string, string, string, number][] = [
    [60, "TOPUP", "clearing:stripe", "Added money by card", 500_000], [45, "TOPUP", "clearing:stripe", "Payroll deposit", 420_000], [15, "TOPUP", "clearing:stripe", "Payroll deposit", 420_000],
    [40, "TRANSFER", "clearing:transfers", "Mom, Cairo (InstaPay)", -40_000], [12, "TRANSFER", "clearing:transfers", "Mom, Cairo (InstaPay)", -40_000],
    [30, "BILL", "clearing:bills", "Hydro One", -8_620], [28, "BILL", "clearing:bills", "Rogers", -9_500], [3, "BILL", "clearing:bills", "Hydro One", -9_140],
    [20, "CARD", "clearing:cards", "Loblaws", -14_235], [9, "CARD", "clearing:cards", "Uber", -2_380], [6, "CARD", "clearing:cards", "Tim Hortons", -845], [2, "CARD", "clearing:cards", "Apple", -1_399],
    [18, "INVEST_BUY", "custody:invest", "Bought VOO", -25_000], [8, "INVEST_BUY", "custody:invest", "Bought BTC/USD", -10_000],
    [5, "REWARD", "rewards:pool", "Rewards to wallet", 412],
  ];
  for (const [i, [d, kind, account, memo, cents]] of moves.entries()) {
    const { journal: j } = await post(u.id, kind, `seed:${u.id}:${i}`, [{ walletId: w.id, account: `wallet:${u.id}`, amountCents: cents }, { account, amountCents: -cents }], memo);
    await db.payJournal.update({ where: { id: j.id }, data: { createdAt: day(d) } });
  }
  await db.payHolding.createMany({ data: [{ userId: u.id, symbol: "VOO", kind: "STOCK", quantity: 0.4012, costCents: 25_000 }, { userId: u.id, symbol: "BTC/USD", kind: "CRYPTO", quantity: 0.00108, costCents: 10_000 }] });
  await db.payTrade.createMany({ data: [{ userId: u.id, symbol: "VOO", kind: "STOCK", side: "BUY", amountCents: 25_000, feeCents: 125, quantity: 0.4012, status: "FILLED", idempotencyKey: `seed-${u.id}-t1`, createdAt: day(18), filledAt: day(18) }, { userId: u.id, symbol: "BTC/USD", kind: "CRYPTO", side: "BUY", amountCents: 10_000, feeCents: 50, quantity: 0.00108, status: "FILLED", idempotencyKey: `seed-${u.id}-t2`, createdAt: day(8), filledAt: day(8) }] });
  const hydro = await db.payBiller.findFirst({ where: { name: "Hydro One" } });
  if (hydro) {
    const { encrypt } = await import("../src/lib/crypto");
    const p = await db.payBillPayee.create({ data: { userId: u.id, billerId: hydro.id, nickname: "Home hydro", accountEnc: encrypt("200418834421"), label: "Hydro One ···· 4421" } });
    await db.payBillPayment.create({ data: { userId: u.id, payeeId: p.id, amountCents: 9_140, currency: w.currency, status: "SCHEDULED", scheduledFor: new Date(Date.now() + 27 * 86400_000), repeat: "MONTHLY", idempotencyKey: `seed-${u.id}-b1` } });
  }
  await db.payReward.createMany({ data: [{ userId: u.id, kind: "CASHBACK", cents: 142, status: "AVAILABLE", memo: "1% back at Loblaws", reference: `seed-${u.id}-r1`, availableAt: day(13) }, { userId: u.id, kind: "CASHBACK", cents: 24, status: "PENDING", memo: "1% back at Uber", reference: `seed-${u.id}-r2`, availableAt: day(-2) }] });
  await db.payNotice.createMany({ data: [
    { userId: u.id, kind: "MONEY_IN", title: "Payroll deposit arrived", body: "$4,200.00 is in your wallet.", link: "/app/activity", createdAt: day(15) },
    { userId: u.id, kind: "MONEY_OUT", title: "Mom received your money", body: "$400.00 delivered by InstaPay.", link: "/app/send", createdAt: day(12) },
    { userId: u.id, kind: "INVEST", title: "Your order filled", body: "You bought 0.00108 BTC.", link: "/app/invest", createdAt: day(8) },
    { userId: u.id, kind: "BILL", title: "Hydro One paid", body: "Confirmation 88412093.", link: "/app/bills", createdAt: day(3) },
    { userId: u.id, kind: "SECURITY", title: "New sign-in on Chrome, macOS", body: "If this wasn't you, freeze your account now.", link: "/app/security", createdAt: day(1) },
  ] });
  console.log(`Demo customer: ${email}  password: ${password}  PIN: 246810  (turn on two-step sign-in to move money)`);
}

(async () => {
  await admin();
  await billers();
  if (process.env.SEED_DEMO === "true") await demo();
  await db.$disconnect();
})().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
