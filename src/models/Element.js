import TypeElement from "./TypeElement.js";

function normalizeNullableString(value, fieldName, maxLength) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`Le champ ${fieldName} doit être une chaîne de caractères`);
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    return null;
  }

  if (normalized.length > maxLength) {
    throw new Error(
      `Le champ ${fieldName} ne doit pas dépasser ${maxLength} caractères`,
    );
  }

  return normalized;
}

export default class Element {
  constructor({
    id = null,
    id_type_element,
    nom,
    autres_appellations = null,
    id_sexe = null,
    nom_conjoint = null,
    ville_origine_conjoint = null,
    rattachement_sup = null,
    etat = 0,
    type_element = null,
    sexe = null,
    parent = null,
  }) {
    this.id = id;
    this.id_type_element = id_type_element;
    this.nom = nom;
    this.autres_appellations = autres_appellations;
    this.id_sexe = id_sexe;
    this.nom_conjoint = nom_conjoint;
    this.ville_origine_conjoint = ville_origine_conjoint;
    this.rattachement_sup = rattachement_sup;
    this.etat = etat;
    this.type_element = type_element;
    this.sexe = sexe;
    this.parent = parent;
  }

  get id() {
    return this._id;
  }
  set id(valeur) {
    this._id = valeur;
  }

  get id_type_element() {
    return this._id_type_element;
  }
  set id_type_element(valeur) {
    if (!valeur || String(valeur).trim() === "") {
      throw new Error("Le type d'élément est obligatoire");
    }
    this._id_type_element = valeur;
  }

  get nom() {
    return this._nom;
  }
  set nom(valeur) {
    if (!valeur || valeur.trim() === "") {
      throw new Error("Le nom de l'élément est obligatoire");
    }
    if (valeur.trim().length > 100) {
      throw new Error(
        "Le nom de l'élément ne doit pas dépasser 100 caractères",
      );
    }
    this._nom = valeur.trim();
  }

  get autres_appellations() {
    return this._autres_appellations;
  }
  set autres_appellations(valeur) {
    this._autres_appellations = normalizeNullableString(
      valeur,
      "autres_appellations",
      255,
    );
  }

  get id_sexe() {
    return this._id_sexe;
  }
  set id_sexe(valeur) {
    this._id_sexe = valeur || null;
  }

  get nom_conjoint() {
    return this._nom_conjoint;
  }
  set nom_conjoint(valeur) {
    this._nom_conjoint = normalizeNullableString(valeur, "nom_conjoint", 100);
  }

  get ville_origine_conjoint() {
    return this._ville_origine_conjoint;
  }
  set ville_origine_conjoint(valeur) {
    this._ville_origine_conjoint = normalizeNullableString(
      valeur,
      "ville_origine_conjoint",
      150,
    );
  }

  get rattachement_sup() {
    return this._rattachement_sup;
  }
  set rattachement_sup(valeur) {
    this._rattachement_sup = valeur || null;
  }

  get etat() {
    return this._etat;
  }
  set etat(valeur) {
    if (valeur === null || valeur === undefined || valeur === "") {
      throw new Error("L'état doit être égal à 0, 1 ou 2");
    }
    const normalized = Number(valeur);
    if (!Number.isInteger(normalized) || ![0, 1, 2].includes(normalized)) {
      throw new Error("L'état doit être égal à 0, 1 ou 2");
    }
    this._etat = normalized;
  }

  get type_element() {
    return this._type_element;
  }
  set type_element(valeur) {
    if (valeur === null) {
      this._type_element = null;
      return;
    }
    this._type_element =
      valeur instanceof TypeElement ? valeur : new TypeElement(valeur);
  }

  get sexe() {
    return this._sexe;
  }
  set sexe(valeur) {
    this._sexe = valeur || null;
  }

  get parent() {
    return this._parent;
  }
  set parent(valeur) {
    this._parent = valeur || null;
  }
}
