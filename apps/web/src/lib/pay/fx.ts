import { BASE } from "@/lib/pay/config";
import { rate } from "@/lib/pay/providers/airwallex";

let cached: { at: number; v: number } | null = null;
/** Airalo prices are in USD; convert to the wallet currency (cached 10 minutes). */
export async function usdRate() {
  if (BASE === "USD") return 1;
  if (cached && Date.now() - cached.at < 600_000) return cached.v;
  const v = await rate("USD", BASE, 100).catch(() => Number(process.env.PAY_USD_RATE_FALLBACK ?? 1.4));
  cached = { at: Date.now(), v };
  return v;
}

const rates = new Map<string, { at: number; v: number }>();
/** How many wallet-currency units one unit of `currency` buys (cached 10 minutes). */
export async function toBaseRate(currency: string) {
  const c = currency.toUpperCase();
  if (c === BASE) return 1;
  if (c === "USD") return usdRate();
  const hit = rates.get(c);
  if (hit && Date.now() - hit.at < 600_000) return hit.v;
  const v = await rate(c, BASE, 100);
  rates.set(c, { at: Date.now(), v });
  return v;
}
