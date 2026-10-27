import { HttpError } from "../../http";

/** JSON call to a payment provider with a timeout. Provider errors become a friendly 502 and are logged. */
export async function call<T = any>(name: string, url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), init.timeoutMs ?? 20_000);
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: ctl.signal });
  } catch (e) {
    console.error(`[${name}] unreachable`, e);
    throw new HttpError(502, `${name} didn't answer. Please try again in a minute.`);
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    console.error(`[${name}] ${res.status}`, typeof data === "string" ? data.slice(0, 500) : JSON.stringify(data).slice(0, 1000));
    const msg = data?.message ?? data?.errors?.[0]?.message ?? data?.error?.message ?? data?.error;
    throw new HttpError(502, `${name} refused the request${typeof msg === "string" ? `: ${msg}` : ""}.`, { provider: name, status: res.status });
  }
  return data as T;
}

/** Throw a clear "connect it first" error when a provider's keys are missing. */
export function need(name: string, ...keys: string[]) {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length) throw new HttpError(503, `${name} isn't connected yet. A super admin adds ${missing.join(", ")} in Super admin, Plugin centre.`);
}
