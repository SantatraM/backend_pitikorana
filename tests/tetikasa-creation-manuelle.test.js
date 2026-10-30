import test from "node:test";
import assert from "node:assert/strict";
import { runWithDatabaseClient } from "../src/config/db.js";
import { creerTetikasaManuel, creerTetikasaDepuisSosoKevitra } from "../src/services/tetikasa.service.js";
import { createTetikasa } from "../src/controllers/tetikasa.controller.js";
import router from "../src/routes/tetikasa.routes.js";

const id = "11111111-1111-4111-8111-111111111111";
const person = "22222222-2222-4222-8222-222222222222";
const revision = "2026-10-17T10:00:00.123456Z";
const auth = (role = "ADMIN") => ({ personne: { id: person }, compte: { role } });
const full = { action: "SOUMETTRE", titre: "Titre", description: "Description", objectif: "Objectif", beneficiaires: "Tous", lieu: "Lieu", date_debut_prevue: "2026-10-01", date_fin_prevue: "2026-10-31", responsables: [{ id_personne: person, type_responsabilite: "PRINCIPAL" }], actions: [{ titre: "Action", id_responsable: person }], ressources: [{ type_ressource: "OLONA", description: "Aide" }], budget: [{ designation: "Ligne", quantite: "1", prix_unitaire_estime: "0" }] };

function mockDb({ missingPerson = false, failInsert = false } = {}) {
  const state = { project: null, history: [], responsables: [], actions: [], ressources: [], budget: [] };
  const calls = []; let snapshot;
  return { state, calls, async query(sql, params = []) {
    calls.push({ sql, params });
    if (sql === "BEGIN") { snapshot = structuredClone(state); return { rows: [] }; }
    if (sql === "COMMIT") return { rows: [] };
    if (sql === "ROLLBACK") { Object.assign(state, snapshot); return { rows: [] }; }
    if (sql.includes("SELECT id FROM personne")) return { rows: missingPerson ? [] : params[0].map((value) => ({ id: value })) };
    if (sql.includes("SELECT id, code FROM statut_tetikasa")) return { rows: [{ id: "draft", code: "DRAFITRA" }] };
    if (sql.includes("INSERT INTO tetikasa (")) {
      state.project = { id, titre: params[2], description: params[3], objectif: params[5], beneficiaires: params[6], lieu: params[7], lieu_non_defini: params[8], date_debut_prevue: params[9], date_fin_prevue: params[10], devise: params[11], revision, statut_code: "DRAFITRA" };
      return { rows: [{ id, revision }] };
    }
    if (sql.startsWith("DELETE FROM tetikasa_")) return { rows: [] };
    for (const [table, key] of [["tetikasa_responsable", "responsables"], ["tetikasa_action", "actions"], ["tetikasa_ressource", "ressources"], ["tetikasa_ligne_budget", "budget"]]) {
      if (sql.includes(`INSERT INTO ${table} (`)) {
        if (failInsert && key === "budget") throw new Error("insertion échouée");
        state[key].push(params);
        return { rows: [] };
      }
    }
    if (sql.includes("INSERT INTO tetikasa_historique")) { state.history.push(params); return { rows: [] }; }
    if (sql.includes("FOR UPDATE OF t")) return { rows: [state.project] };
    if (sql.includes("AS has_responsable")) return { rows: [{ has_responsable: !!state.responsables.length, has_action: !!state.actions.length }] };
    if (sql.includes("SELECT designation, quantite, prix_unitaire_estime FROM tetikasa_ligne_budget")) return { rows: state.budget.map((row) => ({ designation: row[1], quantite: row[2], prix_unitaire_estime: row[3] })) };
    if (sql.includes("SELECT id FROM statut_tetikasa")) return { rows: [{ id: params[0] }] };
    if (sql.includes("UPDATE tetikasa SET id_statut_tetikasa")) { state.project.statut_code = params[0]; state.project.revision = "2026-10-17T10:00:00.123457Z"; return { rows: [{ revision: state.project.revision }] }; }
    throw new Error(`Requête inattendue : ${sql}`);
  } };
}
const run = (db, body, role = "ADMIN") => runWithDatabaseClient(db, () => creerTetikasaManuel(body, auth(role)));

test("brouillon minimal : source nulle, devise, historique et révision", async () => {
  for (const role of ["ADMIN", "PASTEUR", "BUREAU_ZANAKA_AMPIELEZANA"]) {
    const db = mockDb(); const result = await run(db, { action: "BROUILLON", titre: "Titre" }, role);
    assert.deepEqual(result, { tetikasa: { id, statut: "DRAFITRA", revision } });
    assert.equal(db.state.project.devise, "MGA");
    assert.match(db.calls.find((call) => call.sql.includes("INSERT INTO tetikasa (")).sql, /VALUES \(NULL,/);
    assert.equal(db.state.history[0][1], "CREATION_MANUELLE_DRAFT");
    assert.equal(db.calls.at(-1).sql, "COMMIT");
  }
});

test("collections complètes et soumission dans une seule transaction", async () => {
  for (const action of ["BROUILLON", "SOUMETTRE"]) {
    const db = mockDb(); const result = await run(db, { ...full, action });
    for (const key of ["responsables", "actions", "ressources", "budget"]) assert.equal(db.state[key].length, 1);
    assert.equal(result.tetikasa.statut, action === "SOUMETTRE" ? "EN_ATTENTE_VALIDATION" : "DRAFITRA");
    assert.equal(db.state.history.length, action === "SOUMETTRE" ? 2 : 1);
    assert.equal(db.calls.filter((call) => call.sql === "BEGIN").length, 1);
    assert.equal(db.calls.at(-1).sql, "COMMIT");
  }
});

test("soumission incomplète et insertion échouée sont annulées", async () => {
  for (const [db, body, expected] of [[mockDb(), { action: "SOUMETTRE", titre: "Titre" }, "TETIKASA_INCOMPLETE"], [mockDb({ failInsert: true }), full, "insertion échouée"]]) {
    await assert.rejects(run(db, body), (error) => error.code === expected || error.message === expected);
    assert.equal(db.state.project, null); assert.deepEqual(db.state.history, []); assert.equal(db.calls.at(-1).sql, "ROLLBACK");
  }
});

test("rôles, champs, personnes et validations sont contrôlés", async () => {
  await assert.rejects(run(mockDb(), full, "MEMBRE"), { code: "TETIKASA_FORBIDDEN" });
  await assert.rejects(runWithDatabaseClient(mockDb(), () => creerTetikasaManuel(full, null)), { code: "AUTH_REQUIRED" });
  for (const body of [{ ...full, id: id }, { ...full, revision }, { ...full, id_soso_kevitra_source: id }, { ...full, budget: [{ ...full.budget[0], id }] }, { ...full, titre: " " }, { ...full, date_fin_prevue: "2026-09-01" }, { ...full, budget: [{ ...full.budget[0], quantite: "0" }] }, { ...full, actions: [{ titre: "Action", id_responsable: id }] }, { ...full, ressources: null }]) {
    await assert.rejects(run(mockDb(), body), { code: "TETIKASA_INVALID" });
  }
  await assert.rejects(run(mockDb({ missingPerson: true }), full), { code: "TETIKASA_PERSON_NOT_FOUND" });
});

test("route et contrôleur appliquent authentification, rôles et réponse 201", async () => {
  const route = router.stack.find((layer) => layer.route?.path === "/" && layer.route.methods.post).route;
  const [requireAuth, requireRole, controller] = route.stack.map((layer) => layer.handle);
  assert.equal(controller, createTetikasa);
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  const unauth = response(); await requireAuth({ headers: {} }, unauth, () => assert.fail()); assert.equal(unauth.statusCode, 401);
  const member = response(); requireRole({ auth: auth("MEMBRE") }, member, () => assert.fail()); assert.equal(member.statusCode, 403);
  const db = mockDb(); const res = response();
  await runWithDatabaseClient(db, () => createTetikasa({ body: { action: "BROUILLON", titre: "Titre" }, auth: auth() }, res));
  assert.equal(res.statusCode, 201); assert.equal(res.body.data.tetikasa.revision, revision);
});

test("conversion depuis une suggestion acceptée conserve son chemin existant", async () => {
  const queries = [];
  const db = { async query(sql, params = []) {
    queries.push(sql);
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
    if (sql.includes("FOR UPDATE OF s")) return { rows: [{ id, titre: "Suggestion", statut_code: "ACCEPTE", decision_finale: "ACCEPTE", devise: "MGA" }] };
    if (sql.includes("WHERE t.id_soso_kevitra_source = $1")) return { rows: [] };
    if (sql.includes("SELECT id, code FROM statut_tetikasa")) return { rows: [{ id: "draft", code: "DRAFITRA" }] };
    if (sql.includes("INSERT INTO tetikasa (")) { assert.equal(params[0], id); return { rows: [{ id: person }] }; }
    if (sql.includes("INSERT INTO tetikasa_action") || sql.includes("INSERT INTO tetikasa_ligne_budget") || sql.includes("INSERT INTO tetikasa_historique")) return { rows: [] };
    throw new Error(`Requête inattendue : ${sql}`);
  } };
  const result = await runWithDatabaseClient(db, () => creerTetikasaDepuisSosoKevitra(id, auth()));
  assert.equal(result.created, true);
  assert.equal(result.tetikasa.id_soso_kevitra_source, id);
  assert.equal(queries.at(-1), "COMMIT");
});
