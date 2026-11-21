// The coaches this learner can run. Platform builds: the org's published coaches, downloaded from the Spark API
// and cached in storage (spark.content). Offline/test builds: processes bundled at build time.
import type { Process, Theme } from "@spark/core";
import { DEFAULT_THEME } from "@spark/core";
import { API_ORIGIN, PROCESSES } from "../generated/content.ts";

export const PLATFORM = !!API_ORIGIN;
export type Published = Process & { version?: number };
export type ContentCache = { hash: string; processes: Published[]; approvedDomains: string[]; theme: Theme; at: number };

export const bundled = (): Published[] => PROCESSES as Published[];
export const fromCache = (c: ContentCache | null): Published[] => (PLATFORM ? c?.processes ?? [] : bundled());
export const themeFrom = (c: ContentCache | null): Theme => c?.theme ?? DEFAULT_THEME;

/** Exact host match against approved systems (no wildcards). */
export const hostAllowed = (host: string, systems: string[]) => systems.some((s) => s.toLowerCase() === host.toLowerCase());

/** Chrome match pattern for an approved host (ports are not part of match patterns). */
export const patternFor = (h: string) => {
  const host = h.split(":")[0]!;
  return `${host === "localhost" || /^127\./.test(host) ? "http" : "https"}://${host}/*`;
};
