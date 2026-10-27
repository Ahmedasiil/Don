import { db } from "./db";
import { decrypt, encrypt } from "./crypto";

/** Platform plugins the super admin can switch on without touching the server. */
export interface PluginField { key: string; label: string; secret?: boolean; placeholder?: string; help?: string }
export interface PlatformPlugin { key: string; name: string; group: string; color: string; description: string; fields: PluginField[]; docs?: string; test?: boolean }

export const PLATFORM_PLUGINS: PlatformPlugin[] = [
  { key: "stripe", name: "Stripe", group: "Payments", color: "#635BFF", test: true, description: "Card top-ups to the wallet, identity verification (Stripe Identity) and card issuing (Stripe Issuing).", docs: "https://dashboard.stripe.com/apikeys", fields: [{ key: "STRIPE_SECRET_KEY", label: "Secret key", secret: true, placeholder: "sk_live_..." }, { key: "STRIPE_WEBHOOK_SECRET", label: "Webhook signing secret", secret: true, placeholder: "whsec_...", help: "Webhook URL: {APP_URL}/api/webhooks/stripe" }, { key: "STRIPE_PUBLISHABLE_KEY", label: "Publishable key", placeholder: "pk_live_..." }] },
  { key: "airwallex", name: "Airwallex (bank payouts & FX)", group: "Money movement", color: "#612FFF", test: true, description: "Sends money to bank accounts in 150+ countries and gives live exchange rates.", docs: "https://www.airwallex.com/app/account/apiKeys", fields: [{ key: "AIRWALLEX_CLIENT_ID", label: "Client ID" }, { key: "AIRWALLEX_API_KEY", label: "API key", secret: true }, { key: "AIRWALLEX_ENV", label: "Environment", placeholder: "live or demo" }, { key: "AIRWALLEX_WEBHOOK_SECRET", label: "Webhook secret", secret: true, help: "Webhook URL: {APP_URL}/api/webhooks/airwallex" }] },
  { key: "thunes", name: "Thunes (wallets, InstaPay, cash pickup)", group: "Money movement", color: "#FF5A1F", test: true, description: "Pays into mobile wallets (Vodafone Cash, GCash, STC Pay...), InstaPay, cards and cash pickup worldwide.", docs: "https://docs.thunes.com", fields: [{ key: "THUNES_API_KEY", label: "API key" }, { key: "THUNES_API_SECRET", label: "API secret", secret: true }, { key: "THUNES_ENV", label: "Environment", placeholder: "live or pre" }, { key: "THUNES_CALLBACK_SECRET", label: "Callback secret", secret: true, help: "Any long random text. Keeps status callbacks private." }] },
  { key: "opensanctions", name: "OpenSanctions (AML screening)", group: "Money movement", color: "#1F3A5F", test: true, description: "Screens customers and recipients against sanctions and PEP lists (UN, OFAC, Canada, EU, UK).", docs: "https://www.opensanctions.org/api/", fields: [{ key: "OPENSANCTIONS_API_KEY", label: "API key", secret: true }] },
  { key: "twelvedata", name: "Twelve Data (live markets)", group: "Money movement", color: "#1D4ED8", test: true, description: "Live stocks, ETFs, gold and currency prices. Crypto prices work without a key.", docs: "https://twelvedata.com/account/api-keys", fields: [{ key: "TWELVEDATA_API_KEY", label: "API key", secret: true }, { key: "COINGECKO_API_KEY", label: "CoinGecko demo key (optional)", secret: true }] },
  { key: "airalo", name: "Airalo (travel eSIM)", group: "Money movement", color: "#00A8A8", test: true, description: "Sell travel data eSIMs for 200+ countries.", docs: "https://partners.airalo.com", fields: [{ key: "AIRALO_CLIENT_ID", label: "Client ID" }, { key: "AIRALO_CLIENT_SECRET", label: "Client secret", secret: true }, { key: "AIRALO_ENV", label: "Environment", placeholder: "live or sandbox" }] },
  { key: "alpaca", name: "Alpaca (stock and crypto trading)", group: "Money movement", color: "#FCD72B", test: true, description: "Fills customers' buy and sell orders from oenodpay's broker account. Start with paper keys; switch the URL to live when approved.", docs: "https://app.alpaca.markets/brokerage/dashboard/overview", fields: [{ key: "ALPACA_KEY_ID", label: "API key ID" }, { key: "ALPACA_SECRET_KEY", label: "Secret key", secret: true }, { key: "ALPACA_BASE_URL", label: "API URL", placeholder: "https://paper-api.alpaca.markets", help: "Live trading: https://api.alpaca.markets" }] },
  { key: "duffel", name: "Duffel (flights and hotels)", group: "Money movement", color: "#2A2A2A", test: true, description: "Live flight and hotel search and booking for the travel tab and the AI travel agent. Bookings are paid from your Duffel balance.", docs: "https://app.duffel.com/tokens", fields: [{ key: "DUFFEL_ACCESS_TOKEN", label: "Access token", secret: true, placeholder: "duffel_live_...", help: "Use a duffel_test_ token first to try bookings safely." }] },
  { key: "callcenter", name: "AI call center (Twilio Voice)", group: "Money movement", color: "#F22F46", description: "Customers call your number and the AI agent answers, then hands off to a person. Uses the Twilio keys above.", fields: [{ key: "SUPPORT_PHONE", label: "Support phone number", placeholder: "+18005551234", help: "In Twilio, set this number's voice webhook to {APP_URL}/api/voice/inbound (POST)." }, { key: "SUPPORT_AGENT_PHONE", label: "Forward to agents at", placeholder: "+14165551234" }, { key: "SUPPORT_AI_MODEL", label: "AI model for support (optional)", placeholder: "Model name from your Anthropic console" }] },
  { key: "pricing", name: "Fees, rewards and limits", group: "Pricing", color: "#2E5BFF", description: "What oenodpay charges and gives back. Leave a box empty to use the default shown.", fields: [
    { key: "PAY_FEE_FIXED_CENTS", label: "Transfer fee, fixed (cents)", placeholder: "299" }, { key: "PAY_FEE_PCT", label: "Transfer fee, percent", placeholder: "0.5" }, { key: "PAY_FX_MARKUP_BPS", label: "Exchange rate margin (basis points)", placeholder: "50" },
    { key: "PAY_TRADE_FEE_BPS", label: "Trading fee (basis points)", placeholder: "50" }, { key: "PAY_TRADE_FEE_MIN_CENTS", label: "Trading fee minimum (cents)", placeholder: "0" },
    { key: "PAY_BILL_FEE_CENTS", label: "Bill payment fee (cents)", placeholder: "0" }, { key: "PAY_TRAVEL_FEE_BPS", label: "Travel booking fee (basis points)", placeholder: "300" },
    { key: "PAY_CASHBACK_BPS", label: "Card cashback (basis points)", placeholder: "100", help: "100 = 1% back on every card purchase." }, { key: "PAY_REFERRAL_BONUS_CENTS", label: "Referral bonus each (cents)", placeholder: "2500" },
    { key: "PAY_LENDING_ENABLED", label: "Accept loan applications", placeholder: "true or false" },
  ] },
  { key: "resend", name: "Resend email", group: "Email & SMS", color: "#000000", test: true, description: "All emails: sign-up, security alerts, receipts and statements.", docs: "https://resend.com/api-keys", fields: [{ key: "RESEND_API_KEY", label: "API key", secret: true, placeholder: "re_..." }, { key: "EMAIL_FROM", label: "Send from", placeholder: "oenodpay <hello@oenodpay.com>" }] },
  { key: "twilio", name: "Twilio SMS & WhatsApp", group: "Email & SMS", color: "#F22F46", test: true, description: "Text alerts and the support phone line.", fields: [{ key: "TWILIO_ACCOUNT_SID", label: "Account SID" }, { key: "TWILIO_AUTH_TOKEN", label: "Auth token", secret: true }, { key: "TWILIO_FROM", label: "From number", placeholder: "+15551234567" }] },
  { key: "expo", name: "Push notifications (Expo)", group: "Email & SMS", color: "#000020", description: "Push notifications to the iPhone and Android apps.", fields: [{ key: "EXPO_ACCESS_TOKEN", label: "Access token", secret: true }] },
  { key: "anthropic", name: "Claude AI", group: "AI", color: "#D97757", test: true, description: "Powers Oeno the money coach, the support agent and the travel planner.", docs: "https://console.anthropic.com/settings/keys", fields: [{ key: "ANTHROPIC_API_KEY", label: "API key", secret: true, placeholder: "sk-ant-..." }, { key: "AI_MODEL", label: "Model", placeholder: "Model name from your Anthropic console" }] },
  { key: "analytics", name: "Website analytics", group: "Maps & analytics", color: "#E37400", description: "Google Analytics and/or PostHog on the public website.", fields: [{ key: "GA_MEASUREMENT_ID", label: "Google Analytics ID", placeholder: "G-XXXX" }, { key: "POSTHOG_KEY", label: "PostHog key" }] },
  { key: "turnstile", name: "Bot protection (Cloudflare Turnstile)", group: "Security", color: "#F38020", description: "Stops bots on sign-up and sign-in.", fields: [{ key: "TURNSTILE_SITE_KEY", label: "Site key" }, { key: "TURNSTILE_SECRET_KEY", label: "Secret key", secret: true }] },
];

export const PLUGIN_KEYS = new Set(PLATFORM_PLUGINS.flatMap((p) => p.fields.map((f) => f.key)));

// Values from the hosting environment, kept so removing a setting restores them.
const original: Record<string, string | undefined> = {};
let loadedAt = 0;
let loading: Promise<void> | null = null;

/** Copy saved plugin settings into process.env so every library picks them up. */
export async function loadPlatformSettings(force = false) {
  if (!force && Date.now() - loadedAt < 30_000) return;
  if (loading) return loading;
  loading = (async () => {
    try {
      const rows = await db.platformSetting.findMany();
      const seen = new Set<string>();
      for (const r of rows) {
        if (!PLUGIN_KEYS.has(r.key)) continue;
        if (!(r.key in original)) original[r.key] = process.env[r.key];
        const v = decrypt(r.value);
        if (v) { process.env[r.key] = v; seen.add(r.key); }
      }
      for (const k of Object.keys(original)) if (!seen.has(k)) {
        if (original[k] === undefined) delete process.env[k];
        else process.env[k] = original[k];
      }
      loadedAt = Date.now();
    } catch {
      // Database not ready yet (first deploy): keep environment values.
    } finally {
      loading = null;
    }
  })();
  return loading;
}

export async function saveSetting(key: string, value: string | null, plugin: string, by: string) {
  if (!PLUGIN_KEYS.has(key)) throw new Error(`Unknown setting ${key}`);
  if (value === null || value === "") await db.platformSetting.deleteMany({ where: { key } });
  else await db.platformSetting.upsert({ where: { key }, create: { key, value: encrypt(value), plugin, updatedBy: by }, update: { value: encrypt(value), plugin, updatedBy: by } });
  await loadPlatformSettings(true);
}

/** Status for the admin screen (never returns secret values). */
export async function pluginStatus() {
  await loadPlatformSettings(true);
  const rows = await db.platformSetting.findMany();
  return PLATFORM_PLUGINS.map((p) => ({
    ...p,
    fields: p.fields.map((f) => {
      const saved = rows.find((r) => r.key === f.key);
      const v = process.env[f.key];
      return { ...f, set: Boolean(v), source: saved ? "admin" : v ? "hosting" : null, preview: v ? (f.secret ? `••••${v.slice(-4)}` : v) : null };
    }),
    enabled: p.fields.filter((f) => f.secret || /CLIENT_ID|KEY|SID|TOKEN/.test(f.key)).every((f) => Boolean(process.env[f.key])),
  }));
}

/** "Test connection" for plugins that support it. */
export async function testPlugin(key: string): Promise<{ ok: boolean; message: string }> {
  await loadPlatformSettings(true);
  try {
    if (key === "stripe") {
      const r = await fetch("https://api.stripe.com/v1/balance", { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` } });
      return r.ok ? { ok: true, message: "Stripe key works." } : { ok: false, message: `Stripe said ${r.status}. Check the key.` };
    }
    if (key === "resend") {
      const r = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } });
      const j = (await r.json().catch(() => ({}))) as { data?: { name: string; status: string }[] };
      return r.ok ? { ok: true, message: `Resend works. Domains: ${(j.data ?? []).map((d) => `${d.name} (${d.status})`).join(", ") || "none yet, add your domain in Resend"}` } : { ok: false, message: `Resend said ${r.status}.` };
    }
    if (key === "twilio") {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, { headers: { Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}` } });
      return r.ok ? { ok: true, message: "Twilio account found." } : { ok: false, message: `Twilio said ${r.status}.` };
    }
    if (key === "anthropic") {
      const r = await fetch("https://api.anthropic.com/v1/models?limit=1", { headers: { "x-api-key": process.env.ANTHROPIC_API_KEY ?? "", "anthropic-version": "2023-06-01" } });
      return r.ok ? { ok: true, message: "Claude API key works." } : { ok: false, message: `Anthropic said ${r.status}.` };
    }
    const pay: Record<string, () => Promise<string>> = {
      airwallex: () => import("./pay/providers/airwallex").then((m) => m.test()),
      thunes: () => import("./pay/providers/thunes").then((m) => m.test()),
      alpaca: () => import("./pay/providers/alpaca").then((m) => m.test()),
      duffel: () => import("./pay/providers/duffel").then((m) => m.test()),
      opensanctions: () => import("./pay/providers/sanctions").then((m) => m.test()),
      airalo: () => import("./pay/providers/airalo").then((m) => m.test()),
      twelvedata: () => import("./pay/providers/market").then(async (m) => { const q = await m.quotes(); const live = q.filter((x) => x.price != null).length; return `${live} of ${q.length} live prices are coming through.`; }),
    };
    if (pay[key]) return { ok: true, message: await pay[key]() };
    return { ok: true, message: "Saved. This plugin has no live test." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Test failed" };
  }
}
