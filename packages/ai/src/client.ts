// The AI provider. Default: Anthropic (Matchlight-managed key). Per-org model override.
// The app decides; the AI talks. Every call is grounded, structured (JSON schema), and its output is checked by code.
import Anthropic from "@anthropic-ai/sdk";

export const DEFAULT_MODEL = "claude-sonnet-5-5";
// One client per API key: each customer brings their own key (BYOK), so usage bills to them.
const clients = new Map<string, Anthropic>();
let override: Anthropic | null = null;
export function anthropic(apiKey: string): Anthropic {
  if (override) return override;
  let c = clients.get(apiKey);
  if (!c) { c = new Anthropic({ apiKey }); clients.set(apiKey, c); if (clients.size > 200) clients.delete(clients.keys().next().value!); }
  return c;
}
/** For tests: inject a stand-in client. */
export function setAnthropic(c: Anthropic | null) { override = c; }

/** Check a key works (Settings → Test). Cheap: lists models. */
export async function testKey(apiKey: string): Promise<{ ok: true } | { error: string }> {
  try { await anthropic(apiKey).models.list({ limit: 1 }); return { ok: true }; } catch (e) { return { error: explain(e) }; }
}

export class AiError extends Error {}

/** Plain-words error for the author/learner from an SDK failure. */
export function explain(e: unknown): string {
  if (e instanceof Anthropic.RateLimitError) return "The AI is busy right now. Try again in a minute.";
  if (e instanceof Anthropic.AuthenticationError) return "Your company's AI key was rejected. An admin can update it under Settings.";
  if (e instanceof Anthropic.PermissionDeniedError) return "Your company's AI key isn't allowed to use that model. Pick another model under Settings.";
  if (e instanceof Anthropic.BadRequestError) return "The AI couldn't take that request. Try shorter notes.";
  if (e instanceof Anthropic.APIError) return "The AI service had a problem. Try again.";
  if (e instanceof AiError) return e.message;
  return "Something went wrong talking to the AI. Try again.";
}
