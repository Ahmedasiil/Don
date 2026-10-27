import { call } from "./http";

// Live prices. Crypto from CoinGecko (works without a key), stocks, ETFs, metals and currencies from
// Twelve Data (TWELVEDATA_API_KEY). Prices are cached for 30 seconds so many viewers share one call.

export interface Quote { symbol: string; name: string; kind: "STOCK" | "CRYPTO" | "METAL" | "FX"; price: number | null; changePct: number | null; currency: string; halal: boolean; source: string; at: string }
export interface Asset { symbol: string; name: string; kind: Quote["kind"]; halal: boolean; coingecko?: string }

// Halal flags follow common Shariah screens (no conventional banks, alcohol, gambling; gold and silver allowed).
// They are a starting point: confirm with your Shariah advisor before marketing them as certified.
export const ASSETS: Asset[] = [
  { symbol: "AAPL", name: "Apple", kind: "STOCK", halal: true }, { symbol: "MSFT", name: "Microsoft", kind: "STOCK", halal: true },
  { symbol: "NVDA", name: "Nvidia", kind: "STOCK", halal: true }, { symbol: "TSLA", name: "Tesla", kind: "STOCK", halal: true },
  { symbol: "AMZN", name: "Amazon", kind: "STOCK", halal: true }, { symbol: "JPM", name: "JPMorgan Chase", kind: "STOCK", halal: false },
  { symbol: "SPUS", name: "SP Funds S&P 500 Sharia ETF", kind: "STOCK", halal: true }, { symbol: "SPY", name: "S&P 500 ETF", kind: "STOCK", halal: false },
  { symbol: "BTC", name: "Bitcoin", kind: "CRYPTO", halal: true, coingecko: "bitcoin" }, { symbol: "ETH", name: "Ethereum", kind: "CRYPTO", halal: true, coingecko: "ethereum" },
  { symbol: "SOL", name: "Solana", kind: "CRYPTO", halal: true, coingecko: "solana" }, { symbol: "USDT", name: "Tether", kind: "CRYPTO", halal: true, coingecko: "tether" },
  { symbol: "XAU/USD", name: "Gold, 1 oz", kind: "METAL", halal: true }, { symbol: "XAG/USD", name: "Silver, 1 oz", kind: "METAL", halal: true },
  { symbol: "USD/EGP", name: "US dollar to Egyptian pound", kind: "FX", halal: true }, { symbol: "EUR/USD", name: "Euro to US dollar", kind: "FX", halal: true },
  { symbol: "USD/SAR", name: "US dollar to Saudi riyal", kind: "FX", halal: true }, { symbol: "USD/AED", name: "US dollar to UAE dirham", kind: "FX", halal: true },
];

let cache: { at: number; data: Quote[] } | null = null;

export async function quotes(): Promise<Quote[]> {
  if (cache && Date.now() - cache.at < 30_000) return cache.data;
  const now = new Date().toISOString();
  const crypto = ASSETS.filter((a) => a.coingecko);
  const rest = ASSETS.filter((a) => !a.coingecko);
  const [cg, td] = await Promise.all([
    call<Record<string, { usd: number; usd_24h_change: number }>>("CoinGecko", `https://api.coingecko.com/api/v3/simple/price?ids=${crypto.map((a) => a.coingecko).join(",")}&vs_currencies=usd&include_24hr_change=true`,
      { headers: process.env.COINGECKO_API_KEY ? { "x-cg-demo-api-key": process.env.COINGECKO_API_KEY } : {}, timeoutMs: 8000 }).catch(() => ({} as Record<string, { usd: number; usd_24h_change: number }>)),
    process.env.TWELVEDATA_API_KEY
      ? call<Record<string, { close?: string; percent_change?: string; currency?: string; status?: string }>>("Twelve Data", `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(rest.map((a) => a.symbol).join(","))}&apikey=${process.env.TWELVEDATA_API_KEY}`, { timeoutMs: 8000 }).catch(() => ({}))
      : Promise.resolve({} as Record<string, { close?: string; percent_change?: string; currency?: string }>),
  ]);
  const data: Quote[] = [
    ...crypto.map((a) => ({ symbol: a.symbol, name: a.name, kind: a.kind, halal: a.halal, price: cg[a.coingecko!]?.usd ?? null, changePct: cg[a.coingecko!]?.usd_24h_change ?? null, currency: "USD", source: "CoinGecko", at: now })),
    ...rest.map((a) => { const q = (td as Record<string, { close?: string; percent_change?: string; currency?: string }>)[a.symbol]; return { symbol: a.symbol, name: a.name, kind: a.kind, halal: a.halal, price: q?.close ? Number(q.close) : null, changePct: q?.percent_change ? Number(q.percent_change) : null, currency: q?.currency ?? (a.kind === "FX" ? a.symbol.split("/")[1] : "USD"), source: "Twelve Data", at: now }; }),
  ];
  cache = { at: Date.now(), data };
  return data;
}

/** Recent closes for a sparkline (daily, last 30 days). */
export async function history(symbol: string): Promise<number[]> {
  const a = ASSETS.find((x) => x.symbol === symbol);
  if (!a) return [];
  if (a.coingecko) {
    const r = await call<{ prices: [number, number][] }>("CoinGecko", `https://api.coingecko.com/api/v3/coins/${a.coingecko}/market_chart?vs_currency=usd&days=30&interval=daily`, { timeoutMs: 8000 }).catch(() => ({ prices: [] }));
    return r.prices.map((p) => p[1]);
  }
  if (!process.env.TWELVEDATA_API_KEY) return [];
  const r = await call<{ values?: { close: string }[] }>("Twelve Data", `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=30&apikey=${process.env.TWELVEDATA_API_KEY}`, { timeoutMs: 8000 }).catch(() => ({ values: [] as { close: string }[] }));
  return (r.values ?? []).map((v) => Number(v.close)).reverse();
}
