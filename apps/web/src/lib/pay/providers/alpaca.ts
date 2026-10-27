import { call, need } from "./http";

// Alpaca: US stocks, ETFs and crypto. oenodpay trades from its own (omnibus) brokerage account and keeps each
// customer's share in PayHolding. Use the paper URL until your dealer registration is in place.
const base = () => (process.env.ALPACA_BASE_URL || "https://paper-api.alpaca.markets").replace(/\/$/, "");
const headers = () => ({ "APCA-API-KEY-ID": process.env.ALPACA_KEY_ID ?? "", "APCA-API-SECRET-KEY": process.env.ALPACA_SECRET_KEY ?? "", "Content-Type": "application/json" });

export interface Order { id: string; client_order_id: string; status: string; filled_qty: string | null; filled_avg_price: string | null; symbol: string; side: string }

/** Alpaca writes crypto pairs as BTC/USD. */
export const brokerSymbol = (symbol: string, kind: string) => (kind === "CRYPTO" ? `${symbol}/USD` : symbol);

export async function order(o: { clientOrderId: string; symbol: string; kind: string; side: "buy" | "sell"; notionalUsd?: number; qty?: string }) {
  need("Alpaca", "ALPACA_KEY_ID", "ALPACA_SECRET_KEY");
  return call<Order>("Alpaca", `${base()}/v2/orders`, {
    method: "POST", headers: headers(),
    body: JSON.stringify({
      symbol: brokerSymbol(o.symbol, o.kind), side: o.side, type: "market", time_in_force: o.kind === "CRYPTO" ? "gtc" : "day", client_order_id: o.clientOrderId,
      ...(o.notionalUsd !== undefined ? { notional: o.notionalUsd.toFixed(2) } : { qty: o.qty }),
    }),
  });
}

export const byClientId = (clientOrderId: string) =>
  call<Order>("Alpaca", `${base()}/v2/orders:by_client_order_id?client_order_id=${encodeURIComponent(clientOrderId)}`, { headers: headers() });

export async function test() {
  need("Alpaca", "ALPACA_KEY_ID", "ALPACA_SECRET_KEY");
  const a = await call<{ status: string; currency: string }>("Alpaca", `${base()}/v2/account`, { headers: headers() });
  return `Account ${a.status.toLowerCase()} (${a.currency})`;
}
