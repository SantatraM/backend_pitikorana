import Langue from "./Langue.js";

export default class LienAvecFalimanjakaTraduction {
  constructor({ id = null, id_lien = null, id_langue, libelle, langue = null }) {
    this.id = id;
    this.id_lien = id_lien;
    this.id_langue = id_langue;
    this.libelle = libelle;
    this.langue = langue;
  }

  get id() {
    return this._id;
  }

  set id(valeur) {
    this._id = valeur;
  }

  get id_lien() {
    return this._id_lien;
  }

  set id_lien(valeur) {
    this._id_lien = valeur;
  }

  get id_langue() {
    return this._id_langue;
  }

  set id_langue(valeur) {
    if (!valeur || String(valeur).trim() === "") {
      throw new Error("La langue est obligatoire");
    }

    this._id_langue = valeur;
  }

  get libelle() {
    return this._libelle;
  }

  set libelle(valeur) {
    if (!valeur || valeur.trim() === "") {
      throw new Error("Le libellé est obligatoire");
    }

    if (valeur.trim().length > 100) {
      throw new Error("Le libellé ne doit pas dépasser 100 caractères");
    }

    this._libelle = valeur.trim();
  }

  get langue() {
    return this._langue;
  }

  set langue(valeur) {
    if (valeur === null) {
      this._langue = null;
      return;
    }

    if (valeur instanceof Langue) {
      this._langue = valeur;
      return;
    }

    this._langue = new Langue(valeur);
  }
}
