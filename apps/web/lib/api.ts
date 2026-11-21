// Helpers for the extension API: bearer-token auth, JSON in/out, plain-sentence errors.
import "server-only";
import { sessionUser, type SessionUser } from "@spark/db";

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
export const fail = (error: string, status = 400) => json({ error }, status);

export async function extUser(req: Request): Promise<SessionUser | null> {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  return sessionUser(token, "ext");
}

export async function body<T>(req: Request, max = 200_000): Promise<T | null> {
  const text = await req.text();
  if (text.length > max) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
}

// Simple per-instance rate limit (PRD: Ask 40 per 10 min). Good enough for the MVP; move to a shared store later.
const hits = new Map<string, number[]>();
export function limited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > max;
}
