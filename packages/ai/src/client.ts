// The AI provider. Default: Anthropic (Matchlight-managed key). Per-org model override.
// The app decides; the AI talks. Every call is grounded, structured (JSON schema), and its output is checked by code.
import Anthropic from "@anthropic-ai/sdk";

export const DEFAULT_MODEL = "claude-sonnet-5-5";
let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  if (!client) client = new Anthropic(); // ANTHROPIC_API_KEY from the environment
  return client;
}
/** For tests: inject a stand-in client. */
export function setAnthropic(c: Anthropic | null) { client = c; }
export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;

export class AiError extends Error {}

/** Plain-words error for the author/learner from an SDK failure. */
export function explain(e: unknown): string {
  if (e instanceof Anthropic.RateLimitError) return "The AI is busy right now. Try again in a minute.";
  if (e instanceof Anthropic.AuthenticationError) return "The AI key isn't set up correctly. Ask your Spark admin.";
  if (e instanceof Anthropic.BadRequestError) return "The AI couldn't take that request. Try shorter notes.";
  if (e instanceof Anthropic.APIError) return "The AI service had a problem. Try again.";
  if (e instanceof AiError) return e.message;
  return "Something went wrong talking to the AI. Try again.";
}
