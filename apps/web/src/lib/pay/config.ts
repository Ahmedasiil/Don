// oenodpay rules in one place: currencies, fees, limits by verification level, and where money can go.

/** Wallet currency. Top-ups, fees and limits are counted in it. We launch in Canada, so CAD by default. */
export const BASE = (process.env.PAY_BASE_CURRENCY || "CAD").toUpperCase();

/** Countries where people can open an oenodpay wallet (launch: Canada and the US). Recipients can be anywhere in CORRIDORS. */
export const HOME_COUNTRIES = new Set((process.env.PAY_HOME_COUNTRIES ?? "CA,US").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean));

// Canada (FINTRAC, PCMLTFA): international transfers of $10,000 or more (one or several within 24 hours) need an
// Electronic Funds Transfer Report, and $1,000 or more must carry full sender and recipient details (travel rule).
export const REPORT_OVER_CENTS = Number(process.env.PAY_REPORT_OVER_CENTS ?? 1_000_000);
export const TRAVEL_RULE_OVER_CENTS = Number(process.env.PAY_TRAVEL_RULE_OVER_CENTS ?? 100_000);

/** Our margin on the provider's exchange rate, in basis points (50 = 0.5%). */
export const FX_MARKUP_BPS = Number(process.env.PAY_FX_MARKUP_BPS ?? 50);

/** Transfer fee: a fixed part plus a percentage, waived above a threshold. */
export function transferFee(sendCents: number) {
  const fixed = Number(process.env.PAY_FEE_FIXED_CENTS ?? 199);
  const pct = Number(process.env.PAY_FEE_PCT ?? 0.5) / 100;
  const freeOver = Number(process.env.PAY_FEE_FREE_OVER_CENTS ?? 100_000);
  if (sendCents >= freeOver) return 0;
  return Math.max(fixed, Math.round(sendCents * pct));
}

/** Limits by verification tier, in base-currency cents. Tier 0 can look around but not move money. */
export const LIMITS: Record<number, { perTransfer: number; daily: number; monthly: number; wallet: number }> = {
  0: { perTransfer: 0, daily: 0, monthly: 0, wallet: 0 },
  1: { perTransfer: 100_000, daily: 300_000, monthly: 1_000_000, wallet: 1_000_000 },
  2: { perTransfer: 1_000_000, daily: 2_500_000, monthly: 10_000_000, wallet: 5_000_000 },
};

/** Transfers at or above this go to a compliance officer before they leave. */
export const REVIEW_OVER_CENTS = Number(process.env.PAY_REVIEW_OVER_CENTS ?? 300_000);

// FATF "call for action" countries are blocked; "increased monitoring" countries are reviewed by a person.
// Update these from https://www.fatf-gafi.org when the lists change.
export const BLOCKED_COUNTRIES = new Set((process.env.PAY_BLOCKED_COUNTRIES ?? "KP,IR,MM").split(",").map((s) => s.trim()).filter(Boolean));
export const REVIEW_COUNTRIES = new Set((process.env.PAY_REVIEW_COUNTRIES ?? "").split(",").map((s) => s.trim()).filter(Boolean));

export type Method = "BANK" | "INSTAPAY" | "MOBILE_WALLET" | "CASH_PICKUP" | "CARD" | "COMPANY_WALLET" | "OENODPAY";

/** How a recipient can get paid in each country, and which provider carries it. */
export interface PayoutOption { method: Method; label: string; networks?: string[]; provider: "airwallex" | "thunes" | "internal"; eta: string; fields: ("accountNumber" | "iban" | "swift" | "bankName" | "phone" | "ipa" | "cardNumber" | "walletId")[] }
export interface Corridor { country: string; name: string; currency: string; flag: string; options: PayoutOption[] }

const internal: PayoutOption = { method: "OENODPAY", label: "oenodpay account", provider: "internal", eta: "Instant", fields: ["phone"] };

export const CORRIDORS: Corridor[] = [
  { country: "EG", name: "Egypt", currency: "EGP", flag: "🇪🇬", options: [
    { method: "BANK", label: "Bank account", provider: "airwallex", eta: "Same day", fields: ["bankName", "accountNumber", "iban"] },
    { method: "INSTAPAY", label: "InstaPay", provider: "thunes", eta: "Minutes", fields: ["ipa"] },
    { method: "MOBILE_WALLET", label: "Mobile wallet", networks: ["Vodafone Cash", "Orange Cash", "Etisalat Cash", "WE Pay"], provider: "thunes", eta: "Minutes", fields: ["phone"] },
    { method: "CASH_PICKUP", label: "Cash pickup", networks: ["Fawry", "Egypt Post"], provider: "thunes", eta: "Within an hour", fields: ["phone"] },
    { method: "CARD", label: "Meeza or debit card", provider: "thunes", eta: "Minutes", fields: ["cardNumber"] },
    { method: "COMPANY_WALLET", label: "Company or merchant wallet", provider: "thunes", eta: "Minutes", fields: ["walletId", "phone"] },
    internal,
  ] },
  { country: "AE", name: "United Arab Emirates", currency: "AED", flag: "🇦🇪", options: [
    { method: "BANK", label: "Bank account (IBAN)", provider: "airwallex", eta: "Same day", fields: ["iban", "bankName"] },
    { method: "CASH_PICKUP", label: "Cash pickup", networks: ["Exchange houses"], provider: "thunes", eta: "Within an hour", fields: ["phone"] }, internal ] },
  { country: "SA", name: "Saudi Arabia", currency: "SAR", flag: "🇸🇦", options: [
    { method: "BANK", label: "Bank account (IBAN)", provider: "airwallex", eta: "Same day", fields: ["iban", "bankName"] },
    { method: "MOBILE_WALLET", label: "Mobile wallet", networks: ["STC Pay"], provider: "thunes", eta: "Minutes", fields: ["phone"] }, internal ] },
  { country: "JO", name: "Jordan", currency: "JOD", flag: "🇯🇴", options: [
    { method: "BANK", label: "Bank account (IBAN)", provider: "airwallex", eta: "1 to 2 days", fields: ["iban", "bankName"] },
    { method: "MOBILE_WALLET", label: "Mobile wallet", networks: ["Zain Cash", "Orange Money"], provider: "thunes", eta: "Minutes", fields: ["phone"] } ] },
  { country: "MA", name: "Morocco", currency: "MAD", flag: "🇲🇦", options: [
    { method: "BANK", label: "Bank account", provider: "airwallex", eta: "1 to 2 days", fields: ["accountNumber", "bankName"] },
    { method: "CASH_PICKUP", label: "Cash pickup", provider: "thunes", eta: "Within an hour", fields: ["phone"] } ] },
  { country: "PH", name: "Philippines", currency: "PHP", flag: "🇵🇭", options: [
    { method: "BANK", label: "Bank account", provider: "airwallex", eta: "Same day", fields: ["accountNumber", "bankName"] },
    { method: "MOBILE_WALLET", label: "Mobile wallet", networks: ["GCash", "Maya"], provider: "thunes", eta: "Minutes", fields: ["phone"] },
    { method: "CASH_PICKUP", label: "Cash pickup", networks: ["Cebuana Lhuillier", "M Lhuillier"], provider: "thunes", eta: "Within an hour", fields: ["phone"] } ] },
  { country: "IN", name: "India", currency: "INR", flag: "🇮🇳", options: [
    { method: "BANK", label: "Bank account (IMPS)", provider: "airwallex", eta: "Minutes", fields: ["accountNumber", "swift", "bankName"] },
    { method: "MOBILE_WALLET", label: "UPI", networks: ["UPI"], provider: "thunes", eta: "Minutes", fields: ["walletId"] } ] },
  { country: "PK", name: "Pakistan", currency: "PKR", flag: "🇵🇰", options: [
    { method: "BANK", label: "Bank account", provider: "airwallex", eta: "Same day", fields: ["iban", "bankName"] },
    { method: "MOBILE_WALLET", label: "Mobile wallet", networks: ["JazzCash", "Easypaisa"], provider: "thunes", eta: "Minutes", fields: ["phone"] } ] },
  { country: "NG", name: "Nigeria", currency: "NGN", flag: "🇳🇬", options: [
    { method: "BANK", label: "Bank account", provider: "airwallex", eta: "Same day", fields: ["accountNumber", "bankName"] },
    { method: "MOBILE_WALLET", label: "Mobile wallet", networks: ["OPay", "PalmPay"], provider: "thunes", eta: "Minutes", fields: ["phone"] } ] },
  { country: "GB", name: "United Kingdom", currency: "GBP", flag: "🇬🇧", options: [{ method: "BANK", label: "Bank account", provider: "airwallex", eta: "Minutes", fields: ["accountNumber", "swift"] }, internal] },
  { country: "US", name: "United States", currency: "USD", flag: "🇺🇸", options: [{ method: "BANK", label: "Bank account (ACH)", provider: "airwallex", eta: "1 to 2 days", fields: ["accountNumber", "swift"] }, internal] },
  { country: "CA", name: "Canada", currency: "CAD", flag: "🇨🇦", options: [{ method: "BANK", label: "Bank account (EFT)", provider: "airwallex", eta: "1 to 2 days", fields: ["accountNumber", "swift"] }, internal] },
  { country: "DE", name: "Germany", currency: "EUR", flag: "🇩🇪", options: [{ method: "BANK", label: "Bank account (SEPA)", provider: "airwallex", eta: "Same day", fields: ["iban"] }, internal] },
  { country: "FR", name: "France", currency: "EUR", flag: "🇫🇷", options: [{ method: "BANK", label: "Bank account (SEPA)", provider: "airwallex", eta: "Same day", fields: ["iban"] }, internal] },
];

export const corridor = (country: string) => CORRIDORS.find((c) => c.country === country.toUpperCase());
export const option = (country: string, method: string) => corridor(country)?.options.find((o) => o.method === method);

/** ISO 3166 alpha-2 to alpha-3, for providers that use three letters (Thunes). */
export const ISO3: Record<string, string> = { EG: "EGY", AE: "ARE", SA: "SAU", JO: "JOR", MA: "MAR", PH: "PHL", IN: "IND", PK: "PAK", NG: "NGA", GB: "GBR", US: "USA", CA: "CAN", DE: "DEU", FR: "FRA" };

/** Money in the wallet currency, for notices and emails. */
export const fmt = (cents: number, currency = BASE) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(cents / 100);

const envNum = (k: string, d: number) => { const v = Number(process.env[k]); return Number.isFinite(v) && process.env[k] !== "" && process.env[k] !== undefined ? v : d; };

// ── Investing ──
/** Fee on each buy or sell, in basis points of the amount (100 = 1%), with a minimum. */
export const tradeFee = (cents: number) => Math.max(envNum("PAY_TRADE_FEE_MIN_CENTS", 0), Math.round((cents * envNum("PAY_TRADE_FEE_BPS", 50)) / 10_000));
export const TRADE_MIN_CENTS = 100;

// ── Bill pay ──
export const billFee = () => envNum("PAY_BILL_FEE_CENTS", 0);

// ── Rewards ──
/** Cashback on card purchases in basis points (100 = 1%), and how many days it takes to clear. */
export const cashbackBps = () => envNum("PAY_CASHBACK_BPS", 100);
export const CASHBACK_CLEAR_DAYS = 7;
export const referralBonusCents = () => envNum("PAY_REFERRAL_BONUS_CENTS", 2500);

// ── Lending ──
/** Loan limits and prices by credit band. APR in basis points. Set PAY_LENDING_ENABLED=true to accept applications. */
export const LOAN_BANDS: Record<string, { maxCents: number; aprBps: number }> = {
  EXCELLENT: { maxCents: 2_500_000, aprBps: 899 },
  VERY_GOOD: { maxCents: 1_500_000, aprBps: 1199 },
  GOOD: { maxCents: 750_000, aprBps: 1599 },
  FAIR: { maxCents: 250_000, aprBps: 2299 },
  POOR: { maxCents: 0, aprBps: 0 },
};
export const LOAN_TERMS = [6, 12, 24, 36];
export const lendingOn = () => process.env.PAY_LENDING_ENABLED === "true";

// ── Travel ──
/** Our service fee on flights and stays, in basis points of the provider's price. */
export const travelFeeBps = () => envNum("PAY_TRAVEL_FEE_BPS", 300);
