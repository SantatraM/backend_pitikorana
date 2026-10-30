import test from "node:test";
import assert from "node:assert/strict";
import router from "../src/routes/tetikasa.routes.js";
import { runWithDatabaseClient } from "../src/config/db.js";
import { transitionTetikasaController } from "../src/controllers/tetikasa.controller.js";

const id = "11111111-1111-4111-8111-111111111111";
const actor = "22222222-2222-4222-8222-222222222222";
const revision = "2026-10-17T10:00:00.123456Z";
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } });
const auth = (role) => ({ personne: { id: actor }, compte: { role } });

function databaseMock({ status = "DRAFITRA", incomplete = false, missing = false } = {}) {
  const calls = [];
  return { calls, async query(sql, params = []) {
    calls.push({ sql, params });
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
    if (sql.includes("FOR UPDATE OF t")) return { rows: missing ? [] : [{ id, statut_code: status, revision, titre: incomplete ? "" : "Titre", description: "Description", objectif: "Objectif", beneficiaires: "Tous", lieu: "Lieu", date_debut_prevue: "2026-10-01", date_fin_prevue: "2026-10-31" }] };
    if (sql.includes("AS has_responsable")) return { rows: [{ has_responsable: true, has_action: true }] };
    if (sql.includes("FROM tetikasa_ligne_budget")) return { rows: [] };
    if (sql.includes("SELECT id FROM statut_tetikasa")) return { rows: [{ id: params[0] }] };
    if (sql.includes("UPDATE tetikasa SET id_statut_tetikasa")) return { rows: [{ revision: "2026-10-17T10:00:00.123457Z" }] };
    if (sql.includes("INSERT INTO tetikasa_historique")) return { rows: [] };
    throw new Error("Requête inattendue");
  } };
}

test("route POST : authentification et rôles", async () => {
  const route = router.stack.find((layer) => layer.route?.path === "/:id/transition" && layer.route.methods.post).route;
  const [requireAuth, requireRole, controller] = route.stack.map((layer) => layer.handle);
  assert.equal(controller, transitionTetikasaController);
  const unauthenticated = response();
  await requireAuth({ headers: {} }, unauthenticated, () => assert.fail("authentification contournée"));
  assert.equal(unauthenticated.statusCode, 401);
  for (const role of ["ADMIN", "PASTEUR", "BUREAU_ZANAKA_AMPIELEZANA", "MEMBRE"]) {
    const res = response(); let allowed = false;
    requireRole({ auth: auth(role) }, res, () => { allowed = true; });
    assert.equal(allowed, role !== "MEMBRE");
    if (role === "MEMBRE") assert.equal(res.statusCode, 403);
  }
});

test("contrôleur : transmission, réponse et acteur authentifié", async () => {
  const db = databaseMock(); const res = response();
  await runWithDatabaseClient(db, () => transitionTetikasaController({ params: { id }, body: { action: "SOUMISSION_VALIDATION", revision }, auth: auth("BUREAU_ZANAKA_AMPIELEZANA") }, res));
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { success: true, data: { tetikasa: { id, statut: "EN_ATTENTE_VALIDATION", revision: "2026-10-17T10:00:00.123457Z" }, action: "SOUMISSION_VALIDATION" } });
  assert.deepEqual(db.calls.find((call) => call.sql.includes("INSERT INTO tetikasa_historique")).params, [id, "SOUMISSION_VALIDATION", actor, null]);
});

test("contrôleur : ouverture et contrôles de rôle", async () => {
  for (const role of ["ADMIN", "PASTEUR", "BUREAU_ZANAKA_AMPIELEZANA", "MEMBRE"]) {
    const db = databaseMock({ status: "VALIDE" }); const res = response();
    await runWithDatabaseClient(db, () => transitionTetikasaController({ params: { id }, body: { action: "OUVRIR", revision }, auth: auth(role) }, res));
    if (["ADMIN", "PASTEUR"].includes(role)) {
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body.data, { tetikasa: { id, statut: "MISOKATRA", revision: "2026-10-17T10:00:00.123457Z" }, action: "OUVRIR" });
      assert.deepEqual(db.calls.find((call) => call.sql.includes("INSERT INTO tetikasa_historique")).params, [id, "OUVERTURE_PROJET", actor, null]);
    } else {
      assert.equal(res.statusCode, 403);
      assert.ok(!db.calls.some((call) => call.sql.includes("UPDATE tetikasa SET")));
    }
  }
});

test("contrôleur : erreurs métier, conflit et corps non fiable", async () => {
  for (const [body, role, options, expected] of [
    [{ action: "VALIDATION", revision }, "BUREAU_ZANAKA_AMPIELEZANA", {}, 403],
    [{ action: "SOUMISSION_VALIDATION", revision, role: "ADMIN" }, "BUREAU_ZANAKA_AMPIELEZANA", {}, 400],
    [{ action: "SOUMISSION_VALIDATION", revision: "2026-10-17T10:00:00.123455Z" }, "ADMIN", {}, 409],
    [{ action: "SOUMISSION_VALIDATION", revision }, "ADMIN", { status: "REFUSE" }, 409],
    [{ action: "SOUMISSION_VALIDATION", revision }, "ADMIN", { status: "VALIDE" }, 409],
    [{ action: "SOUMISSION_VALIDATION", revision }, "ADMIN", { incomplete: true }, 409],
    [{ action: "SOUMISSION_VALIDATION", revision }, "ADMIN", { missing: true }, 404],
  ]) {
    const db = databaseMock(options); const res = response();
    await runWithDatabaseClient(db, () => transitionTetikasaController({ params: { id }, body, auth: auth(role) }, res));
    assert.equal(res.statusCode, expected);
    if (options.incomplete) {
      assert.deepEqual(res.body, { success: false, code: "TETIKASA_INCOMPLETE", message: "Le Tetikasa est incomplet pour la soumission", fields: ["titre"] });
    } else if (body.revision !== revision) {
      assert.deepEqual(res.body, { success: false, code: "TETIKASA_REVISION_CONFLICT", message: "Révision Tetikasa obsolète" });
    } else if (["REFUSE", "VALIDE"].includes(options.status)) {
      assert.deepEqual(res.body, { success: false, code: "TETIKASA_STATE_INVALID", message: "Transition incompatible avec le statut actuel" });
    } else {
      assert.equal(res.body.success, false);
      assert.equal(typeof res.body.message, "string");
      assert.equal(Object.hasOwn(res.body, "code"), false);
    }
    assert.ok(!db.calls.some((call) => call.sql.includes("UPDATE tetikasa SET")));
  }
});
