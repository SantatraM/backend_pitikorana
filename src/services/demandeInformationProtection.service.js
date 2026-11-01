import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import database from "../config/db.js";
import { getRequestContext } from "../config/requestContext.js";

export const informationEnv = (key) => getRequestContext()?.env?.[key] ?? process.env[key];
export function informationError(code, status = 400, retryAfter) {
  return Object.assign(new Error(code), { code, status, retryAfter });
}
function secret() {
  const value = informationEnv("DEMANDE_INFORMATION_SECRET");
  if (typeof value !== "string" || value.length < 32) throw informationError("INFORMATION_UNAVAILABLE", 503);
  return value;
}
export const informationDigest = (value) => createHmac("sha256", secret()).update(value).digest("hex");

export function prepareInformationForm(now = Date.now()) {
  const key = randomUUID();
  const payload = Buffer.from(JSON.stringify({ key, issued: now })).toString("base64url");
  return { key, token: `${payload}.${informationDigest(`form:${payload}`)}`, expires_at: new Date(now + 30 * 60000).toISOString() };
}
export function verifyInformationToken(token, key, now = Date.now(), allowExpired = false) {
  if (typeof token !== "string" || token.length > 400 || typeof key !== "string") throw informationError("INFORMATION_TOKEN_INVALID");
  const [payload, signature, extra] = token.split(".");
  const expected = informationDigest(`form:${payload}`);
  if (extra || !signature || !/^[a-f0-9]{64}$/.test(signature)
    || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw informationError("INFORMATION_TOKEN_INVALID");
  let data;
  try { data = JSON.parse(Buffer.from(payload, "base64url").toString()); } catch { throw informationError("INFORMATION_TOKEN_INVALID"); }
  if (data.key !== key || !Number.isSafeInteger(data.issued) || data.issued > now || (!allowExpired && now - data.issued > 30 * 60000)) throw informationError("INFORMATION_TOKEN_INVALID");
}

export function assertInformationOrigin(req) {
  const origin = req.get("Origin");
  const configured = informationEnv("FRONTEND_URL");
  let expected;
  try { expected = new URL(configured).origin; } catch { /* Production fails closed. */ }
  const local = ["development", "test"].includes(informationEnv("NODE_ENV")) && /^http:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin ?? "");
  if (!origin || (origin !== expected && !local)) throw informationError("INFORMATION_ORIGIN_FORBIDDEN", 403);
}

export function informationNetwork(req) {
  // Only the Worker runtime trusts the Cloudflare-injected address. Node ignores
  // arbitrary forwarding headers; configure rate limiting at a trusted proxy too.
  const address = getRequestContext()?.env ? req.get("CF-Connecting-IP") : req.socket?.remoteAddress;
  if (!address) throw informationError("INFORMATION_UNAVAILABLE", 503);
  return address;
}

export async function consumeInformationQuota(action, subject, limit, seconds, client = database, now = Date.now()) {
  const key = informationDigest(`quota:${action}:${subject}`);
  const start = Math.floor(now / (seconds * 1000)) * seconds * 1000;
  const end = start + seconds * 1000;
  const result = await client.query(`INSERT INTO demande_information_quota (cle, fenetre, nombre, expiration)
    VALUES ($1, $2, 1, $3)
    ON CONFLICT (cle, fenetre) DO UPDATE SET nombre = demande_information_quota.nombre + 1
    WHERE demande_information_quota.nombre < $4 RETURNING nombre`, [key, new Date(start), new Date(end), limit]);
  if (!result.rows.length) throw informationError("INFORMATION_RATE_LIMIT", 429, Math.max(1, Math.ceil((end - now) / 1000)));
  // Bounded cleanup; no scheduler or global process memory is required.
  await client.query(`DELETE FROM demande_information_quota WHERE (cle, fenetre) IN
    (SELECT cle, fenetre FROM demande_information_quota WHERE expiration < now() ORDER BY expiration LIMIT 100)`);
}
