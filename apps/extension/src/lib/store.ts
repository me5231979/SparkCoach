// Typed wrappers over chrome.storage.local. Keys from DATA-MODEL §4.
export const K = { session: "spark.session", content: "spark.content", run: "spark.run", levels: "spark.levels", queue: "spark.queue", prefs: "spark.prefs", status: "spark.status" } as const;
export async function get<T>(key: string, fallback: T): Promise<T> {
  const v = await chrome.storage.local.get(key);
  return (v[key] as T | undefined) ?? fallback;
}
export const set = (key: string, value: unknown) => chrome.storage.local.set({ [key]: value });

export type Session = { token: string; expiresAt: string; refresh: string; user: { id: string; name: string; email: string; roles: string[] }; org: { id: string; name: string } };
/** What the panel shows about sync: last error in plain words, and queued runs. */
export type Status = { error?: string; queued?: number; syncedAt?: number };
