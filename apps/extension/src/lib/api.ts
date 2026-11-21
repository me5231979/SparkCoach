// THE ONLY NETWORK CODE IN THE EXTENSION. One origin (the Spark API, fixed at build time), one fetch call site.
// The build guard (build.mjs) fails if fetch appears anywhere else or this file gains a second call site.
import { API_ORIGIN } from "../generated/content.ts";

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

export async function call<T>(path: string, init: { method?: "GET" | "POST"; token?: string; body?: unknown } = {}): Promise<T | null> {
  if (!API_ORIGIN) throw new ApiError(0, "This build has no Spark server.");
  const res = await fetch(API_ORIGIN + path, {
    method: init.method ?? "GET",
    headers: { ...(init.token ? { authorization: `Bearer ${init.token}` } : {}), ...(init.body !== undefined ? { "content-type": "application/json" } : {}) },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    credentials: "omit",
    cache: "no-store",
  });
  if (res.status === 304) return null;
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Spark couldn't reach your company's server.");
  return data as T;
}
