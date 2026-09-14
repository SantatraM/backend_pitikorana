export default class TypeRelationTraduction {
  constructor({
    id = null,
    id_type_relation = null,
    id_langue = null,
    code_langue = null,
    nom_langue = null,
    libelle = null,
  }) {
    this.id = id;
    this.id_type_relation = id_type_relation;
    this.id_langue = id_langue;
    this.code_langue = code_langue;
    this.nom_langue = nom_langue;
    this.libelle = libelle;
  }

  toJSON() {
    return {
      id: this.id,
      id_langue: this.id_langue,
      code_langue: this.code_langue,
      nom_langue: this.nom_langue,
      libelle: this.libelle,
    };
  }
}
