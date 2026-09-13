export default class TypeElement {
  constructor({ id = null, libelle }) {
    this.id = id;
    this.libelle = libelle;
  }

  get id() {
    return this._id;
  }

  set id(valeur) {
    this._id = valeur;
  }

  get libelle() {
    return this._libelle;
  }

  set libelle(valeur) {
    if (!valeur || valeur.trim() === "") {
      throw new Error("Le libellé du type d'élément est obligatoire");
    }

    if (valeur.trim().length > 100) {
      throw new Error("Le libellé du type d'élément ne doit pas dépasser 100 caractères");
    }

    this._libelle = valeur.trim();
  }
}
