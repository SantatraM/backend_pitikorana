import RelationPersonne from "../models/RelationPersonne.js";
import {
  createRelationPersonne,
  deleteRelationPersonne,
  getAllRelationsPersonne,
  getRelationPersonneById,
  getRelationsPersonneByPersonne as getRelationsByPersonneService,
  updateRelationPersonneType,
} from "../services/relationPersonne.service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function invalidId(res) {
  return res
    .status(400)
    .json({ success: false, message: "Identifiant invalide" });
}

function handleWriteError(error, res) {
  console.error(error);

  if (["PERSONNE_NOT_FOUND", "TYPE_RELATION_NOT_FOUND"].includes(error.code)) {
    return res.status(404).json({ success: false, message: error.message });
  }

  if (["RELATION_EXISTS", "23505"].includes(error.code)) {
    return res.status(409).json({
      success: false,
      message: "Une relation familiale existe déjà entre ces deux personnes",
    });
  }

  if (["SELF_RELATION", "INVERSE_SEXE_UNSUPPORTED", "INVERSE_NOT_CONFIGURED"].includes(error.code)) {
    return res.status(400).json({ success: false, message: error.message });
  }

  if (error.code) {
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }

  return res.status(400).json({ success: false, message: error.message });
}

export async function getRelationsPersonne(req, res) {
  try {
    const lang = req.query.lang || "fr";
    return res.json({ success: true, data: await getAllRelationsPersonne(lang) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function getRelationsPersonneByPersonne(req, res) {
  if (!isUuid(req.params.id_personne)) return invalidId(res);

  try {
    const lang = req.query.lang || "fr";
    return res.json({
      success: true,
      data: await getRelationsByPersonneService(req.params.id_personne, lang),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function getRelationPersonne(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);

  try {
    const lang = req.query.lang || "fr";
    const relation = await getRelationPersonneById(req.params.id, lang);
    if (!relation) {
      return res
        .status(404)
        .json({ success: false, message: "Relation introuvable" });
    }
    return res.json({ success: true, data: relation });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function addRelationPersonne(req, res) {
  try {
    const {
      id_personne_source,
      id_personne_cible,
      id_type_relation,
    } = req.body;

    if (
      !isUuid(id_personne_source) ||
      !isUuid(id_personne_cible) ||
      !isUuid(id_type_relation)
    )
      return invalidId(res);

    const lang = req.query.lang || "fr";
    const relation = await createRelationPersonne(
      new RelationPersonne({
        id_personne_source,
        id_personne_cible,
        id_type_relation,
      }),
      lang,
    );

    return res.status(201).json({
      success: true,
      message: "Relation créée avec succès",
      data: relation,
    });
  } catch (error) {
    return handleWriteError(error, res);
  }
}

export async function removeRelationPersonne(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);

  try {
    const relation = await deleteRelationPersonne(req.params.id);
    if (!relation) {
      return res
        .status(404)
        .json({ success: false, message: "Relation introuvable" });
    }
    return res.json({
      success: true,
      message: "Relation supprimée avec succès",
      data: relation,
    });
  } catch (error) {
    return handleWriteError(error, res);
  }
}

export async function editRelationPersonne(req, res) {
  if (!isUuid(req.params.id)) return invalidId(res);
  if (!isUuid(req.body.id_type_relation)) return invalidId(res);

  try {
    const lang = req.query.lang || "fr";
    const relation = await updateRelationPersonneType(
      req.params.id,
      req.body.id_type_relation,
      lang,
    );

    if (!relation) {
      return res
        .status(404)
        .json({ success: false, message: "Relation introuvable" });
    }

    return res.json({
      success: true,
      message: "Relation modifiée avec succès",
      data: relation,
    });
  } catch (error) {
    return handleWriteError(error, res);
  }
}
