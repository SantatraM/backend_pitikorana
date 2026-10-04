import database from "../config/db.js";
import Personne from "../models/Personne.js";
import ContactsPersonne from "../models/ContactsPersonne.js";
import PersonneActivite from "../models/PersonneActivite.js";
import PersonneCompetence from "../models/PersonneCompetence.js";
import PersonneCentreInteret from "../models/PersonneCentreInteret.js";
import RelationPersonne from "../models/RelationPersonne.js";
import { createPersonne, updatePersonneInTransaction } from "./personne.service.js";
import { createContactPersonne } from "./contactsPersonne.service.js";
import { createPersonneActivite } from "./personneActivite.service.js";
import { createPersonneCompetence } from "./personneCompetence.service.js";
import { createPersonneCentreInteret } from "./personneCentreInteret.service.js";
import {
  createRelationPersonneInTransaction,
  reconcileFamilyInTransaction,
  synchronizePersonneRelationsInTransaction,
} from "./relationPersonne.service.js";
import { assertCanManagePersonne } from "./personneAuthorization.service.js";
import {
  CHAMPS_CONFIDENTIELS,
  normalizePreferencesConfidentialite,
  updatePreferencesConfidentialitePersonneInTransaction,
} from "./confidentialitePersonne.service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function completePayloadError(message) {
  const error = new Error(message);
  error.code = "PERSONNE_COMPLETE_INVALID";
  return error;
}

function list(value, label) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw completePayloadError(`${label} invalide`);
  return value;
}

function object(value, label, optional = false) {
  if (value == null && optional) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw completePayloadError(`${label} invalide`);
  }
  return value;
}

function uuid(value, label) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw completePayloadError(`${label} invalide`);
  }
  return value;
}

function uniqueCollection(items, idField, label) {
  const ids = new Set();

  for (const item of items) {
    const value = uuid(object(item, label)[idField], label);
    if (ids.has(value)) {
      throw completePayloadError(`${label} dupliqué`);
    }
    ids.add(value);
  }
}

function validateDraftCollections({
  contacts,
  relations,
  activites,
  competences,
  centresInteret,
}) {
  if (contacts.length > 1) {
    throw completePayloadError("Une seule fiche de contact est autorisée");
  }

  for (const contact of contacts) object(contact, "Contact");

  if (activites.length > 20) {
    throw completePayloadError("Maximum 20 activités autorisées");
  }

  uniqueCollection(activites, "id_activite", "Activité");
  uniqueCollection(competences, "id_competence", "Compétence");
  uniqueCollection(centresInteret, "id_centre_interet", "Centre d'intérêt");

  const relationsUniques = new Set();
  for (const relation of relations) {
    const item = object(relation, "Relation");
    const idPersonneLiee = uuid(item.id_personne_liee, "Personne liée");
    const idTypeRelation = uuid(item.id_type_relation, "Type de relation");
    const key = `${idPersonneLiee}:${idTypeRelation}`;
    if (relationsUniques.has(key)) {
      throw completePayloadError("Relation dupliquée");
    }
    relationsUniques.add(key);
  }
}

/**
 * Crée toutes les écritures PostgreSQL du draft dans le contexte transactionnel
 * courant. Les fichiers photo restent volontairement hors de ce contrat.
 */
export async function createPersonneComplete(body, lang = "fr", auth = null) {
  const payload = object(body, "Payload");
  const personne = new Personne(object(payload.personne, "Personne"));
  const contacts = list(payload.contacts, "Contacts");
  const relations = list(payload.relations, "Relations");
  const activites = list(payload.activites, "Activités");
  const competences = list(payload.competences, "Compétences");
  const centresInteret = list(payload.centres_interet, "Centres d'intérêt");
  const confidentialite =
    payload.confidentialite == null
      ? null
      : normalizePreferencesConfidentialite(payload.confidentialite);

  validateDraftCollections({
    contacts,
    relations,
    activites,
    competences,
    centresInteret,
  });

  return database.transaction(async () => {
    const created = await createPersonne(
      personne,
      lang,
      auth?.compte?.id ?? null,
      auth,
    );
    const idPersonne = created.id;

    for (const contact of contacts) {
      await createContactPersonne(
        new ContactsPersonne({ ...object(contact, "Contact"), id_personne: idPersonne }),
        auth,
      );
    }

    for (const relation of relations) {
      const item = object(relation, "Relation");
      await createRelationPersonneInTransaction(
        new RelationPersonne({
          id_personne_source: idPersonne,
          id_personne_cible: uuid(item.id_personne_liee, "Personne liée"),
          id_type_relation: uuid(item.id_type_relation, "Type de relation"),
        }),
        lang,
        auth,
        { reconcile: false },
      );
    }

    await reconcileFamilyInTransaction({
      personneIds: [
        idPersonne,
        ...relations.map((relation) => object(relation, "Relation").id_personne_liee),
      ],
      idCompteCreateur: auth.compte.id,
    });
    for (const activite of activites) {
      await createPersonneActivite(
        new PersonneActivite({ ...object(activite, "Activité"), id_personne: idPersonne }),
        lang,
        auth,
      );
    }

    for (const competence of competences) {
      await createPersonneCompetence(
        new PersonneCompetence({ ...object(competence, "Compétence"), id_personne: idPersonne }),
        lang,
        auth,
      );
    }

    for (const centreInteret of centresInteret) {
      await createPersonneCentreInteret(
        new PersonneCentreInteret({
          ...object(centreInteret, "Centre d'intérêt"),
          id_personne: idPersonne,
        }),
        lang,
        auth,
      );
    }

    if (confidentialite) {
      await updatePreferencesConfidentialitePersonneInTransaction(
        idPersonne,
        confidentialite,
        auth,
      );
    }

    return { id_personne: idPersonne, personne: created };
  });
}

function requiredList(payload, key, label) {
  if (!Object.prototype.hasOwnProperty.call(payload, key)) {
    throw completePayloadError(`${label} manquant`);
  }
  return list(payload[key], label);
}

function completePreferences(value) {
  const preferences = normalizePreferencesConfidentialite(value);
  const fields = new Set(preferences.map((preference) => preference.champ));
  if (preferences.length !== CHAMPS_CONFIDENTIELS.length || fields.size !== CHAMPS_CONFIDENTIELS.length || CHAMPS_CONFIDENTIELS.some((field) => !fields.has(field))) {
    throw completePayloadError("Les six préférences de confidentialité sont requises");
  }
  return preferences;
}

/**
 * Synchronise l'état complet d'une personne dans une transaction unique.
 * La photo est volontairement absente de ce contrat et reste gérée après le commit.
 */
export async function updatePersonneComplete(idPersonne, body, lang = "fr", auth = null) {
  uuid(idPersonne, "Identifiant");
  await assertCanManagePersonne(idPersonne, auth);
  const payload = object(body, "Payload");
  const personnePayload = object(payload.personne, "Personne");
  const contacts = requiredList(payload, "contacts", "Contacts");
  const relations = requiredList(payload, "relations", "Relations");
  const activites = requiredList(payload, "activites", "Activités");
  const competences = requiredList(payload, "competences", "Compétences");
  const centresInteret = requiredList(payload, "centres_interet", "Centres d'intérêt");
  if (!Object.prototype.hasOwnProperty.call(payload, "confidentialite")) {
    throw completePayloadError("Confidentialité manquante");
  }
  const confidentialite = completePreferences(payload.confidentialite);

  validateDraftCollections({ contacts, relations, activites, competences, centresInteret });

  return database.transaction(async () => {
    const personne = await updatePersonneInTransaction(idPersonne, personnePayload, auth);
    if (!personne) return null;

    await database.query("DELETE FROM contacts_personne WHERE id_personne = $1", [idPersonne]);
    for (const contact of contacts) {
      await createContactPersonne(
        new ContactsPersonne({ ...object(contact, "Contact"), id_personne: idPersonne }),
        auth,
      );
    }

    const relationPersonneIds = await synchronizePersonneRelationsInTransaction({
      idPersonne,
      relations: relations.map((relation) => {
        const item = object(relation, "Relation");
        const action = item.action == null ? null : item.action;
        if (action !== null && action !== "CONFIRMER_MANUELLE") {
          throw completePayloadError("Action de relation invalide");
        }
        return {
          id_personne_liee: uuid(item.id_personne_liee, "Personne liée"),
          id_type_relation: uuid(item.id_type_relation, "Type de relation"),
          action,
        };
      }),
      lang,
      auth,
    });

    await reconcileFamilyInTransaction({
      personneIds: relationPersonneIds,
      idCompteCreateur: auth.compte.id,
    });
    await database.query("DELETE FROM personne_activite WHERE id_personne = $1", [idPersonne]);
    for (const activite of activites) {
      await createPersonneActivite(
        new PersonneActivite({ ...object(activite, "Activité"), id_personne: idPersonne }),
        lang,
        auth,
      );
    }

    await database.query("DELETE FROM personne_competence WHERE id_personne = $1", [idPersonne]);
    for (const competence of competences) {
      await createPersonneCompetence(
        new PersonneCompetence({ ...object(competence, "Compétence"), id_personne: idPersonne }),
        lang,
        auth,
      );
    }

    await database.query("DELETE FROM personne_centre_interet WHERE id_personne = $1", [idPersonne]);
    for (const centreInteret of centresInteret) {
      await createPersonneCentreInteret(
        new PersonneCentreInteret({ ...object(centreInteret, "Centre d'intérêt"), id_personne: idPersonne }),
        lang,
        auth,
      );
    }

    await updatePreferencesConfidentialitePersonneInTransaction(idPersonne, confidentialite, auth);
    return { id_personne: idPersonne, personne };
  });
}