import TypeRelationTraduction from "./TypeRelationTraduction.js";

export default class TypeRelation {
  constructor({
    id = null,
    code = null,
    id_inverse_defaut = null,
    id_inverse_masculin = null,
    id_inverse_feminin = null,
    traductions = [],
  }) {
    this.id = id;
    this.code = code;
    this.id_inverse_defaut = id_inverse_defaut;
    this.id_inverse_masculin = id_inverse_masculin;
    this.id_inverse_feminin = id_inverse_feminin;
    this.traductions = traductions.map((traduction) =>
      traduction instanceof TypeRelationTraduction
        ? traduction
        : new TypeRelationTraduction(traduction),
    );
  }

  toJSON() {
    return {
      id: this.id,
      code: this.code,
      id_inverse_defaut: this.id_inverse_defaut,
      id_inverse_masculin: this.id_inverse_masculin,
      id_inverse_feminin: this.id_inverse_feminin,
      traductions: this.traductions,
    };
  }
}
