// The processes this build can run. Phase 0: bundled at build time (validated there).
// Phase 2 replaces this with the org's published bundle from /api/content, cached in storage.
import type { Process } from "@spark/core";
import { PROCESSES } from "../generated/content.ts";

export const processes = (): Process[] => PROCESSES as Process[];
export const getProcess = (id: string) => processes().find((p) => p.id === id);

/** Exact host match against a process's approved systems (no wildcards). */
export const hostAllowed = (host: string, systems: string[]) => systems.some((s) => s.toLowerCase() === host.toLowerCase());
