import database from "../config/db.js";
import ContactsPersonne from "../models/ContactsPersonne.js";
import { assertCanManagePersonne } from "./personneAuthorization.service.js";
import {
  filterContactConfidentiel,
  filterContactsConfidentiels,
  getConfidentialitesByPersonnes,
} from "./confidentialitePersonne.service.js";

const contactFields = [
  "id_personne",
  "telephone",
  "whatsapp",
  "email",
  "facebook",
  "lien_facebook",
];

function mapContactRow(row) {
  return new ContactsPersonne({
    id: row.id,
    id_personne: row.id_personne,
    telephone: row.telephone,
    whatsapp: row.whatsapp,
    email: row.email,
    facebook: row.facebook,
    lien_facebook: row.lien_facebook,
  });
}

function contactAlreadyExistsError() {
  const error = new Error("Cette personne possède déjà une fiche de contact");
  error.code = "CONTACT_ALREADY_EXISTS";
  return error;
}

async function validateUniqueContact(idPersonne, excludedContactId = null) {
  const result = excludedContactId
    ? await database.query(
        "SELECT id FROM contacts_personne WHERE id_personne = $1 AND id <> $2",
        [idPersonne, excludedContactId],
      )
    : await database.query(
        "SELECT id FROM contacts_personne WHERE id_personne = $1",
        [idPersonne],
      );

  if (result.rows.length > 0) {
    throw contactAlreadyExistsError();
  }
}

function mergeContact(existing, changes) {
  const data = { id: existing.id };

  for (const field of contactFields) {
    data[field] = Object.prototype.hasOwnProperty.call(changes, field)
      ? changes[field]
      : existing[field];
  }

  return new ContactsPersonne(data);
}

export async function getAllContactsPersonne() {
  const result = await database.query(
    "SELECT * FROM contacts_personne ORDER BY id",
  );
  return result.rows.map(mapContactRow);
}

async function filterContactForReader(contact, auth) {
  if (!contact) return contact;

  const configurations = await getConfidentialitesByPersonnes([
    contact.id_personne,
  ]);
  return filterContactConfidentiel(
    contact,
    configurations[contact.id_personne],
    auth,
  );
}

export async function getAllContactsPersonneForReader(auth = null) {
  return filterContactsConfidentiels(await getAllContactsPersonne(), auth);
}

export async function getContactPersonneById(id) {
  const result = await database.query(
    "SELECT * FROM contacts_personne WHERE id = $1",
    [id],
  );
  return result.rows[0] ? mapContactRow(result.rows[0]) : null;
}

export async function getContactPersonneByIdForReader(id, auth = null) {
  return filterContactForReader(await getContactPersonneById(id), auth);
}

export async function getContactByPersonne(idPersonne) {
  const result = await database.query(
    "SELECT * FROM contacts_personne WHERE id_personne = $1",
    [idPersonne],
  );
  return result.rows[0] ? mapContactRow(result.rows[0]) : null;
}

export async function getContactByPersonneForReader(idPersonne, auth = null) {
  return filterContactForReader(await getContactByPersonne(idPersonne), auth);
}

export async function createContactPersonne(contact, auth) {
  await assertCanManagePersonne(contact.id_personne, auth);
  await validateUniqueContact(contact.id_personne);

  const result = await database.query(
    `INSERT INTO contacts_personne (
      id_personne,
      telephone,
      whatsapp,
      email,
      facebook,
      lien_facebook
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    contactFields.map((field) => contact[field]),
  );

  return mapContactRow(result.rows[0]);
}

export async function updateContactPersonne(id, changes, auth) {
  const existing = await getContactPersonneById(id);
  if (!existing) {
    return null;
  }

  await assertCanManagePersonne(existing.id_personne, auth);

  const contact = mergeContact(existing, changes);
  if (contact.id_personne !== existing.id_personne) {
    await assertCanManagePersonne(contact.id_personne, auth);
    await validateUniqueContact(contact.id_personne, id);
  }

  const result = await database.query(
    `UPDATE contacts_personne
    SET
      id_personne = $1,
      telephone = $2,
      whatsapp = $3,
      email = $4,
      facebook = $5,
      lien_facebook = $6
    WHERE id = $7
    RETURNING *`,
    [...contactFields.map((field) => contact[field]), id],
  );

  return mapContactRow(result.rows[0]);
}

export async function deleteContactPersonne(id, auth) {
  const contact = await getContactPersonneById(id);
  if (!contact) {
    return null;
  }

  await assertCanManagePersonne(contact.id_personne, auth);

  await database.query("DELETE FROM contacts_personne WHERE id = $1", [id]);
  return contact;
}
