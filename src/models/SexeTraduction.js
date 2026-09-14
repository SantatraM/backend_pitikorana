import Langue from "./Langue.js";

export default class SexeTraduction {
  constructor({
    id = null,
    id_sexe = null,
    id_langue,
    libelle,
    langue = null,
  }) {
    this.id = id;
    this.id_sexe = id_sexe;
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
  get id_sexe() {
    return this._id_sexe;
  }
  set id_sexe(value) {
    this._id_sexe = value;
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
    if (value.trim().length > 50)
      throw new Error("Le libellé ne doit pas dépasser 50 caractères");
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
