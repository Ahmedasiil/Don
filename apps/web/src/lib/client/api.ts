"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string, public data?: unknown) { super(message); }
}

/** Call an oenodpay API route from the browser. Throws ApiError with the server's friendly message. */
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const res = await fetch(path.startsWith("/") ? path : `/api/${path}`, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers: opts.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: "same-origin",
    signal: opts.signal,
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    if (res.status === 401 && !data?.details?.code && typeof window !== "undefined" && !location.pathname.startsWith("/signin")) {
      location.href = `/signin?next=${encodeURIComponent(location.pathname + location.search)}`;
    }
    throw new ApiError(res.status, data?.error ?? "Something went wrong. Please try again.", data?.code ?? data?.details?.code, data);
  }
  return data as T;
}

/** Minimal data hook: loads on mount and when the key changes, with reload and optimistic set. */
export function useApi<T = any>(path: string | null, opts: { refreshMs?: number } = {}) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!path);
  const live = useRef(true);
  const load = useCallback(async (quiet = false) => {
    if (!path) return;
    if (!quiet) setLoading(true);
    try {
      const d = await api<T>(path);
      if (live.current) { setData(d); setError(null); }
    } catch (e) {
      if (live.current) setError(e instanceof ApiError ? e : new ApiError(0, "You're offline. We'll retry when you're back online."));
    } finally {
      if (live.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    live.current = true;
    load();
    const t = opts.refreshMs ? setInterval(() => { if (document.visibilityState === "visible") load(true); }, opts.refreshMs) : undefined;
    return () => { live.current = false; if (t) clearInterval(t); };
  }, [load, opts.refreshMs]);
  return { data, error, loading, reload: () => load(true), setData };
}
