export default class RelationPersonne {
  constructor({
    id = null,
    id_personne_source,
    id_personne_cible,
    id_type_relation,
    personne_source = null,
    personne_cible = null,
    type_relation = null,
  }) {
    this.id = id;
    this.id_personne_source = id_personne_source;
    this.id_personne_cible = id_personne_cible;
    this.id_type_relation = id_type_relation;
    this.personne_source = personne_source;
    this.personne_cible = personne_cible;
    this.type_relation = type_relation;
  }
}
