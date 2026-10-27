import { call, need } from "./http";

// Airwallex: bank payouts to 150+ countries and live FX. https://www.airwallex.com/docs/api
const base = () => (process.env.AIRWALLEX_ENV === "live" ? "https://api.airwallex.com" : "https://api-demo.airwallex.com");
let token: { value: string; until: number } | null = null;

async function auth() {
  need("Airwallex", "AIRWALLEX_CLIENT_ID", "AIRWALLEX_API_KEY");
  if (token && token.until > Date.now() + 60_000) return token.value;
  const r = await call<{ token: string; expires_at: string }>("Airwallex", `${base()}/api/v1/authentication/login`, {
    method: "POST", headers: { "x-client-id": process.env.AIRWALLEX_CLIENT_ID!, "x-api-key": process.env.AIRWALLEX_API_KEY!, "Content-Type": "application/json" }, body: "{}",
  });
  token = { value: r.token, until: new Date(r.expires_at).getTime() || Date.now() + 25 * 60_000 };
  return token.value;
}
const api = async <T = any>(path: string, init: RequestInit = {}) =>
  call<T>("Airwallex", `${base()}${path}`, { ...init, headers: { Authorization: `Bearer ${await auth()}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });

/** Live rate for selling `sell` to buy `buy` (how many `buy` for one `sell`). */
export async function rate(sell: string, buy: string, sellAmount: number) {
  if (sell === buy) return 1;
  const q = new URLSearchParams({ sell_currency: sell, buy_currency: buy, sell_amount: sellAmount.toFixed(2) });
  const r = await api<{ rate: number }>(`/api/v1/fx/rates/current?${q}`);
  return Number(r.rate);
}

export interface BankDetails { name: string; country: string; currency: string; accountNumber?: string; iban?: string; swift?: string; bankName?: string; address?: { city?: string; street?: string } }

/** Send a bank payout. request_id makes it safe to retry: Airwallex won't pay twice. */
export async function payout(o: { requestId: string; sourceCurrency: string; sourceAmount: number; to: BankDetails; reference: string }) {
  const b = o.to;
  const [first, ...rest] = b.name.trim().split(/\s+/);
  const r = await api<{ id: string; status: string }>("/api/v1/transfers/create", {
    method: "POST",
    body: JSON.stringify({
      request_id: o.requestId,
      source_currency: o.sourceCurrency,
      source_amount: o.sourceAmount,
      transfer_currency: b.currency,
      transfer_method: b.iban || b.swift ? "SWIFT" : "LOCAL",
      reason: "family_support",
      reference: o.reference.slice(0, 35),
      beneficiary: {
        entity_type: "PERSONAL",
        first_name: first, last_name: rest.join(" ") || first,
        address: { country_code: b.country, city: b.address?.city ?? "", street_address: b.address?.street ?? "" },
        bank_details: {
          account_name: b.name, account_currency: b.currency, bank_country_code: b.country,
          ...(b.iban ? { iban: b.iban } : {}), ...(b.accountNumber ? { account_number: b.accountNumber } : {}),
          ...(b.swift ? { swift_code: b.swift } : {}), ...(b.bankName ? { bank_name: b.bankName } : {}),
        },
      },
    }),
  });
  return { providerRef: r.id, status: r.status };
}

export const transfer = (id: string) => api<{ id: string; status: string; failure_reason?: string }>(`/api/v1/transfers/${id}`);

/** Find a payout by our request id (to recover after a timeout without paying twice). */
export async function byRequestId(requestId: string) {
  const r = await api<{ items: { id: string; status: string; request_id: string; failure_reason?: string }[] }>(`/api/v1/transfers?request_id=${encodeURIComponent(requestId)}&page_size=1`);
  return r.items?.[0] ?? null;
}

export async function test() {
  await auth();
  return "Airwallex keys work.";
}
