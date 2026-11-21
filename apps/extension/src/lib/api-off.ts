// Offline builds (no Spark server): the network module is replaced by this stub at build time, so the bundle
// contains no network code at all. Same exports as api.ts.
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function call<T>(_path: string, _init: unknown = {}): Promise<T | null> {
  throw new ApiError(0, "This build has no Spark server.");
}
