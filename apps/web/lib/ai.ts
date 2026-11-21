// Which AI credentials a request uses: the customer's own key (BYOK) first; the platform key only for customers
// with the Managed AI add-on. Null means AI features show "add your AI key in Settings".
import "server-only";
import { aiCredentials } from "@spark/db";

export const NO_KEY = "AI isn't set up for your company yet. An admin adds your AI key under Settings → AI.";
export const creds = (orgId: string) => aiCredentials(orgId, process.env.ANTHROPIC_API_KEY);
