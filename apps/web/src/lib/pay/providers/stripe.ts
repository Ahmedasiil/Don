import type Stripe from "stripe";
import { stripe } from "../../stripe";
import { APP_URL } from "../../env";
import { BASE } from "../config";

// Stripe does three jobs for oenodpay: card top-ups (Checkout), identity checks (Identity: ID document + selfie)
// and cards (Issuing, with real-time spending rules). https://docs.stripe.com

/** A hosted card checkout that tops up the wallet. The wallet is only credited by the signed webhook. */
export async function topUpCheckout(o: { userId: string; email: string; amountCents: number; topUpId: string; returnPath: string }) {
  const s = await stripe().checkout.sessions.create({
    mode: "payment",
    customer_email: o.email,
    line_items: [{ quantity: 1, price_data: { currency: BASE.toLowerCase(), unit_amount: o.amountCents, product_data: { name: "oenodpay wallet top-up" } } }],
    payment_intent_data: { metadata: { kind: "pay_topup", userId: o.userId, topUpId: o.topUpId } },
    metadata: { kind: "pay_topup", userId: o.userId, topUpId: o.topUpId },
    success_url: `${APP_URL}${o.returnPath}?topup=done`,
    cancel_url: `${APP_URL}${o.returnPath}`,
  }, { idempotencyKey: `topup:${o.topUpId}` });
  return { id: s.id, url: s.url! };
}

/** Start an ID document + live selfie check. The person finishes it on Stripe's secure page. */
export async function identitySession(userId: string, returnPath: string) {
  const v = await stripe().identity.verificationSessions.create({
    type: "document",
    options: { document: { require_matching_selfie: true, require_live_capture: true, require_id_number: false, allowed_types: ["driving_license", "passport", "id_card"] } },
    metadata: { kind: "pay_kyc", userId },
    return_url: `${APP_URL}${returnPath}?kyc=done`,
  });
  return { id: v.id, url: v.url! };
}

/** The verified name, birth date, address and document from a finished check (images stay at Stripe). */
export async function identityResult(id: string) {
  const v = await stripe().identity.verificationSessions.retrieve(id, { expand: ["verified_outputs", "last_verification_report"] });
  const out = v.verified_outputs;
  const rep = v.last_verification_report as Stripe.Identity.VerificationReport | null;
  return {
    status: v.status, // verified, requires_input, processing, canceled
    lastError: v.last_error?.reason ?? v.last_error?.code ?? null,
    name: out ? [out.first_name, out.last_name].filter(Boolean).join(" ") : null,
    dob: out?.dob?.year ? new Date(Date.UTC(out.dob.year, (out.dob.month ?? 1) - 1, out.dob.day ?? 1)) : null,
    country: out?.address?.country ?? null, // where they live (only when an address was collected)
    document: rep?.document ? { type: rep.document.type, country: rep.document.issuing_country, expires: rep.document.expiration_date, status: rep.document.status } : null,
    selfie: rep?.selfie ? { status: rep.selfie.status } : null,
    address: out?.address ?? null,
  };
}

// ── Issuing ──

export async function cardholder(o: { name: string; email: string; phone?: string | null; address: { line1: string; city: string; postal_code: string; country: string; state?: string }; dob?: Date | null; userId: string }) {
  const [first, ...rest] = o.name.split(/\s+/);
  const ch = await stripe().issuing.cardholders.create({
    type: "individual", name: o.name, email: o.email, phone_number: o.phone ?? undefined,
    billing: { address: o.address },
    individual: { first_name: first, last_name: rest.join(" ") || first, ...(o.dob ? { dob: { day: o.dob.getUTCDate(), month: o.dob.getUTCMonth() + 1, year: o.dob.getUTCFullYear() } } : {}) },
    metadata: { userId: o.userId },
  });
  return ch.id;
}

export interface Controls { weeklyLimitCents?: number; perPurchaseCents?: number | null; blockedCategories?: string[] }
const spending = (c: Controls): Stripe.Issuing.CardCreateParams.SpendingControls => ({
  spending_limits: [
    ...(c.weeklyLimitCents ? [{ amount: c.weeklyLimitCents, interval: "weekly" as const }] : []),
    ...(c.perPurchaseCents ? [{ amount: c.perPurchaseCents, interval: "per_authorization" as const }] : []),
  ],
  blocked_categories: (c.blockedCategories ?? []) as Stripe.Issuing.CardCreateParams.SpendingControls.BlockedCategory[],
});

export async function issueCard(o: { cardholder: string; type: "virtual" | "physical"; controls?: Controls; metadata: Record<string, string>; shipping?: Stripe.Issuing.CardCreateParams.Shipping }) {
  const c = await stripe().issuing.cards.create({
    cardholder: o.cardholder, currency: BASE.toLowerCase(), type: o.type, status: "active",
    spending_controls: spending(o.controls ?? {}), metadata: o.metadata, ...(o.shipping ? { shipping: o.shipping } : {}),
  });
  return { id: c.id, last4: c.last4, brand: c.brand, expMonth: c.exp_month, expYear: c.exp_year };
}

export const setCardStatus = (id: string, status: "active" | "inactive" | "canceled") => stripe().issuing.cards.update(id, { status });
export const setCardControls = (id: string, c: Controls) => stripe().issuing.cards.update(id, { spending_controls: spending(c) });
export const approveAuth = (id: string) => stripe().issuing.authorizations.approve(id);
export const declineAuth = (id: string, reason: string) => stripe().issuing.authorizations.decline(id, { metadata: { reason } });

/** Stripe merchant categories offered as one-tap blocks for teens. */
export const TEEN_CATEGORIES: { key: string; label: string; categories: string[] }[] = [
  { key: "gambling", label: "Gambling and betting", categories: ["betting_casino_gambling", "government_licensed_online_casions_online_gambling_us_region_only", "government_owned_lotteries_non_us_region", "government_licensed_horse_dog_racing_us_region_only"] },
  { key: "alcohol", label: "Alcohol", categories: ["package_stores_beer_wine_and_liquor", "drinking_places"] },
  { key: "tobacco", label: "Tobacco and vaping", categories: ["cigar_stores_and_stands"] },
  { key: "adult", label: "Adult content", categories: ["dating_escort_services", "massage_parlors"] },
  { key: "crypto", label: "Crypto and trading", categories: ["non_fi_stored_value_card_purchase_load", "securities_brokers_dealers", "quasi_cash_merchant"] },
  { key: "games", label: "Video game stores", categories: ["digital_goods_games", "video_game_arcades_establishments"] },
  { key: "fastfood", label: "Fast food", categories: ["fast_food_restaurants"] },
  { key: "rides", label: "Taxis and rides", categories: ["taxicabs_limousines"] },
];
export const categoriesFor = (keys: string[]) => TEEN_CATEGORIES.filter((c) => keys.includes(c.key)).flatMap((c) => c.categories);
