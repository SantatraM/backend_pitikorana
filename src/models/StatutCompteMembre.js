export default class StatutCompteMembre {
  constructor({ id = null, code = null } = {}) {
    this.id = id;
    this.code = code;
  }

  toJSON() {
    return { id: this.id, code: this.code };
  }
}
