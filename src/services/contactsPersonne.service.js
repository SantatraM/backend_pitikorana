import database from "../config/db.js";
import ContactsPersonne from "../models/ContactsPersonne.js";

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

function personNotFoundError() {
  const error = new Error("Personne inexistante");
  error.code = "PERSONNE_NOT_FOUND";
  return error;
}

function contactAlreadyExistsError() {
  const error = new Error("Cette personne possède déjà une fiche de contact");
  error.code = "CONTACT_ALREADY_EXISTS";
  return error;
}

async function validatePersonne(idPersonne) {
  const result = await database.query(
    "SELECT id FROM personne WHERE id = $1",
    [idPersonne],
  );

  if (result.rows.length === 0) {
    throw personNotFoundError();
  }
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

export async function getContactPersonneById(id) {
  const result = await database.query(
    "SELECT * FROM contacts_personne WHERE id = $1",
    [id],
  );
  return result.rows[0] ? mapContactRow(result.rows[0]) : null;
}

export async function getContactByPersonne(idPersonne) {
  const result = await database.query(
    "SELECT * FROM contacts_personne WHERE id_personne = $1",
    [idPersonne],
  );
  return result.rows[0] ? mapContactRow(result.rows[0]) : null;
}

export async function createContactPersonne(contact) {
  await validatePersonne(contact.id_personne);
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

export async function updateContactPersonne(id, changes) {
  const existing = await getContactPersonneById(id);
  if (!existing) {
    return null;
  }

  const contact = mergeContact(existing, changes);
  if (contact.id_personne !== existing.id_personne) {
    await validatePersonne(contact.id_personne);
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

export async function deleteContactPersonne(id) {
  const contact = await getContactPersonneById(id);
  if (!contact) {
    return null;
  }

  await database.query("DELETE FROM contacts_personne WHERE id = $1", [id]);
  return contact;
}
