import test from "node:test";
import assert from "node:assert/strict";
import { runWithDatabaseClient } from "../src/config/db.js";
import { getTetikasaList, getTetikasaById } from "../src/services/tetikasa.service.js";
import { getSosoKevitraById } from "../src/services/sosoKevitra.service.js";
import { getTetikasa } from "../src/controllers/tetikasa.controller.js";

const roles = ["ADMIN", "PASTEUR", "BUREAU_ZANAKA_AMPIELEZANA", "MEMBRE"];
const statuses = ["DRAFITRA", "EN_ATTENTE_VALIDATION", "VALIDE", "REFUSE", "MISOKATRA"];
const auth = (role) => ({ personne: { id: "personne" }, compte: { role } });
const projectId = "11111111-1111-4111-8111-111111111111";
const project = (status) => ({ id: projectId, statut_code: status, created_by_id: "auteur", created_by_nom: "Nom", created_by_prenom: null });

function fakeDb(status = "DRAFITRA") {
  const calls = [];
  return { calls, async query(sql, params = []) {
    calls.push({ sql, params });
    if (sql.includes("FROM tetikasa t") && sql.includes("created_by_nom")) {
      const detail = sql.includes("WHERE t.id = $1");
      const canReadAll = params[detail ? 1 : 0];
      assert.match(sql, detail ? /WHERE t\.id = \$1 AND \(\$2::boolean OR statut\.code = 'MISOKATRA'\)/ : /WHERE \(\$1::boolean OR statut\.code = 'MISOKATRA'\)/);
      if (detail) return { rows: canReadAll || status === "MISOKATRA" ? [project(status)] : [] };
      return { rows: statuses.filter((s) => canReadAll || s === "MISOKATRA").map(project) };
    }
    if (sql.includes("FROM tetikasa\n")) {
      assert.match(sql, /\$2::boolean OR statut\.code = 'MISOKATRA'/);
      return { rows: params[1] || status === "MISOKATRA" ? [{ id: projectId, statut: status }] : [] };
    }
    if (sql.includes("SELECT s.*, statut.code AS statut_code")) return { rows: [{ id: "source", id_auteur: "auteur", statut_code: "ACCEPTE", id_statut_soso_kevitra: "statut" }] };
    if (sql.includes("AS nombre_soutiens")) return { rows: [{ nombre_soutiens: 0, utilisateur_soutient: false }] };
    if (sql.includes("FROM tetikasa_historique")) return { rows: [{ id: "history", action: "VALIDATION", commentaire: "secret-projet", acteur_id: "acteur" }] };
    if (sql.includes("FROM soso_kevitra_verification")) return { rows: [{ action: "VERIFIE", commentaire: "secret-verification", id_personne_action: "acteur" }] };
    if (sql.includes("FROM soso_kevitra_prolongation")) return { rows: [{ id: "prolongation", raison: "secret-prolongation" }] };
    if (sql.includes("FROM soso_kevitra_decision")) return { rows: [{ decision: "ACCEPTE", observation: "secret-decision", date_decision: "2026-01-01", personne_action_id: "acteur" }] };
    if (sql.includes("COALESCE(SUM") && sql.includes("AS total")) return { rows: [{ total: "0", total_budget_calcule: "0" }] };
    return { rows: [] };
  } };
}

test("liste filtrée en SQL selon le rôle authentifié", async () => {
  for (const role of [...roles, "INCONNU"]) {
    const db = fakeDb();
    const data = await runWithDatabaseClient(db, () => getTetikasaList(auth(role)));
    assert.deepEqual(data.map((row) => row.statut.code), role === "MEMBRE" || role === "INCONNU" ? ["MISOKATRA"] : statuses);
    assert.match(db.calls[0].sql, /ORDER BY t\.date_creation DESC, t\.id DESC/);
  }
  await assert.rejects(getTetikasaList({ compte: { role: "ADMIN" } }), { code: "AUTH_REQUIRED" });
});

test("historiques et décision : données internes réservées aux responsables", async () => {
  for (const role of [...roles, "INCONNU", undefined]) {
    const privileged = ["ADMIN", "PASTEUR", "BUREAU_ZANAKA_AMPIELEZANA"].includes(role);
    const db = fakeDb("MISOKATRA");
    const projectDetail = await runWithDatabaseClient(db, () => getTetikasaById(projectId, auth(role)));
    const suggestion = await runWithDatabaseClient(db, () => getSosoKevitraById("source", auth(role)));
    assert.equal(projectDetail.historique.length, privileged ? 1 : 0);
    assert.equal(suggestion.statut.code, "ACCEPTE");
    assert.equal(suggestion.decision_finale?.decision, "ACCEPTE");
    if (privileged) {
      assert.equal(suggestion.verification_historique[0].commentaire, "secret-verification");
      assert.equal(suggestion.prolongations[0].raison, "secret-prolongation");
      assert.equal(suggestion.decision_finale.observation, "secret-decision");
    } else {
      assert.equal(Object.hasOwn(suggestion, "verification_historique"), false);
      assert.equal(Object.hasOwn(suggestion, "prolongations"), false);
      assert.deepEqual(suggestion.decision_finale, { decision: "ACCEPTE" });
      assert.doesNotMatch(JSON.stringify({ projectDetail, suggestion }), /secret-(projet|verification|prolongation|decision)/);
    }
  }
});

test("détail et UUID direct : 404 sans lecture des enfants pour les projets cachés", async () => {
  for (const role of roles) for (const status of statuses) {
    const db = fakeDb(status);
    const res = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
    await runWithDatabaseClient(db, () => getTetikasa({ params: { id: projectId }, auth: auth(role) }, res));
    const visible = role !== "MEMBRE" || status === "MISOKATRA";
    assert.equal(res.statusCode, visible ? 200 : 404);
    if (!visible) { assert.deepEqual(res.body, { success: false, message: "Tetikasa introuvable" }); assert.equal(db.calls.length, 1); }
  }
  const db = fakeDb("DRAFITRA");
  assert.equal(await runWithDatabaseClient(db, () => getTetikasaById(projectId, auth("MEMBRE"))), null);
});

test("détail Soso-kevitra : projet associé filtré selon le même rôle", async () => {
  for (const role of roles) for (const status of statuses) {
    const db = fakeDb(status);
    const result = await runWithDatabaseClient(db, () => getSosoKevitraById("source", auth(role)));
    assert.deepEqual(result.tetikasa_associe, role !== "MEMBRE" || status === "MISOKATRA" ? { id: projectId, statut: status } : null);
  }
});

test("membre : collections d'un projet ouvert accessibles, sans historique interne", async () => {
  const db = fakeDb("MISOKATRA");
  const query = db.query.bind(db);
  db.query = async (sql, params) => {
    if (sql.includes("FROM tetikasa_responsable r")) return { rows: [{ id: "r1", personne_id: "p1", nom: "Fictif", type_responsabilite: "PRINCIPAL" }] };
    if (sql.includes("FROM tetikasa_action")) return { rows: [{ id: "a1", titre: "Action fictive" }] };
    if (sql.includes("FROM tetikasa_ressource")) return { rows: [{ id: "r2", description: "Ressource fictive" }] };
    if (sql.includes("FROM tetikasa_ligne_budget") && !sql.includes("SUM")) return { rows: [{ id: "b1", designation: "Budget fictif" }] };
    return query(sql, params);
  };
  const detail = await runWithDatabaseClient(db, () => getTetikasaById(projectId, auth("MEMBRE")));
  assert.equal(detail.responsables[0].id, "r1");
  assert.equal(detail.actions[0].id, "a1");
  assert.equal(detail.ressources[0].id, "r2");
  assert.equal(detail.budget[0].id, "b1");
  assert.deepEqual(detail.historique, []);
});

test("membre et rôles inconnus : aucune donnée de projet validé dans le détail de suggestion", async () => {
  for (const role of ["MEMBRE", "INCONNU", undefined]) {
    const db = fakeDb("VALIDE");
    const suggestion = await runWithDatabaseClient(db, () => getSosoKevitraById("source", auth(role)));
    assert.equal(suggestion.tetikasa_associe, null);
    assert.ok(!JSON.stringify(suggestion).includes(projectId));
    const detail = await runWithDatabaseClient(db, () => getTetikasaById(projectId, auth(role)));
    assert.equal(detail, null);
  }
});
