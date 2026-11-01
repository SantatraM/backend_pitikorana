import { randomUUID } from "node:crypto";
import database from "../config/db.js";
import { consumeInformationQuota, informationDigest, informationError, verifyInformationToken } from "./demandeInformationProtection.service.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ["NOUVELLE", "EN_COURS", "TRAITEE"];
export function assertInformationManager(auth) {
  if (!auth?.compte?.id) throw informationError("AUTH_REQUIRED", 401);
  if (!["ADMIN", "PASTEUR"].includes(auth.compte.role)) throw informationError("INFORMATION_FORBIDDEN", 403);
}
const object = (value) => value && typeof value === "object" && !Array.isArray(value);
function text(value, min, max) {
  if (typeof value !== "string") throw informationError("INFORMATION_INVALID");
  const result = value.normalize("NFC").trim();
  // Control characters are intentionally rejected in untrusted form input.
  // eslint-disable-next-line no-control-regex
  if (result.length < min || result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result)) throw informationError("INFORMATION_INVALID");
  return result;
}
export function normalizeInformationInput(body) {
  if (!object(body) || Object.keys(body).some(key => !["nom", "prenom", "contact", "message", "token", "website"].includes(key))) throw informationError("INFORMATION_INVALID");
  const nom = text(body.nom, 1, 100); const prenom = text(body.prenom, 1, 100);
  const contact = text(body.contact, 3, 255); const message = text(body.message, 10, 5000);
  if (/[\r\n]/.test(nom + prenom + contact)) throw informationError("INFORMATION_INVALID");
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
  const phone = /^\+?[\d ()\-.]+$/.test(contact) && contact.replace(/\D/g, "").length >= 7 && contact.replace(/\D/g, "").length <= 15;
  if (!email && !phone) throw informationError("INFORMATION_CONTACT_INVALID");
  if (body.website !== undefined && (typeof body.website !== "string" || body.website.length > 200)) throw informationError("INFORMATION_INVALID");
  return { nom, prenom, contact, message };
}

export async function createInformation(body, auth, key, client = database) {
  const input = normalizeInformationInput(body);
  if (typeof key !== "string" || !UUID.test(key)) throw informationError("INFORMATION_TOKEN_INVALID");
  verifyInformationToken(body.token, key, Date.now(), true);
  // The decoy never stores or echoes submitted personal information.
  if (body.website?.trim()) return { accepted: true };
  const account = auth?.compte?.id ?? null;
  const origin = account ? "MEMBRE" : "VISITEUR";
  const fingerprint = informationDigest(JSON.stringify([input, origin, account]));
  return client.transaction(async (tx = client) => {
    // The unique index serializes same-key inserts across instances. PostgreSQL
    // waits for an uncommitted conflicting row; no advisory/session lock is used.
    const inserted = await tx.query(`INSERT INTO demande_information
      (id, nom, prenom, contact, message, origine, id_compte_membre, cle_idempotence, empreinte_contenu)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (cle_idempotence) DO NOTHING RETURNING id`,
      [randomUUID(), input.nom, input.prenom, input.contact, input.message, origin, account, key, fingerprint]);
    if (!inserted.rows.length) {
      // A separate statement gets a new READ COMMITTED snapshot after a competing
      // insert commits. Combining these statements in one CTE could miss that row.
      const existing = await tx.query("SELECT empreinte_contenu FROM demande_information WHERE cle_idempotence = $1", [key]);
      if (!existing.rows[0]) throw informationError("INFORMATION_UNAVAILABLE", 503);
      if (existing.rows[0].empreinte_contenu !== fingerprint) throw informationError("INFORMATION_IDEMPOTENCY_CONFLICT", 409);
      return { accepted: true };
    }
    // An expired signed token may replay an existing row, but cannot commit a new
    // row. Any failure here or in the quotas rolls back the tentative insert.
    verifyInformationToken(body.token, key);
    // Throws on abuse; transaction rolls back both quotas and request together.
    const contactSubject = input.contact.includes("@") ? input.contact.toLowerCase() : input.contact.replace(/\D/g, "");
    await consumeInformationQuota("contact", contactSubject, 3, 3600, tx);
    if (account) await consumeInformationQuota("account", account, 5, 900, tx);
    return { accepted: true };
  });
}

function filters(query = {}) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  const recherche = query.recherche === undefined ? "" : text(query.recherche, 0, 100);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 || ![10,20,50].includes(limit)
    || (query.statut !== undefined && !STATUSES.includes(query.statut))) throw informationError("INFORMATION_INVALID");
  const params = []; const clauses = [];
  if (query.statut) { params.push(query.statut); clauses.push(`statut = $${params.length}`); }
  for (const word of recherche.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/\s+/).filter(Boolean)) {
    params.push(word.replace(/[\\%_]/g, "\\$&"));
    clauses.push(`lower(regexp_replace(normalize(concat_ws(' ', nom, prenom, contact), NFD), '[\u0300-\u036f]', '', 'g')) LIKE '%' || $${params.length} || '%' ESCAPE '\\'`);
  }
  return { page, limit, params, where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "" };
}
export async function listInformation(query, auth, client = database) {
  assertInformationManager(auth);
  const { page, limit, params, where } = filters(query);
  const total = await client.query(`SELECT count(*)::integer AS total FROM demande_information ${where}`, params);
  const rows = await client.query(`SELECT id, nom, prenom, contact, origine, statut, date_creation, date_modification, revision
    FROM demande_information ${where} ORDER BY date_creation DESC, id DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, (page - 1) * limit]);
  const count = total.rows[0].total;
  return { demandes: rows.rows, pagination: { page, limit, total: count, total_pages: Math.ceil(count / limit) } };
}
export async function informationStats(auth, client = database) {
  assertInformationManager(auth);
  const result = await client.query("SELECT count(*)::integer AS nouvelles FROM demande_information WHERE statut = 'NOUVELLE'");
  return result.rows[0];
}
export async function getInformation(id, auth, client = database) {
  assertInformationManager(auth);
  if (!UUID.test(id)) throw informationError("INFORMATION_INVALID");
  const result = await client.query(`SELECT id, nom, prenom, contact, message, origine, statut, date_creation, date_modification, revision
    FROM demande_information WHERE id = $1`, [id]);
  if (!result.rows[0]) throw informationError("INFORMATION_NOT_FOUND", 404);
  return result.rows[0];
}
export async function updateInformationStatus(id, body, auth, client = database) {
  assertInformationManager(auth);
  if (!UUID.test(id) || !object(body) || Object.keys(body).some(k => !["statut", "revision"].includes(k))
    || !STATUSES.includes(body.statut) || !Number.isSafeInteger(body.revision) || body.revision < 1) throw informationError("INFORMATION_INVALID");
  const result = await client.query(`UPDATE demande_information SET statut = $1, revision = revision + 1,
    date_modification = now(), id_compte_modificateur = $2 WHERE id = $3 AND revision = $4
    RETURNING id, nom, prenom, contact, message, origine, statut, date_creation, date_modification, revision`, [body.statut, auth.compte.id, id, body.revision]);
  if (!result.rows[0]) { await getInformation(id, auth, client); throw informationError("INFORMATION_REVISION_CONFLICT", 409); }
  return result.rows[0];
}
