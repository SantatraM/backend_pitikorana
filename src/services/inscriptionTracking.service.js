import { createHmac } from "node:crypto";
import database from "../config/db.js";
import { getRequestContext } from "../config/requestContext.js";
import { generateCodeSuivi, generateReference, hashCodeSuivi } from "../utils/suiviInscription.js";

export const trackingError = (code, status = 503, retryAfter) => Object.assign(new Error(code), { code, status, retryAfter });
export function trackingDigest(value) {
  const secret = getRequestContext()?.env?.INSCRIPTION_TRACKING_SECRET ?? process.env.INSCRIPTION_TRACKING_SECRET;
  if (typeof secret !== "string" || secret.length < 32) throw trackingError("TRACKING_UNAVAILABLE");
  return createHmac("sha256", secret).update(`registration:v1:${value}`).digest("hex");
}

// The caller owns the transaction. Savepoints allow retries after PostgreSQL
// unique violations without continuing inside an aborted transaction.
export async function insertWithUniqueTracking(insert, client = database, generate = () => ({ reference: generateReference(), code: generateCodeSuivi() })) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { reference, code } = generate();
    const fingerprint = trackingDigest(`code:${code}`);
    const hash = await hashCodeSuivi(code);
    await client.query("SAVEPOINT inscription_tracking_candidate");
    try {
      const row = await insert({ reference, code, fingerprint, hash });
      await client.query("INSERT INTO public.inscription_code_suivi (empreinte, id_demande) VALUES ($1, $2)", [fingerprint, row.id]);
      await client.query("RELEASE SAVEPOINT inscription_tracking_candidate");
      return { row, code };
    } catch (error) {
      await client.query("ROLLBACK TO SAVEPOINT inscription_tracking_candidate");
      await client.query("RELEASE SAVEPOINT inscription_tracking_candidate");
      if (error.code !== "23505" || !["demande_inscription_reference_key", "inscription_code_suivi_pkey"].includes(error.constraint)) throw error;
    }
  }
  throw trackingError("TRACKING_GENERATION_FAILED");
}

export async function consumeTrackingQuota(subject, limit, client = database, now = Date.now()) {
  const window = Math.floor(now / 900000) * 900000;
  const result = await client.query(`INSERT INTO public.inscription_suivi_quota (cle, fenetre, nombre, expiration)
    VALUES ($1, $2, 1, $3)
    ON CONFLICT (cle, fenetre) DO UPDATE SET nombre = inscription_suivi_quota.nombre + 1
    WHERE inscription_suivi_quota.nombre < $4 RETURNING nombre`,
  [trackingDigest(`quota:${subject}`), new Date(window), new Date(window + 900000), limit]);
  if (!result.rows.length) throw trackingError("TRACKING_RATE_LIMIT", 429, Math.max(1, Math.ceil((window + 900000 - now) / 1000)));
  await client.query(`DELETE FROM public.inscription_suivi_quota WHERE (cle, fenetre) IN
    (SELECT cle, fenetre FROM public.inscription_suivi_quota WHERE expiration < now() ORDER BY expiration LIMIT 100)`);
}
