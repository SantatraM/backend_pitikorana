import database from "../config/db.js";
import Utilisateur from "../models/Utilisateur.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_ROLE_CODES = new Set(["ADMIN", "PASTEUR", "MEMBRE", "BUREAU_ZANAKA_AMPIELEZANA"]);
const ALLOWED_STATUT_CODES = new Set(["ACTIF", "SUSPENDU"]);

function businessError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeUuid(value) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value.trim())) throw businessError("Identifiant utilisateur invalide.", "UTILISATEUR_INVALID");
  return value.trim();
}

function mapUtilisateur(row) {
  return new Utilisateur({
    id: row.id,
    personne: { id: row.id_personne, nom: row.nom, prenom: row.prenom, nom_usage: row.nom_usage },
    contact: { email: row.email ?? null, telephone: row.telephone ?? null },
    role: { id: row.id_role, code: row.role_code },
    statut: { id: row.id_statut_compte, code: row.statut_code },
  });
}

const utilisateurSelect = [
  "SELECT cm.id, cm.id_personne, cm.id_role, cm.id_statut_compte,",
  "p.nom, p.prenom, p.nom_usage, cp.email, cp.telephone,",
  "r.code AS role_code, scm.code AS statut_code",
  "FROM compte_membre cm",
  "JOIN personne p ON p.id = cm.id_personne",
  "JOIN role r ON r.id = cm.id_role",
  "JOIN statut_compte_membre scm ON scm.id = cm.id_statut_compte",
  "LEFT JOIN contacts_personne cp ON cp.id_personne = p.id",
].join(" ");

async function getUtilisateur(id) {
  const result = await database.query(utilisateurSelect + " WHERE cm.id = $1", [id]);
  return result.rows[0] ? mapUtilisateur(result.rows[0]) : null;
}

async function assertOtherAccount(id, idCompteActeur) {
  if (id === idCompteActeur) throw businessError("Vous ne pouvez pas modifier votre propre compte.", "UTILISATEUR_SELF_CHANGE_FORBIDDEN");
  const utilisateur = await getUtilisateur(id);
  if (!utilisateur) throw businessError("Utilisateur introuvable.", "UTILISATEUR_NOT_FOUND");
  return utilisateur;
}

export async function getUtilisateurs() {
  const result = await database.query(utilisateurSelect + " ORDER BY p.nom ASC, p.prenom ASC NULLS LAST, cm.id ASC");
  return result.rows.map(mapUtilisateur);
}

export async function changeUtilisateurRole(idUtilisateur, codeRole, idCompteActeur) {
  const id = normalizeUuid(idUtilisateur);
  const actor = normalizeUuid(idCompteActeur);
  const code = typeof codeRole === "string" ? codeRole.trim().toUpperCase() : "";
  if (!ALLOWED_ROLE_CODES.has(code)) throw businessError("Rôle invalide.", "UTILISATEUR_ROLE_INVALID");
  return database.transaction(async () => {
    await assertOtherAccount(id, actor);
    const role = await database.query("SELECT id FROM role WHERE code = $1", [code]);
    if (!role.rows[0]) throw businessError("Rôle introuvable.", "UTILISATEUR_ROLE_NOT_FOUND");
    await database.query("UPDATE compte_membre SET id_role = $1 WHERE id = $2", [role.rows[0].id, id]);
    return getUtilisateur(id);
  });
}

export async function changeUtilisateurStatut(idUtilisateur, codeStatut, idCompteActeur) {
  const id = normalizeUuid(idUtilisateur);
  const actor = normalizeUuid(idCompteActeur);
  const code = typeof codeStatut === "string" ? codeStatut.trim().toUpperCase() : "";
  if (!ALLOWED_STATUT_CODES.has(code)) throw businessError("Statut invalide.", "UTILISATEUR_STATUT_INVALID");
  return database.transaction(async () => {
    await assertOtherAccount(id, actor);
    const statut = await database.query("SELECT id FROM statut_compte_membre WHERE code = $1", [code]);
    if (!statut.rows[0]) throw businessError("Statut introuvable.", "UTILISATEUR_STATUT_NOT_FOUND");
    await database.query("UPDATE compte_membre SET id_statut_compte = $1 WHERE id = $2", [statut.rows[0].id, id]);
    return getUtilisateur(id);
  });
}