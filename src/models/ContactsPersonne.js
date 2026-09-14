function normalizeNullableString(value, fieldName, maxLength = null) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`Le champ ${fieldName} doit être une chaîne de caractères`);
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (maxLength !== null && normalized.length > maxLength) {
    throw new Error(
      `Le champ ${fieldName} ne doit pas dépasser ${maxLength} caractères`,
    );
  }

  return normalized;
}

export default class ContactsPersonne {
  constructor({
    id = null,
    id_personne,
    telephone = null,
    whatsapp = null,
    email = null,
    facebook = null,
    lien_facebook = null,
  }) {
    this.id = id;
    this.id_personne = id_personne;
    this.telephone = telephone;
    this.whatsapp = whatsapp;
    this.email = email;
    this.facebook = facebook;
    this.lien_facebook = lien_facebook;
  }

  // =========================
  // ID
  // =========================

  get id() {
    return this._id;
  }

  set id(value) {
    this._id = value;
  }

  // =========================
  // PERSONNE
  // =========================

  get id_personne() {
    return this._id_personne;
  }

  set id_personne(value) {
    if (!value || String(value).trim() === "") {
      throw new Error("La personne est obligatoire");
    }

    this._id_personne = value;
  }

  // =========================
  // TELEPHONE
  // =========================

  get telephone() {
    return this._telephone;
  }

  set telephone(value) {
    this._telephone = normalizeNullableString(value, "telephone", 30);
  }

  // =========================
  // WHATSAPP
  // =========================

  get whatsapp() {
    return this._whatsapp;
  }

  set whatsapp(value) {
    this._whatsapp = normalizeNullableString(value, "whatsapp", 30);
  }

  // =========================
  // EMAIL
  // =========================

  get email() {
    return this._email;
  }

  set email(value) {
    const email = normalizeNullableString(value, "email", 150);

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Le champ email est invalide");
    }

    this._email = email;
  }

  // =========================
  // FACEBOOK
  // =========================

  get facebook() {
    return this._facebook;
  }

  set facebook(value) {
    this._facebook = normalizeNullableString(value, "facebook", 150);
  }

  // =========================
  // LIEN FACEBOOK
  // =========================

  get lien_facebook() {
    return this._lien_facebook;
  }

  set lien_facebook(value) {
    this._lien_facebook = normalizeNullableString(value, "lien_facebook");
  }

  // =========================
  // SERIALISATION JSON
  // =========================

  toJSON() {
    return {
      id: this.id,
      id_personne: this.id_personne,
      telephone: this.telephone,
      whatsapp: this.whatsapp,
      email: this.email,
      facebook: this.facebook,
      lien_facebook: this.lien_facebook,
    };
  }
}
