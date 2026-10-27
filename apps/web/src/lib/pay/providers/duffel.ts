import { call, need } from "./http";

// Duffel: flights from 300+ airlines and hotel stays, paid from oenodpay's prefunded Duffel balance.
// Use a test token (duffel_test_...) until you're ready to sell real tickets.
const api = <T>(path: string, init: RequestInit & { timeoutMs?: number } = {}) => {
  need("Duffel", "DUFFEL_ACCESS_TOKEN");
  return call<{ data: T }>("Duffel", `https://api.duffel.com${path}`, {
    timeoutMs: 45_000, ...init,
    headers: { Authorization: `Bearer ${process.env.DUFFEL_ACCESS_TOKEN}`, "Duffel-Version": "v2", Accept: "application/json", "Content-Type": "application/json", ...(init.headers ?? {}) },
  }).then((r) => r.data);
};

export interface Place { id: string; type: "airport" | "city"; name: string; iata_code: string | null; city_name?: string | null; iata_country_code: string; latitude: number | null; longitude: number | null }
export const places = (query: string) => api<Place[]>(`/places/suggestions?query=${encodeURIComponent(query)}`);

export interface Segment { departing_at: string; arriving_at: string; origin: { iata_code: string; city_name: string | null }; destination: { iata_code: string; city_name: string | null }; marketing_carrier: { name: string; iata_code: string }; marketing_carrier_flight_number: string; duration: string | null }
export interface Offer { id: string; total_amount: string; total_currency: string; expires_at: string; owner: { name: string; logo_symbol_url: string | null }; slices: { origin: { iata_code: string; city_name: string | null }; destination: { iata_code: string; city_name: string | null }; duration: string | null; segments: Segment[] }[]; passengers: { id: string; type: string }[]; conditions?: { refund_before_departure?: { allowed: boolean } | null; change_before_departure?: { allowed: boolean } | null } }

export async function searchFlights(q: { from: string; to: string; depart: string; back?: string; adults: number; cabin?: string }) {
  const slices = [{ origin: q.from, destination: q.to, departure_date: q.depart }, ...(q.back ? [{ origin: q.to, destination: q.from, departure_date: q.back }] : [])];
  const r = await api<{ offers: Offer[] }>("/air/offer_requests?return_offers=true&supplier_timeout=20000", {
    method: "POST", body: JSON.stringify({ data: { slices, passengers: Array.from({ length: Math.max(1, Math.min(9, q.adults)) }, () => ({ type: "adult" })), cabin_class: q.cabin ?? "economy", max_connections: 1 } }),
  });
  return r.offers.sort((a, b) => Number(a.total_amount) - Number(b.total_amount)).slice(0, 20);
}

export const offer = (id: string) => api<Offer>(`/air/offers/${id}`);

export interface Traveller { given_name: string; family_name: string; born_on: string; gender: "m" | "f"; title: "mr" | "ms" | "mrs" | "miss" | "dr"; email: string; phone_number: string }
export async function bookFlight(offerId: string, amount: string, currency: string, travellers: (Traveller & { id: string })[], idempotencyKey: string) {
  return api<{ id: string; booking_reference: string }>("/air/orders", {
    method: "POST", headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ data: { type: "instant", selected_offers: [offerId], payments: [{ type: "balance", amount, currency }], passengers: travellers } }),
  });
}

export interface StayResult { id: string; cheapest_rate_total_amount: string; cheapest_rate_currency: string; accommodation: { id: string; name: string; rating: number | null; review_score: number | null; photos?: { url: string }[]; location?: { address?: { line_one?: string; city_name?: string } } } }
export async function searchStays(q: { lat: number; lng: number; checkIn: string; checkOut: string; adults: number; rooms?: number }) {
  const r = await api<{ results: StayResult[] }>("/stays/search", {
    method: "POST", body: JSON.stringify({ data: { location: { radius: 10, geographic_coordinates: { latitude: q.lat, longitude: q.lng } }, check_in_date: q.checkIn, check_out_date: q.checkOut, rooms: q.rooms ?? 1, guests: Array.from({ length: Math.max(1, Math.min(8, q.adults)) }, () => ({ type: "adult" })) } }),
  });
  return r.results.slice(0, 20);
}

export interface Rate { id: string; total_amount: string; total_currency: string; board_type: string; cancellation_timeline: { refund_amount: string; before: string }[] }
export const stayRates = (searchResultId: string) => api<{ accommodation: { name: string; rooms: { name: string; rates: Rate[] }[] } }>(`/stays/search_results/${searchResultId}/actions/fetch_all_rates`, { method: "POST" });
export const quoteStay = (rateId: string) => api<{ id: string; total_amount: string; total_currency: string }>("/stays/quotes", { method: "POST", body: JSON.stringify({ data: { rate_id: rateId } }) });
export const bookStay = (quoteId: string, guest: { given_name: string; family_name: string }, email: string, phone: string) =>
  api<{ id: string; reference: string }>("/stays/bookings", { method: "POST", body: JSON.stringify({ data: { quote_id: quoteId, guests: [guest], email, phone_number: phone } }) });

export async function test() {
  await places("Toronto");
  return "Connected";
}
