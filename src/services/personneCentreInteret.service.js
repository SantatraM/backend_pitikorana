import database from "../config/db.js";
import PersonneCentreInteret from "../models/PersonneCentreInteret.js";
import { assertCanManagePersonne } from "./personneAuthorization.service.js";

function error(message, code) { const e = new Error(message); e.code = code; return e; }
const map = (row) => new PersonneCentreInteret(row);
async function raw(id) { const r = await database.query("SELECT * FROM personne_centre_interet WHERE id = $1", [id]); return r.rows[0] ? map(r.rows[0]) : null; }
async function person(id) { const r = await database.query("SELECT id FROM personne WHERE id = $1", [id]); if (!r.rows[0]) throw error("Personne introuvable", "PERSONNE_NOT_FOUND"); }
async function centre(id) { const r = await database.query("SELECT id FROM centre_interet WHERE id = $1", [id]); if (!r.rows[0]) throw error("Centre d'intérêt introuvable", "CENTRE_NOT_FOUND"); }
async function unique(idPersonne, idCentre, excluded = null) {
  const r = excluded ? await database.query("SELECT id FROM personne_centre_interet WHERE id_personne = $1 AND id_centre_interet = $2 AND id <> $3", [idPersonne, idCentre, excluded]) : await database.query("SELECT id FROM personne_centre_interet WHERE id_personne = $1 AND id_centre_interet = $2", [idPersonne, idCentre]);
  if (r.rows[0]) throw error("Ce centre d'intérêt est déjà enregistré pour cette personne", "CENTRE_ALREADY_EXISTS");
}
export async function getAllPersonnesCentresInteret(lang = "fr") { const r = await database.query("SELECT * FROM v_centre_interet_personne WHERE code_langue = $1 ORDER BY id_personne ASC, centre_interet ASC", [lang]); return r.rows.map(map); }
export async function getPersonneCentreInteretById(id, lang = "fr") { const r = await database.query("SELECT * FROM v_centre_interet_personne WHERE id = $1 AND code_langue = $2", [id, lang]); return r.rows[0] ? map(r.rows[0]) : null; }
export async function getPersonnesCentresInteretByPersonne(idPersonne, lang = "fr") { await person(idPersonne); const r = await database.query("SELECT * FROM v_centre_interet_personne WHERE id_personne = $1 AND code_langue = $2 ORDER BY centre_interet ASC", [idPersonne, lang]); return r.rows.map(map); }
export async function createPersonneCentreInteret(a, lang = "fr", auth) { await assertCanManagePersonne(a.id_personne, auth); await centre(a.id_centre_interet); await unique(a.id_personne, a.id_centre_interet); const r = await database.query("INSERT INTO personne_centre_interet (id_personne, id_centre_interet) VALUES ($1, $2) RETURNING id", [a.id_personne, a.id_centre_interet]); return getPersonneCentreInteretById(r.rows[0].id, lang); }
export async function updatePersonneCentreInteret(id, changes, lang = "fr", auth) { const old = await raw(id); if (!old) return null; await assertCanManagePersonne(old.id_personne, auth); const a = new PersonneCentreInteret({ id, id_personne: old.id_personne, id_centre_interet: Object.hasOwn(changes, "id_centre_interet") ? changes.id_centre_interet : old.id_centre_interet }); await centre(a.id_centre_interet); await unique(old.id_personne, a.id_centre_interet, id); await database.query("UPDATE personne_centre_interet SET id_centre_interet = $1 WHERE id = $2", [a.id_centre_interet, id]); return getPersonneCentreInteretById(id, lang); }
export async function deletePersonneCentreInteret(id, auth) { const a = await raw(id); if (!a) return null; await assertCanManagePersonne(a.id_personne, auth); await database.query("DELETE FROM personne_centre_interet WHERE id = $1", [id]); return a; }
