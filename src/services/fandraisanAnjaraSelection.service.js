import database from "../config/db.js";

const TYPES = new Set(["RAZAMBE", "TARANAKA", "SAMPANA", "FOYER", "PERSONNE"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMIT = 20;

export function normalizeContributorSearch(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/œ/g, "oe").replace(/æ/g, "ae").trim();
}

// PostgreSQL UTF-8 normalization: no extension or schema change required.
const searchable = (expression) => `replace(replace(lower(regexp_replace(normalize(${expression}, NFD), '[\u0300-\u036f]', '', 'g')), 'œ', 'oe'), 'æ', 'ae')`;

export async function listContributorSelection(query = {}, client = database) {
  const type = query.type;
  const page = query.page === undefined ? 1 : Number(query.page);
  const recherche = query.recherche === undefined ? "" : query.recherche;
  if (!TYPES.has(type) || !Number.isSafeInteger(page) || page < 1 || page > 1000000
    || typeof recherche !== "string" || recherche.length > 100
    || (query.id !== undefined && (typeof query.id !== "string" || !UUID.test(query.id)))) {
    const error = new Error("Paramètres de recherche de contributeur invalides.");
    error.code = "FANDRAISAN_ANJARA_INVALID";
    throw error;
  }
  let source;
  const params = [];
  if (type === "PERSONNE") {
    source = `SELECT p.id, concat_ws(' ', p.nom, p.prenom) AS libelle FROM personne p`;
  } else if (type === "FOYER") {
    source = `SELECT f.id,
      concat_ws(' / ', concat_ws(' ', p1.nom, p1.prenom),
        CASE WHEN p2.id IS NOT NULL THEN concat_ws(' ', p2.nom, p2.prenom) END) AS libelle
      FROM foyer f JOIN personne p1 ON p1.id = f.id_personne_1
      LEFT JOIN personne p2 ON p2.id = f.id_personne_2
      WHERE f.statut = 'ACTIF' AND f.type_foyer IN ('COUPLE', 'MONOPARENTAL')
        AND (f.type_foyer = 'MONOPARENTAL' OR p2.id IS NOT NULL)`;
  } else {
    params.push(type);
    source = `SELECT e.id, e.nom AS libelle FROM element e
      JOIN type_element te ON te.id = e.id_type_element WHERE te.code = $1`;
  }
  const conditions = [];
  if (query.id) {
    params.push(query.id);
    conditions.push(`id = $${params.length}::uuid`);
  }
  // Every word must match, regardless of surname / first name order.
  for (const token of normalizeContributorSearch(recherche).split(/\s+/).filter(Boolean)) {
    params.push(token.replace(/[\\%_]/g, "\\$&"));
    conditions.push(`${searchable("libelle")} LIKE '%' || $${params.length} || '%' ESCAPE '\\'`);
  }
  params.push(LIMIT + 1, (page - 1) * LIMIT);
  const result = await client.query(`SELECT id, libelle FROM (${source}) candidates
    ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
    ORDER BY ${searchable("libelle")}, id
    LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  return {
    contributeurs: result.rows.slice(0, LIMIT),
    pagination: { page, limit: LIMIT, has_more: result.rows.length > LIMIT },
  };
}
