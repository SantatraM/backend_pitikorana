export default class Langue {
  constructor({ id = null, code, nom }) {
    this.id = id;
    this.code = code;
    this.nom = nom;
  }
  get id() {
    return this._id;
  }

  set id(valeur) {
    this._id = valeur;
  }

  get code() {
    return this._code;
  }

  set code(valeur) {
    if (!valeur || valeur.trim() === "") {
      throw new Error("Le code du langue est obligatoire");
    }
    this._code = valeur.trim();
  }

  get nom() {
    return this._nom;
  }

  set nom(valeur) {
    if (!valeur || valeur.trim() === "") {
      throw new Error("Le nom du langue est obligatoire");
    }
    this._nom = valeur.trim();
  }
}
