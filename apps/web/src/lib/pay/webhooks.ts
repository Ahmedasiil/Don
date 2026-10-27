import type Stripe from "stripe";
import { db } from "../db";
import { post, walletFor } from "./ledger";
import { identityResult } from "./providers/stripe";
import { riskEvent, screenProfile } from "./risk";
import { notify } from "./notices";
import { rewardReferral } from "./rewards";
import { fmt } from "./config";
import { alert } from "./guard";
import { authorizationUpdated, cardFraud, cardTransaction, decideAuthorization } from "./cards";

/** oenodpay's share of the Stripe webhook. Returns a Response only for the real-time card decision. */
export async function handleStripePay(event: Stripe.Event): Promise<Response | null> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.metadata?.kind !== "pay_topup" || s.payment_status !== "paid") return null;
      const t = await db.payTopUp.findUnique({ where: { stripeSessionId: s.id } });
      if (!t || t.status === "PAID" || t.userId !== s.metadata.userId) return null;
      // Trust only what Stripe charged, never the amount we asked for.
      if (s.amount_total !== t.amountCents || s.currency?.toUpperCase() !== t.currency) {
        await riskEvent(t.userId, "TOPUP_MISMATCH", "HIGH", "PayTopUp", t.id, { charged: s.amount_total, expected: t.amountCents });
        return null;
      }
      const w = await walletFor(t.userId, t.currency);
      await post(t.userId, "TOPUP", `topup:${t.id}`, [{ account: "clearing:stripe", amountCents: -t.amountCents, currency: t.currency }, { walletId: w.id, account: `wallet:${t.userId}`, amountCents: t.amountCents, currency: t.currency }], "Card top-up");
      await db.payTopUp.update({ where: { id: t.id }, data: { status: "PAID" } });
      await notify(t.userId, "MONEY_IN", `${fmt(t.amountCents, t.currency)} added to your wallet`, "Card top-up", "/app/activity");
      await rewardReferral(t.userId).catch(() => {});
      return null;
    }
    case "charge.dispute.created": {
      // A top-up disputed with the card's bank: freeze until reviewed (classic stolen-card cash-out).
      const d = event.data.object as Stripe.Dispute;
      const pi = typeof d.payment_intent === "string" ? d.payment_intent : d.payment_intent?.id;
      const userId = (d.metadata?.userId as string | undefined) ?? (pi ? (await import("../stripe")).stripe().paymentIntents.retrieve(pi).then((p: { metadata?: Record<string, string> }) => p.metadata?.userId) : undefined);
      const uid = await userId;
      if (uid) {
        await db.payProfile.updateMany({ where: { userId: uid }, data: { frozenAt: new Date(), frozenReason: "Card top-up disputed" } });
        await riskEvent(uid, "TOPUP_DISPUTE", "HIGH", "Dispute", d.id, { amount: d.amount, reason: d.reason });
      }
      return null;
    }
    case "identity.verification_session.verified":
    case "identity.verification_session.requires_input":
    case "identity.verification_session.canceled": {
      const v = event.data.object as Stripe.Identity.VerificationSession;
      if (v.metadata?.kind !== "pay_kyc") return null;
      const p = await db.payProfile.findUnique({ where: { kycSessionId: v.id } });
      if (!p) return null;
      if (event.type === "identity.verification_session.verified") {
        const r = await identityResult(v.id);
        const adult = r.dob ? Date.now() - r.dob.getTime() >= 18 * 365.25 * 86400_000 : false;
        await db.payProfile.update({ where: { id: p.id }, data: { kycStatus: adult ? "VERIFIED" : "REVIEW", tier: adult ? Math.max(p.tier, 1) : p.tier, kycProvider: "stripe_identity", legalName: r.name, dob: r.dob, country: r.address?.country ?? p.country, nationality: r.document?.country ?? p.nationality, kycReport: JSON.parse(JSON.stringify({ document: r.document, selfie: r.selfie, at: new Date() })) } });
        if (!adult) await riskEvent(p.userId, "KYC_UNDERAGE", "MEDIUM", "PayProfile", p.id, { dob: r.dob });
        await screenProfile(p.userId).catch((e) => console.error("screening failed", e));
        const u = await db.user.findUnique({ where: { id: p.userId } });
        if (u && adult) await alert(u, "You're verified", "Your identity is confirmed. You can now send money, get a card and set up your family.");
      } else {
        const r = await identityResult(v.id).catch(() => null);
        await db.payProfile.update({ where: { id: p.id }, data: { kycStatus: event.type.endsWith("canceled") ? "NONE" : "REJECTED", kycReport: JSON.parse(JSON.stringify({ error: r?.lastError ?? v.last_error?.code ?? null, at: new Date() })) } });
        if (r?.lastError && /mismatch|fraud|consent/i.test(r.lastError)) await riskEvent(p.userId, "KYC_FAILED", "MEDIUM", "PayProfile", p.id, { error: r.lastError });
      }
      return null;
    }
    case "issuing_authorization.request": {
      const a = event.data.object as Stripe.Issuing.Authorization;
      const d = await decideAuthorization(a).catch((e) => { console.error("card decision failed", e); return { approved: false, reason: "error" }; });
      // Synchronous answer: Stripe reads approve/decline from this response body.
      return new Response(JSON.stringify({ approved: d.approved, metadata: { reason: d.reason ?? "" } }), { status: 200, headers: { "Content-Type": "application/json", "Stripe-Version": process.env.STRIPE_ISSUING_API_VERSION || "2025-03-31.basil" } });
    }
    case "issuing_authorization.updated":
      await authorizationUpdated(event.data.object as Stripe.Issuing.Authorization);
      return null;
    case "issuing_transaction.created":
      await cardTransaction(event.data.object as Stripe.Issuing.Transaction);
      return null;
    case "issuing_card.updated": {
      const c = event.data.object as Stripe.Issuing.Card;
      if (c.cancellation_reason !== "stolen" && c.cancellation_reason !== "lost") return null;
      await cardFraud(c.id, { reason: c.cancellation_reason });
      return null;
    }
  }
  return null;
}

