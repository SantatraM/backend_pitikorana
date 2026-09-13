export default class Pays {
  constructor({ id = null, nom }) {
    this.id = id;
    this.nom = nom;
  }

  get id() {
    return this._id;
  }

  set id(valeur) {
    this._id = valeur;
  }

  get nom() {
    return this._nom;
  }

  set nom(valeur) {
    if (!valeur || valeur.trim() === "") {
      throw new Error("Le nom du pays est obligatoire");
    }

    if (valeur.trim().length > 100) {
      throw new Error("Le nom du pays ne doit pas dépasser 100 caractères");
    }

    this._nom = valeur.trim();
  }
}
