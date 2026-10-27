import { call } from "./http";

// OpenSanctions: one search across 300+ sanctions, PEP and watch lists (UN, OFAC, EU, UK HMT and more).
// https://www.opensanctions.org/docs/api/  Without a key, screening is reported as "not run" and money stays in review.

export interface Screening { ran: boolean; sanction: boolean; pep: boolean; score: number; matches: { name: string; score: number; datasets: string[]; topics: string[]; id: string }[] }

export async function screenPerson(p: { name: string; birthDate?: string | null; country?: string | null }): Promise<Screening> {
  if (!process.env.OPENSANCTIONS_API_KEY) return { ran: false, sanction: false, pep: false, score: 0, matches: [] };
  const r = await call<{ responses: Record<string, { results: { id: string; caption: string; score: number; match: boolean; datasets: string[]; properties: Record<string, string[]> }[] }> }>(
    "OpenSanctions", "https://api.opensanctions.org/match/default?algorithm=logic-v1", {
      method: "POST",
      headers: { Authorization: `ApiKey ${process.env.OPENSANCTIONS_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ queries: { p: { schema: "Person", properties: { name: [p.name], ...(p.birthDate ? { birthDate: [p.birthDate] } : {}), ...(p.country ? { country: [p.country.toLowerCase()] } : {}) } } } }),
    });
  const hits = (r.responses.p?.results ?? []).filter((x) => x.score >= Number(process.env.SANCTIONS_MIN_SCORE ?? 0.7));
  const topics = (x: (typeof hits)[number]) => x.properties?.topics ?? [];
  return {
    ran: true,
    sanction: hits.some((x) => x.match && topics(x).some((t) => t.startsWith("sanction") || t === "crime" || t === "wanted")),
    pep: hits.some((x) => x.match && topics(x).some((t) => t.startsWith("role.pep") || t === "role.rca")),
    score: Math.max(0, ...hits.map((x) => x.score)),
    matches: hits.slice(0, 5).map((x) => ({ id: x.id, name: x.caption, score: x.score, datasets: x.datasets, topics: topics(x) })),
  };
}

export async function test() {
  const s = await screenPerson({ name: "Test Person" });
  return s.ran ? "OpenSanctions key works." : "Add OPENSANCTIONS_API_KEY.";
}
