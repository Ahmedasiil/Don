import { z } from "zod";
import { body, HttpError, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { checkPin, requirePay } from "@/lib/pay/guard";
import { packages, order } from "@/lib/pay/providers/airalo";
import { post, walletFor } from "@/lib/pay/ledger";
import { BASE } from "@/lib/pay/config";
import { audit } from "@/lib/audit";
import { usdRate } from "@/lib/pay/fx";

// Travel eSIMs: browse plans by country, pay from the wallet, get a QR code to install.
export const GET = route(async (req: Request) => {
  await requirePay(req, { action: "esim" });
  const country = (new URL(req.url).searchParams.get("country") ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) throw new HttpError(422, "Pick a country.");
  const fx = await usdRate();
  return ok({ currency: BASE, packages: (await packages(country)).map((p) => ({ ...p, priceCents: Math.ceil(p.priceCents * fx), currency: BASE })) });
});

export const POST = route(async (req: Request) => {
  const ctx = await requirePay(req, { money: true, action: "esim" });
  const d = await body(req, z.object({ country: z.string().length(2), packageId: z.string().max(80), pin: z.string().regex(/^\d{6}$/) }));
  await checkPin(ctx, d.pin);
  // Price comes from Airalo now, never from the app.
  const p = (await packages(d.country)).find((x) => x.id === d.packageId);
  if (!p) throw new HttpError(404, "That plan isn't available anymore.");
  const price = Math.ceil(p.priceCents * (await usdRate()));
  const o = await db.payEsimOrder.create({ data: { userId: ctx.user.id, packageId: p.id, country: p.country, title: `${p.operator} ${p.title}`, dataLabel: p.data, days: p.days, priceCents: price, currency: BASE } });
  const w = await walletFor(ctx.user.id);
  await post(ctx.user.id, "ESIM", `esim:${o.id}`, [{ walletId: w.id, account: `wallet:${ctx.user.id}`, amountCents: -price }, { account: "revenue:esim", amountCents: price }], `eSIM ${p.country} ${p.data}`);
  try {
    const r = await order(p.id, `oenodpay ${o.id}`);
    const u = await db.payEsimOrder.update({ where: { id: o.id }, data: { status: "READY", providerOrderId: r.orderId, iccid: r.iccid, qrcodeUrl: r.qrcodeUrl, lpa: r.lpa, journalRef: `esim:${o.id}` } });
    await audit(ctx, "pay.esim_bought", "PayEsimOrder", o.id, { country: p.country, priceCents: price });
    return ok(u, 201);
  } catch (e) {
    await post(ctx.user.id, "ESIM_REFUND", `esim-refund:${o.id}`, [{ account: "revenue:esim", amountCents: -price }, { walletId: w.id, account: `wallet:${ctx.user.id}`, amountCents: price }], "eSIM refund");
    await db.payEsimOrder.update({ where: { id: o.id }, data: { status: "REFUNDED" } });
    throw e;
  }
});
