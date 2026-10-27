import { call, need } from "./http";
import { ISO3 } from "../config";
import { APP_URL } from "../../env";

// Thunes: mobile wallets, instant payment schemes and cash pickup in 130+ countries. https://docs.thunes.com
const base = () => process.env.THUNES_API_URL || (process.env.THUNES_ENV === "live" ? "https://api.thunes.com" : "https://api-mt.pre.thunes.com");
const api = <T = any>(path: string, init: RequestInit = {}) => {
  need("Thunes", "THUNES_API_KEY", "THUNES_API_SECRET");
  const basic = Buffer.from(`${process.env.THUNES_API_KEY}:${process.env.THUNES_API_SECRET}`).toString("base64");
  return call<T>("Thunes", `${base()}${path}`, { ...init, headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
};

interface Payer { id: number; name: string; currency: string; country_iso_code: string; service: { id: number; name: string }; transaction_types?: Record<string, unknown> }

/** Payers (wallets, banks, cash networks) Thunes can reach in a country. */
export async function payers(country: string) {
  const c = ISO3[country] ?? country;
  return api<Payer[]>(`/v2/money-transfer/payers?country_iso_code=${c}&per_page=100`);
}

/** Pick the payer for a network name ("Vodafone Cash", "InstaPay", "Fawry") or the first of a service. */
export async function findPayer(country: string, network?: string | null, service?: string) {
  const list = await payers(country);
  const n = network?.toLowerCase();
  return (n && list.find((p) => p.name.toLowerCase().includes(n))) || (service && list.find((p) => p.service.name.toLowerCase().includes(service))) || list[0] || null;
}

export async function quote(o: { externalId: string; payerId: number; sourceCurrency: string; sourceAmount: number; country: string; destCurrency: string }) {
  return api<{ id: number; fee: { amount: number; currency: string }; destination: { amount: number; currency: string }; wholesale_fx_rate: number; expiration_date: string }>("/v2/money-transfer/quotations", {
    method: "POST",
    body: JSON.stringify({
      external_id: o.externalId, payer_id: o.payerId, mode: "SOURCE_AMOUNT", transaction_type: "C2C",
      source: { amount: o.sourceAmount, currency: o.sourceCurrency, country_iso_code: ISO3[process.env.PAY_SOURCE_COUNTRY || "CA"] ?? "USA" },
      destination: { amount: null, currency: o.destCurrency },
    }),
  });
}

export interface Party { firstname: string; lastname: string; nationality?: string; country?: string; dob?: string; phone?: string }
const party = (p: Party) => ({ firstname: p.firstname, lastname: p.lastname, nationality_country_iso_code: p.nationality ? ISO3[p.nationality] ?? p.nationality : undefined, country_iso_code: p.country ? ISO3[p.country] ?? p.country : undefined, date_of_birth: p.dob, msisdn: p.phone });

/** Create and confirm a transaction on a quote. Status changes arrive on our callback. */
export async function send(o: { quoteId: number; externalId: string; creditParty: { msisdn?: string; bank_account_number?: string; iban?: string; card_number?: string; email?: string }; sender: Party; beneficiary: Party }) {
  const tx = await api<{ id: number; status: string; status_message: string }>(`/v2/money-transfer/quotations/${o.quoteId}/transactions`, {
    method: "POST",
    body: JSON.stringify({
      external_id: o.externalId, credit_party_identifier: o.creditParty,
      sender: party(o.sender), beneficiary: party(o.beneficiary),
      purpose_of_remittance: "FAMILY_SUPPORT", callback_url: `${APP_URL}/api/webhooks/thunes${process.env.THUNES_CALLBACK_SECRET ? `?k=${process.env.THUNES_CALLBACK_SECRET}` : ""}`,
    }),
  });
  const confirmed = await api<{ id: number; status: string; status_message: string }>(`/v2/money-transfer/transactions/${tx.id}/confirm`, { method: "POST", body: "{}" });
  return { providerRef: String(confirmed.id), status: confirmed.status_message || confirmed.status };
}

/** Current status straight from Thunes (callbacks are only a hint: we always re-read). */
export const transaction = (id: string) => api<{ id: number; status: string; status_message: string; external_id: string }>(`/v2/money-transfer/transactions/${id}`);

/** Find a transaction by our own id (to recover after a timeout without paying twice). */
export const byExternalId = (externalId: string) => api<{ id: number; status: string; status_message: string }>(`/v2/money-transfer/transactions/ext-${encodeURIComponent(externalId)}`);

export async function test() {
  await api("/v2/money-transfer/ping");
  return "Thunes keys work.";
}
