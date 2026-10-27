import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";
import { HttpError } from "../http";
import { audit } from "../audit";
import { model } from "../ai";
import { BASE, fmt, travelFeeBps } from "./config";
import { available, post, walletFor } from "./ledger";
import { checkPin, limitsFor, stepUp, STEP_UP_OVER_CENTS, type PayCtx } from "./guard";
import { notify } from "./notices";
import { toBaseRate } from "./fx";
import { ready, text } from "./ai";
import * as duffel from "./providers/duffel";

// Travel: flights and hotel stays through Duffel, paid from the wallet. The price shown is the provider's price
// converted to the wallet currency plus our service fee; the money moves wallet -> "travel:duffel" (+ fee).
// The AI travel agent can search and suggest, but only the customer can book, with their PIN.

async function priced(amount: string, currency: string) {
  const r = await toBaseRate(currency);
  const base = Math.ceil(Number(amount) * r * 100);
  const fee = Math.ceil((base * travelFeeBps()) / 10_000);
  return { totalCents: base + fee, feeCents: fee, currency: BASE };
}

const fmtDur = (iso: string | null) => { const m = iso?.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/); if (!m) return null; const h = Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0); return `${h}h ${Number(m[3] ?? 0)}m`; };

export async function flights(q: { from: string; to: string; depart: string; back?: string; adults: number; cabin?: string }) {
  const offers = await duffel.searchFlights(q);
  return Promise.all(offers.map(async (o) => ({
    id: o.id, airline: o.owner.name, logo: o.owner.logo_symbol_url, expiresAt: o.expires_at, passengers: o.passengers.length,
    price: await priced(o.total_amount, o.total_currency), providerPrice: `${o.total_amount} ${o.total_currency}`,
    refundable: !!o.conditions?.refund_before_departure?.allowed, changeable: !!o.conditions?.change_before_departure?.allowed,
    slices: o.slices.map((s) => ({ from: s.origin.iata_code, fromCity: s.origin.city_name, to: s.destination.iata_code, toCity: s.destination.city_name, duration: fmtDur(s.duration), stops: s.segments.length - 1, departAt: s.segments[0]?.departing_at, arriveAt: s.segments.at(-1)?.arriving_at, flights: s.segments.map((g) => `${g.marketing_carrier.iata_code}${g.marketing_carrier_flight_number}`) })),
  })));
}

export async function stays(q: { place: string; checkIn: string; checkOut: string; adults: number }) {
  const p = (await duffel.places(q.place)).find((x) => x.latitude != null && x.longitude != null);
  if (!p) throw new HttpError(404, "We couldn't find that place. Try a city name.");
  const results = await duffel.searchStays({ lat: p.latitude!, lng: p.longitude!, checkIn: q.checkIn, checkOut: q.checkOut, adults: q.adults });
  return { place: p.city_name ?? p.name, results: await Promise.all(results.map(async (r) => ({
    id: r.id, name: r.accommodation.name, rating: r.accommodation.rating, reviewScore: r.accommodation.review_score, photo: r.accommodation.photos?.[0]?.url ?? null,
    address: [r.accommodation.location?.address?.line_one, r.accommodation.location?.address?.city_name].filter(Boolean).join(", "),
    price: await priced(r.cheapest_rate_total_amount, r.cheapest_rate_currency), providerPrice: `${r.cheapest_rate_total_amount} ${r.cheapest_rate_currency}`,
  }))) };
}

export async function stayRates(searchResultId: string) {
  const r = await duffel.stayRates(searchResultId);
  return { name: r.accommodation.name, rooms: await Promise.all(r.accommodation.rooms.map(async (room) => ({ name: room.name, rates: await Promise.all(room.rates.slice(0, 4).map(async (x) => ({ id: x.id, board: x.board_type, refundable: x.cancellation_timeline.length > 0, price: await priced(x.total_amount, x.total_currency) }))) }))) };
}

async function charge(ctx: PayCtx, b: { kind: string; offerId: string; title: string; details: object; price: { totalCents: number; feeCents: number }; providerAmount: string; idempotencyKey: string; pin: string; code?: string }) {
  const prior = await db.payBooking.findUnique({ where: { idempotencyKey: b.idempotencyKey } });
  if (prior) { if (prior.userId !== ctx.user.id) throw new HttpError(409, "Duplicate request."); return { booking: prior, fresh: false }; }
  const lim = await limitsFor(ctx);
  if (b.price.totalCents > lim.perTransfer) throw new HttpError(403, "That's over your per-payment limit.", { code: "LIMIT" });
  await checkPin(ctx, b.pin);
  if (b.price.totalCents >= STEP_UP_OVER_CENTS) await stepUp(ctx, b.code, "confirm this booking");
  const { availableCents } = await available(ctx.user.id);
  if (availableCents < b.price.totalCents) throw new HttpError(402, "Not enough money in your wallet. Add money first.");
  const booking = await db.$transaction(async (tx) => {
    const w = await walletFor(ctx.user.id, BASE, tx);
    const bk = await tx.payBooking.create({ data: { userId: ctx.user.id, kind: b.kind, offerId: b.offerId, title: b.title, details: b.details, amountCents: b.price.totalCents, currency: BASE, providerAmount: b.providerAmount, idempotencyKey: b.idempotencyKey } });
    await post(ctx.user.id, "TRAVEL", `travel:${bk.id}`, [
      { walletId: w.id, account: `wallet:${ctx.user.id}`, amountCents: -b.price.totalCents },
      { account: "travel:duffel", amountCents: b.price.totalCents - b.price.feeCents },
      ...(b.price.feeCents ? [{ account: "revenue:fees", amountCents: b.price.feeCents }] : []),
    ], b.title, tx);
    return bk;
  }, { isolationLevel: "Serializable" });
  await audit(ctx, "pay.travel_charged", "PayBooking", booking.id, { kind: b.kind, amountCents: booking.amountCents });
  return { booking, fresh: true };
}

async function refund(bookingId: string, reason: string) {
  const bk = await db.payBooking.findUniqueOrThrow({ where: { id: bookingId } });
  await db.$transaction(async (tx) => {
    const claimed = await tx.payBooking.updateMany({ where: { id: bk.id, status: "PROCESSING" }, data: { status: "FAILED", failureReason: reason.slice(0, 300) } });
    if (!claimed.count) return;
    const w = await walletFor(bk.userId, BASE, tx);
    const j = await tx.payJournal.findUnique({ where: { reference: `travel:${bk.id}` }, include: { lines: true } });
    await post(bk.userId, "TRAVEL_REFUND", `travel-back:${bk.id}`, [...(j?.lines.filter((l) => !l.walletId).map((l) => ({ account: l.account, amountCents: -l.amountCents })) ?? []), { walletId: w.id, account: `wallet:${bk.userId}`, amountCents: bk.amountCents }], `${bk.title} didn't book`, tx);
  });
  await notify(bk.userId, "TRAVEL", "Your booking didn't go through", `${reason} Your money is back in your wallet.`, "/app/travel");
}

export async function bookFlight(ctx: PayCtx, input: { offerId: string; travellers: duffel.Traveller[]; pin: string; code?: string; idempotencyKey: string }) {
  const o = await duffel.offer(input.offerId);
  if (new Date(o.expires_at) < new Date()) throw new HttpError(410, "This fare has expired. Search again for the latest price.");
  if (input.travellers.length !== o.passengers.length) throw new HttpError(422, `Add details for all ${o.passengers.length} travellers.`);
  const price = await priced(o.total_amount, o.total_currency);
  const s0 = o.slices[0];
  const title = `${s0.origin.city_name ?? s0.origin.iata_code} → ${s0.destination.city_name ?? s0.destination.iata_code}${o.slices.length > 1 ? " and back" : ""}, ${new Date(s0.segments[0].departing_at).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}`;
  const { booking, fresh } = await charge(ctx, { kind: "FLIGHT", offerId: o.id, title, details: { airline: o.owner.name, slices: o.slices.map((s) => ({ from: s.origin.iata_code, to: s.destination.iata_code, departAt: s.segments[0].departing_at, arriveAt: s.segments.at(-1)!.arriving_at, flights: s.segments.map((g) => `${g.marketing_carrier.iata_code}${g.marketing_carrier_flight_number}`) })), travellers: input.travellers.map((t) => `${t.given_name} ${t.family_name}`) }, price, providerAmount: `${o.total_amount} ${o.total_currency}`, idempotencyKey: input.idempotencyKey, pin: input.pin, code: input.code });
  if (!fresh) return booking;
  try {
    const order = await duffel.bookFlight(o.id, o.total_amount, o.total_currency, input.travellers.map((t, i) => ({ ...t, id: o.passengers[i].id })), booking.id);
    const done = await db.payBooking.update({ where: { id: booking.id }, data: { status: "CONFIRMED", orderId: order.id, reference: order.booking_reference } });
    await notify(ctx.user.id, "TRAVEL", "Your flight is booked", `${title}. Booking reference ${order.booking_reference}.`, "/app/travel");
    return done;
  } catch (e) {
    await refund(booking.id, e instanceof Error ? e.message : "The airline didn't confirm.");
    throw e;
  }
}

export async function bookStay(ctx: PayCtx, input: { rateId: string; hotel: string; checkIn: string; checkOut: string; guest: { given_name: string; family_name: string }; phone: string; pin: string; code?: string; idempotencyKey: string }) {
  const q = await duffel.quoteStay(input.rateId);
  const price = await priced(q.total_amount, q.total_currency);
  const title = `${input.hotel}, ${input.checkIn} to ${input.checkOut}`;
  const { booking, fresh } = await charge(ctx, { kind: "STAY", offerId: q.id, title, details: { hotel: input.hotel, checkIn: input.checkIn, checkOut: input.checkOut, guest: `${input.guest.given_name} ${input.guest.family_name}` }, price, providerAmount: `${q.total_amount} ${q.total_currency}`, idempotencyKey: input.idempotencyKey, pin: input.pin, code: input.code });
  if (!fresh) return booking;
  try {
    const b = await duffel.bookStay(q.id, input.guest, ctx.user.email, input.phone);
    const done = await db.payBooking.update({ where: { id: booking.id }, data: { status: "CONFIRMED", orderId: b.id, reference: b.reference } });
    await notify(ctx.user.id, "TRAVEL", "Your stay is booked", `${title}. Confirmation ${b.reference}.`, "/app/travel");
    return done;
  } catch (e) {
    await refund(booking.id, e instanceof Error ? e.message : "The hotel didn't confirm.");
    throw e;
  }
}

// ── The AI travel agent ──

const AGENT = `You are the oenodpay travel agent. You plan trips and find real flights and hotels with your tools.
Ask at most one short question when something essential is missing (where from, where to, dates, how many people). Otherwise search.
Use airport or city IATA codes for flights (find them with search_places). Dates are YYYY-MM-DD; today is ${"{TODAY}"}.
After searching, recommend 2 or 3 options in a few sentences: cheapest, fastest, best value. Prices you get are already in the customer's wallet currency and include the oenodpay fee.
You cannot book or pay. Tell the customer to tap Book on the option they like. Mention the eSIM in the app for data abroad when relevant.
Be warm and concise. No markdown tables.`;

const TOOLS: Anthropic.Beta.BetaTool[] = [
  { name: "search_places", description: "Find airports and cities and their IATA codes.", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "search_flights", description: "Live flight offers. Returns the cheapest 20.", input_schema: { type: "object", properties: { from: { type: "string", description: "IATA code" }, to: { type: "string" }, depart: { type: "string" }, back: { type: "string", description: "Return date, omit for one way" }, adults: { type: "integer" }, cabin: { type: "string", enum: ["economy", "premium_economy", "business", "first"] } }, required: ["from", "to", "depart", "adults"] } },
  { name: "search_stays", description: "Live hotel offers near a city.", input_schema: { type: "object", properties: { place: { type: "string" }, checkIn: { type: "string" }, checkOut: { type: "string" }, adults: { type: "integer" } }, required: ["place", "checkIn", "checkOut", "adults"] } },
];

type Found = { flights?: Awaited<ReturnType<typeof flights>>; stays?: Awaited<ReturnType<typeof stays>>; search?: Record<string, unknown> };

export async function travelChat(userId: string, message: string) {
  ready();
  const thread = await db.payTravelThread.findUnique({ where: { userId } });
  const history = ((thread?.messages as unknown as { role: "user" | "assistant"; content: string }[]) ?? []).slice(-16);
  const msgs: Anthropic.Beta.BetaMessageParam[] = [...history, { role: "user", content: message }];
  const client = new Anthropic();
  const found: Found = {};
  let reply = "";
  for (let step = 0; step < 6; step++) {
    const res = await client.beta.messages.create({
      model: model(), max_tokens: 3000, output_config: { effort: "medium" },
      system: AGENT.replace("{TODAY}", new Date().toISOString().slice(0, 10)), tools: TOOLS, messages: msgs,
      betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
    });
    msgs.push({ role: "assistant", content: res.content as Anthropic.Beta.BetaContentBlockParam[] });
    reply = text(res.content) || reply;
    const uses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || !uses.length) break;
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const u of uses) {
      const i = (u.input ?? {}) as Record<string, any>;
      let out: unknown;
      try {
        if (u.name === "search_places") out = (await duffel.places(String(i.query))).slice(0, 8).map((p) => ({ name: p.name, type: p.type, iata: p.iata_code, city: p.city_name, country: p.iata_country_code }));
        else if (u.name === "search_flights") {
          found.flights = await flights({ from: String(i.from).toUpperCase(), to: String(i.to).toUpperCase(), depart: i.depart, back: i.back, adults: Number(i.adults) || 1, cabin: i.cabin });
          found.search = { kind: "flights", ...i };
          out = found.flights.slice(0, 8).map((f) => ({ airline: f.airline, price: fmt(f.price.totalCents), slices: f.slices.map((s) => `${s.from}-${s.to} ${s.departAt} ${s.duration} ${s.stops} stop(s)`), refundable: f.refundable }));
        } else if (u.name === "search_stays") {
          found.stays = await stays({ place: String(i.place), checkIn: i.checkIn, checkOut: i.checkOut, adults: Number(i.adults) || 1 });
          found.search = { kind: "stays", ...i };
          out = found.stays.results.slice(0, 8).map((s) => ({ name: s.name, stars: s.rating, review: s.reviewScore, price: fmt(s.price.totalCents), area: s.address }));
        } else out = { error: "Unknown tool" };
      } catch (e) {
        out = { error: e instanceof Error ? e.message : "Search failed" };
      }
      results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out) });
    }
    msgs.push({ role: "user", content: results });
  }
  if (!reply) reply = "Tell me where you're going and when, and I'll find flights and places to stay.";
  const messages = [...history, { role: "user", content: message }, { role: "assistant", content: reply }];
  await db.payTravelThread.upsert({ where: { userId }, create: { userId, messages }, update: { messages } });
  return { reply, ...found };
}
