// Typed wrappers over chrome.storage.local. Keys from DATA-MODEL §4.
export const K = { run: "spark.run", levels: "spark.levels", queue: "spark.queue", prefs: "spark.prefs", tabs: "spark.tabs" } as const;
export async function get<T>(key: string, fallback: T): Promise<T> {
  const v = await chrome.storage.local.get(key);
  return (v[key] as T | undefined) ?? fallback;
}
export const set = (key: string, value: unknown) => chrome.storage.local.set({ [key]: value });
