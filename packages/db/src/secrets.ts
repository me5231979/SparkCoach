// Encryption for customer secrets (their AI keys). AES-256-GCM; the key comes from SPARK_ENCRYPTION_KEY
// (32 random bytes, base64). Ciphertext format: v1.<iv>.<tag>.<data> (base64url).
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key(): Buffer {
  const k = process.env.SPARK_ENCRYPTION_KEY;
  if (!k) throw new Error("SPARK_ENCRYPTION_KEY is not set");
  const b = Buffer.from(k, "base64");
  if (b.length !== 32) throw new Error("SPARK_ENCRYPTION_KEY must be 32 bytes, base64");
  return b;
}
export const encryptionReady = () => { try { key(); return true; } catch { return false; } };

export function seal(plain: string, aad: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  c.setAAD(Buffer.from(aad));
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function open(sealed: string, aad: string): string {
  const [v, iv, tag, data] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("bad ciphertext");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAAD(Buffer.from(aad));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
}

export const hint = (k: string) => (k.length > 12 ? `${k.slice(0, 7)}…${k.slice(-4)}` : "set");
