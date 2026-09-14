import Langue from "./Langue.js";

export default class StatutTraduction {
  constructor({
    id = null,
    id_statut = null,
    id_langue,
    libelle,
    langue = null,
  }) {
    this.id = id;
    this.id_statut = id_statut;
    this.id_langue = id_langue;
    this.libelle = libelle;
    this.langue = langue;
  }
  get id() {
    return this._id;
  }
  set id(value) {
    this._id = value;
  }
  get id_statut() {
    return this._id_statut;
  }
  set id_statut(value) {
    this._id_statut = value;
  }
  get id_langue() {
    return this._id_langue;
  }
  set id_langue(value) {
    if (!value) throw new Error("La langue est obligatoire");
    this._id_langue = value;
  }
  get libelle() {
    return this._libelle;
  }
  set libelle(value) {
    if (!value || value.trim() === "")
      throw new Error("Le libellé est obligatoire");
    if (value.trim().length > 100)
      throw new Error("Le libellé ne doit pas dépasser 100 caractères");
    this._libelle = value.trim();
  }
  get langue() {
    return this._langue;
  }
  set langue(value) {
    this._langue =
      value === null
        ? null
        : value instanceof Langue
          ? value
          : new Langue(value);
  }
}
