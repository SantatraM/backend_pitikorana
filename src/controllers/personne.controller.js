import Personne from "../models/Personne.js";
import * as s from "../services/personne.service.js";
import { getFoyerFormePreview, getPersistentFoyerByPersonne } from "../services/foyer.service.js";
import {
  getPreferencesConfidentialitePersonne,
  updatePreferencesConfidentialitePersonne,
} from "../services/confidentialitePersonne.service.js";
import { createPersonneComplete, updatePersonneComplete } from "../services/personneComplete.service.js";
const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (res) =>
  res.status(400).json({ success: false, message: "Identifiant invalide" });
const make = (b, old = {}) => new Personne({ ...old, ...b });
const SERVER_MANAGED_FIELDS = new Set([
  "id_compte_createur",
  "date_creation",
  "date_modification",
]);
const hasServerManagedField = (body) =>
  body &&
  typeof body === "object" &&
  !Array.isArray(body) &&
  Object.keys(body).some((field) => SERVER_MANAGED_FIELDS.has(field));
const err = (e, res) => {
  if (
    e.code === "PERSONNE_UPDATE_FORBIDDEN" ||
    e.code === "PERSONNE_MANAGEMENT_FORBIDDEN"
  ) {
    return res.status(403).json({ success: false, message: e.message });
  }
  console.error(e);
  return res
    .status(e.code === "FK" ? 400 : 400)
    .json({ success: false, message: e.code === "FK" ? e.message : e.message });
};
const confidentialityError = (e, res) => {
  if (e.code === "PERSONNE_NOT_FOUND") {
    return res.status(404).json({ success: false, message: e.message });
  }
  if (e.code === "PERSONNE_MANAGEMENT_FORBIDDEN") {
    return res.status(403).json({ success: false, message: e.message });
  }
  if (e.code === "CONFIDENTIALITE_INVALID") {
    return res.status(400).json({ success: false, message: e.message });
  }
  console.error(e);
  return res.status(500).json({ success: false, message: "Erreur serveur" });
};
export async function all(q, r) {
  try {
    const lang = q.query.lang || "fr";
    return r.json({ success: true, data: await s.getAllPersonnesForReader(lang, q.auth) });
  } catch (e) {
    console.error(e);
    return r.status(500).json({ success: false, message: "Erreur serveur" });
  }
}
export async function one(q, r) {
  if (!re.test(q.params.id)) return bad(r);
  try {
    const lang = q.query.lang || "fr";
    const p = await s.getPersonneByIdForReader(q.params.id, lang, q.auth);
    return p
      ? r.json({ success: true, data: p })
      : r.status(404).json({ success: false, message: "Personne introuvable" });
  } catch (e) {
    console.error(e);
    return r.status(500).json({ success: false, message: "Erreur serveur" });
  }
}
export async function profil(q, r) {
  if (!re.test(q.params.id)) return bad(r);
  try {
    const lang = q.query.lang || "fr";
    const profilPersonne = await s.getProfilPersonneForReader(
      q.params.id,
      lang,
      q.auth,
    );
    return profilPersonne
      ? r.json({ success: true, data: profilPersonne })
      : r.status(404).json({ success: false, message: "Personne introuvable" });
  } catch (e) {
    console.error(e);
    return r.status(500).json({ success: false, message: "Erreur serveur" });
  }
}
export async function ascendants(q, r) {
  if (!re.test(q.params.id)) return bad(r);
  try {
    const arbre = await s.getAscendantsPersonne(q.params.id);
    return arbre
      ? r.json({ success: true, data: arbre })
      : r.status(404).json({ success: false, message: "Personne introuvable" });
  } catch (e) {
    console.error(e);
    return r.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function genealogicalDescendants(q, r) {
  if (!re.test(q.params.id)) return bad(r);
  try {
    const arbre = await s.getDescendantsPersonne(q.params.id);
    return arbre
      ? r.json({ success: true, data: arbre })
      : r.status(404).json({ success: false, message: "Personne introuvable" });
  } catch (e) {
    console.error(e);
    return r.status(500).json({ success: false, message: "Erreur serveur" });
  }
}
export async function fratrie(q, r) {
  if (!re.test(q.params.id)) return bad(r);
  try {
    const resultat = await s.getFratriePersonne(q.params.id);
    return resultat
      ? r.json({ success: true, data: resultat })
      : r.status(404).json({ success: false, message: "Personne introuvable" });
  } catch (e) {
    console.error(e);
    return r.status(500).json({ success: false, message: "Erreur serveur" });
  }
}
export async function conjoints(q, r) {
  if (!re.test(q.params.id)) return bad(r);
  try {
    const resultat = await s.getConjointsPersonne(q.params.id);
    return resultat
      ? r.json({ success: true, data: resultat })
      : r.status(404).json({ success: false, message: "Personne introuvable" });
  } catch (e) {
    console.error(e);
    return r.status(500).json({ success: false, message: "Erreur serveur" });
  }
}
export async function famille(q, r) {
  if (!re.test(q.params.id)) return bad(r);
  try {
    const resultat = await s.getFamillePersonne(q.params.id);
    return resultat
      ? r.json({ success: true, data: resultat })
      : r.status(404).json({ success: false, message: "Personne introuvable" });
  } catch (e) {
    console.error(e);
    return r.status(500).json({ success: false, message: "Erreur serveur" });
  }
}
export async function foyer(q, r) {
  if (!re.test(q.params.id)) return bad(r);
  try {
    const resultat = await s.getFoyerPersonne(q.params.id);
    return resultat
      ? r.json({ success: true, data: resultat })
      : r.status(404).json({ success: false, message: "Personne introuvable" });
  } catch (e) {
    if (["FOYER_PARENT_CONFLICT", "FOYER_CONJOINT_CONFLICT"].includes(e.code)) {
      return r.status(409).json({ success: false, message: e.message });
    }
    console.error(e);
    return r.status(500).json({ success: false, message: "Erreur serveur" });
  }
}
export async function foyerFormePreview(q, r) {
  if (!re.test(q.params.id)) return bad(r);
  try {
    const resultat = await getFoyerFormePreview(q.params.id);
    return r.json({
      success: true,
      data: resultat,
      message: resultat ? undefined : "Aucun foyer formé résoluble pour cette personne.",
    });
  } catch (e) {
    if (e.code === "FOYER_PERSONNE_INVALID" || e.code === "FOYER_PERSONNE_NOT_FOUND") {
      return r.status(404).json({ success: false, message: e.message });
    }
    if (e.code === "FOYER_CONJOINT_CONFLICT") {
      return r.status(409).json({ success: false, message: e.message });
    }
    console.error(e);
    return r.status(500).json({ success: false, message: "Erreur serveur" });
  }
}
export async function foyerPersistant(q, r) {
  if (!re.test(q.params.id)) return bad(r);
  try {
    const resultat = await getPersistentFoyerByPersonne(q.params.id);
    return r.json({
      success: true,
      data: resultat,
      message: resultat ? undefined : "Aucun foyer enregistré pour cette personne.",
    });
  } catch (e) {
    if (e.code === "FOYER_PERSONNE_NOT_FOUND") {
      return r.status(404).json({ success: false, message: e.message });
    }
    if (e.code === "FOYER_PERSISTENT_AMBIGUOUS") {
      return r.status(409).json({ success: false, message: e.message });
    }
    console.error(e);
    return r.status(500).json({ success: false, message: "Erreur serveur" });
  }
}
export async function element(q, r) {
  if (!re.test(q.params.id_element)) return bad(r);
  try {
    const lang = q.query.lang || "fr";
    return r.json({
      success: true,
      data: await s.getPersonnesByElementForReader(
        q.params.id_element,
        lang,
        q.auth,
      ),
    });
  } catch (e) {
    console.error(e);
    return r.status(500).json({ success: false, message: "Erreur serveur" });
  }
}
export async function descendants(q, r) {
  if (!re.test(q.params.id_element)) return bad(r);
  try {
    const lang = q.query.lang || "fr";
    return r.json({
      success: true,
      data: await s.getPersonnesByElementDescendantsForReader(
        q.params.id_element,
        lang,
        q.auth,
      ),
    });
  } catch (e) {
    console.error(e);
    return r.status(500).json({ success: false, message: "Erreur serveur" });
  }
}
export async function getConfidentialite(q, r) {
  if (!re.test(q.params.id)) return bad(r);
  try {
    return r.json({
      success: true,
      data: await getPreferencesConfidentialitePersonne(q.params.id, q.auth),
    });
  } catch (e) {
    return confidentialityError(e, r);
  }
}
export async function updateConfidentialite(q, r) {
  if (!re.test(q.params.id)) return bad(r);
  try {
    return r.json({
      success: true,
      data: await updatePreferencesConfidentialitePersonne(
        q.params.id,
        q.body,
        q.auth,
      ),
    });
  } catch (e) {
    return confidentialityError(e, r);
  }
}
export async function add(q, r) {
  if (hasServerManagedField(q.body)) {
    return r.status(400).json({
      success: false,
      message: "Ces champs sont gérés par le serveur",
    });
  }
  try {
    const lang = q.query.lang || "fr";
    return r.status(201).json({
      success: true,
      message: "Personne créée avec succès",
      data: await s.createPersonne(
        make(q.body),
        lang,
        q.auth.compte.id,
        q.auth,
      ),
    });
  } catch (e) {
    return err(e, r);
  }
}
export async function addComplete(q, r) {
  try {
    const lang = q.query.lang || "fr";
    const result = await createPersonneComplete(q.body, lang, q.auth);
    return r.status(201).json({
      success: true,
      message: "Personne créée avec succès",
      data: result,
    });
  } catch (e) {
    return err(e, r);
  }
}
export async function editComplete(q, r) {
  if (!re.test(q.params.id)) return bad(r);
  if (hasServerManagedField(q.body?.personne)) {
    return r.status(400).json({
      success: false,
      message: "Ces champs sont gérés par le serveur",
    });
  }
  try {
    const lang = q.query.lang || "fr";
    const result = await updatePersonneComplete(q.params.id, q.body, lang, q.auth);
    return result
      ? r.json({ success: true, message: "Personne modifiée avec succès", data: result })
      : r.status(404).json({ success: false, message: "Personne introuvable" });
  } catch (e) {
    return err(e, r);
  }
}
export async function edit(q, r) {
  if (!re.test(q.params.id)) return bad(r);
  if (hasServerManagedField(q.body)) {
    return r.status(400).json({
      success: false,
      message: "Ces champs sont gérés par le serveur",
    });
  }
  try {
    const lang = q.query.lang || "fr";
    const personne = await s.updatePersonne(q.params.id, q.body, lang, q.auth);
    if (!personne)
      return r.status(404).json({
        success: false,
        message: "Personne introuvable",
      });
    return r.json({
      success: true,
      message: "Personne modifiée avec succès",
      data: personne,
    });
  } catch (e) {
    return err(e, r);
  }
}
export async function remove(q, r) {
  if (!re.test(q.params.id)) return bad(r);
  try {
    const p = await s.deletePersonne(q.params.id);
    return p
      ? r.json({
          success: true,
          message: "Personne supprimée avec succès",
          data: p,
        })
      : r.status(404).json({ success: false, message: "Personne introuvable" });
  } catch (e) {
    console.error(e);
    return r.status(409).json({
      success: false,
      message: "Impossible de supprimer cette personne",
    });
  }
}
