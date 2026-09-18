export default class DemandeInscription {
  constructor({
    id = null,
    id_personne = null,
    email = null,
    telephone = null,
    reference = null,
    donnees = {},
    statut = null,
    role_attribue = null,
    date_demande = null,
    date_traitement = null,
    id_compte_admin_traitement = null,
    commentaire_admin = null,
  } = {}) {
    this.id = id;
    this.id_personne = id_personne;
    this.email = email;
    this.telephone = telephone;
    this.reference = reference;
    this.donnees = donnees;
    this.statut = statut;
    this.role_attribue = role_attribue;
    this.date_demande = date_demande;
    this.date_traitement = date_traitement;
    this.id_compte_admin_traitement = id_compte_admin_traitement;
    this.commentaire_admin = commentaire_admin;
  }

  toJSON() {
    return {
      id: this.id,
      id_personne: this.id_personne,
      email: this.email,
      telephone: this.telephone,
      reference: this.reference,
      donnees: this.donnees,
      statut: this.statut,
      role_attribue: this.role_attribue,
      date_demande: this.date_demande,
      date_traitement: this.date_traitement,
      id_compte_admin_traitement: this.id_compte_admin_traitement,
      commentaire_admin: this.commentaire_admin,
    };
  }
}
