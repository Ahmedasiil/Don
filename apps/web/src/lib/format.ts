export const money = (v: unknown, currency = "CAD") =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(v ?? 0));
export const num = (v: unknown, d = 0) => new Intl.NumberFormat("en-CA", { maximumFractionDigits: d }).format(Number(v ?? 0));
export const date = (v: Date | string | null | undefined) => (v ? new Date(v).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }) : "—");
export const dateTime = (v: Date | string | null | undefined) => (v ? new Date(v).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
export const time = (v: Date | string | null | undefined) => (v ? new Date(v).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" }) : "—");
export function ago(v: Date | string | null | undefined) {
  if (!v) return "never";
  const s = Math.round((Date.now() - new Date(v).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
export const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
export const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").slice(0, 60);
export function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
/** Great-circle distance in metres. */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371e3, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
