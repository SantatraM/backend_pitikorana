import Personne from "../models/Personne.js";
import * as s from "../services/personne.service.js";
const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (res) =>
  res.status(400).json({ success: false, message: "Identifiant invalide" });
const make = (b, old = {}) => new Personne({ ...old, ...b });
const err = (e, res) => {
  console.error(e);
  return res
    .status(e.code === "FK" ? 400 : 400)
    .json({ success: false, message: e.code === "FK" ? e.message : e.message });
};
export async function all(q, r) {
  try {
    const lang = q.query.lang || "fr";
    return r.json({ success: true, data: await s.getAllPersonnes(lang) });
  } catch (e) {
    console.error(e);
    return r.status(500).json({ success: false, message: "Erreur serveur" });
  }
}
export async function one(q, r) {
  if (!re.test(q.params.id)) return bad(r);
  try {
    const lang = q.query.lang || "fr";
    const p = await s.getPersonneById(q.params.id, lang);
    return p
      ? r.json({ success: true, data: p })
      : r.status(404).json({ success: false, message: "Personne introuvable" });
  } catch (e) {
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
      data: await s.getPersonnesByElement(q.params.id_element, lang),
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
      data: await s.getPersonnesByElementDescendants(q.params.id_element, lang),
    });
  } catch (e) {
    console.error(e);
    return r.status(500).json({ success: false, message: "Erreur serveur" });
  }
}
export async function add(q, r) {
  try {
    const lang = q.query.lang || "fr";
    return r.status(201).json({
      success: true,
      message: "Personne créée avec succès",
      data: await s.createPersonne(make(q.body), lang),
    });
  } catch (e) {
    return err(e, r);
  }
}
export async function edit(q, r) {
  if (!re.test(q.params.id)) return bad(r);
  try {
    const lang = q.query.lang || "fr";
    const personne = await s.updatePersonne(q.params.id, q.body, lang);
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
