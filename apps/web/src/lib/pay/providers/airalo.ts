import { call, need } from "./http";

// Airalo Partner API: travel eSIM data plans in 200+ countries. https://partners-doc.airalo.com
const base = () => (process.env.AIRALO_ENV === "live" ? "https://partners-api.airalo.com/v2" : "https://sandbox-partners-api.airalo.com/v2");
let token: { value: string; until: number } | null = null;

async function auth() {
  need("Airalo", "AIRALO_CLIENT_ID", "AIRALO_CLIENT_SECRET");
  if (token && token.until > Date.now() + 60_000) return token.value;
  const form = new URLSearchParams({ client_id: process.env.AIRALO_CLIENT_ID!, client_secret: process.env.AIRALO_CLIENT_SECRET!, grant_type: "client_credentials" });
  const r = await call<{ data: { access_token: string; expires_in: number } }>("Airalo", `${base()}/token`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  token = { value: r.data.access_token, until: Date.now() + (r.data.expires_in ?? 3600) * 1000 };
  return token.value;
}
const api = async <T = any>(path: string, init: RequestInit = {}) => call<T>("Airalo", `${base()}${path}`, { ...init, headers: { Accept: "application/json", Authorization: `Bearer ${await auth()}`, ...(init.headers ?? {}) } });

export interface EsimPackage { id: string; title: string; data: string; days: number; priceCents: number; currency: string; operator: string; country: string; image?: string | null }

/** Plans for one country, cheapest first, with our margin (PAY_ESIM_MARKUP_PCT, default 20%). */
export async function packages(country: string): Promise<EsimPackage[]> {
  const r = await api<{ data: { country_code: string; title: string; image?: { url: string }; operators: { title: string; image?: { url: string }; packages: { id: string; title: string; price: number; data: string; day: number }[] }[] }[] }>(
    `/packages?filter[country]=${encodeURIComponent(country.toUpperCase())}&filter[type]=local&limit=100`);
  const markup = 1 + Number(process.env.PAY_ESIM_MARKUP_PCT ?? 20) / 100;
  const out: EsimPackage[] = [];
  for (const c of r.data ?? []) for (const op of c.operators ?? []) for (const p of op.packages ?? []) {
    out.push({ id: p.id, title: p.title, data: p.data, days: p.day, priceCents: Math.ceil(p.price * markup * 100), currency: "USD", operator: op.title, country: c.country_code, image: op.image?.url ?? c.image?.url ?? null });
  }
  return out.sort((a, b) => a.priceCents - b.priceCents);
}

/** Buy one eSIM. Returns what the traveller needs to install it: a QR code and a manual activation code. */
export async function order(packageId: string, description: string) {
  const form = new URLSearchParams({ package_id: packageId, quantity: "1", type: "sim", description: description.slice(0, 100) });
  const r = await api<{ data: { id: number; sims: { iccid: string; lpa: string; matching_id: string; qrcode_url: string; qrcode?: string }[] } }>("/orders", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  const sim = r.data.sims?.[0];
  return { orderId: String(r.data.id), iccid: sim?.iccid ?? null, qrcodeUrl: sim?.qrcode_url ?? null, lpa: sim ? `LPA:1$${sim.lpa}$${sim.matching_id}` : null };
}

/** Data left on an installed eSIM. */
export const usage = (iccid: string) => api<{ data: { remaining: number; total: number; expired_at: string; status: string } }>(`/sims/${iccid}/usage`).then((r) => r.data);

export async function test() {
  await auth();
  return "Airalo keys work.";
}
